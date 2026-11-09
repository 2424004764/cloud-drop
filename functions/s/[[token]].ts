// /s/<token>[/zip|/f/<index>] — 公开分享落地页与下载（无需登录）
//   GET /s/<token>            : 分享落地页（HTML，列出文件 + 下载按钮 + ZIP 全部下载）
//   GET /s/<token>/zip        : 服务端流式打包 ZIP（直接串接 R2 流，不落内存）
//   GET /s/<token>/f/<index>  : 下载第 index 个文件（?p=1 为 inline 预览）

import { Zip, ZipPassThrough } from "fflate";
import { contentDisposition, filenameFromKey } from "../lib/files";
import { resolveShareId, verifyShareToken } from "../lib/share";

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / 1024 ** index;
  return `${index === 0 || value >= 100 ? String(Math.round(value)) : value.toFixed(1)} ${units[index]}`;
}

type LooseParams = { token?: string | string[] };

function parseRoute(context: { params: unknown }): { token: string; action: string } | null {
  const raw = (context.params as LooseParams | undefined)?.token;
  if (raw === undefined) return null;
  const joined = Array.isArray(raw) ? raw.join("/") : raw;
  if (!joined) return null;
  const parts = joined.split("/");
  return { token: decodeURIComponent(parts[0]), action: parts.slice(1).join("/") };
}

const HTML_HEADERS = {
  "Content-Type": "text/html; charset=utf-8",
  "Cache-Control": "no-store",
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/* ---------------- 落地页 ---------------- */

function renderSharePage(o: {
  sharer: string | null;
  expiresAt: number | null;
  files: { name: string; size: number; index: number }[];
  token: string;
}): string {
  const fileRows = o.files
    .map((f, i) => {
      const initial = escapeHtml((f.name.match(/\.(.{1,4})$/)?.[1] ?? "文件").toUpperCase());
      return `
      <li class="row">
        <span class="badge">${initial.length <= 4 ? initial : "FILE"}</span>
        <span class="meta">
          <span class="name" title="${escapeHtml(f.name)}">${escapeHtml(f.name)}</span>
          <span class="size">${formatBytes(f.size)}</span>
        </span>
        <a class="btn" href="/s/${o.token}/f/${f.index}">下载</a>
      </li>`;
    })
    .join("");

  const expiryText = o.expiresAt
    ? `有效期至 ${escapeHtml(new Date(o.expiresAt).toLocaleString("zh-CN", { hour12: false }))}`
    : "永久有效";

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Cloud Drop 文件分享</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect x='4' y='4' width='56' height='56' rx='14' fill='%236366f1'/%3E%3C/svg%3E">
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
    background: #f6f6f8; color: #18181b; min-height: 100vh;
    display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 24px 16px;
  }
  @media (prefers-color-scheme: dark) {
    body { background: #0b0b0e; color: #fafafa; }
    .card { background: #131317 !important; border-color: #26262c !important; }
    .badge { background: rgba(99,102,241,.14) !important; color: #8b8bf7 !important; }
    .row + .row { border-color: #232329 !important; }
    .hint { color: #7c7c85 !important; }
    .sub { color: #8f8f98 !important; }
  }
  .card {
    width: 100%; max-width: 560px; background: #fff; border: 1px solid #e6e6ea;
    border-radius: 18px; padding: 22px; box-shadow: 0 12px 40px rgba(0,0,0,.06);
  }
  .brand { display: flex; align-items: center; gap: 10px; margin-bottom: 4px; }
  .logo { width: 34px; height: 34px; border-radius: 10px; background: linear-gradient(135deg,#6366f1,#8b5cf6);
          display: flex; align-items: center; justify-content: center; font-size: 17px; }
  .title { font-size: 15px; font-weight: 600; }
  .sub { font-size: 12px; color: #71717a; margin-top: 14px; line-height: 1.7; }
  .meta-bar { display: flex; justify-content: space-between; align-items: center; margin: 14px 0 6px; }
  .count { font-size: 12px; color: #71717a; }
  .zip { font-size: 12px; font-weight: 600; color: #6366f1; text-decoration: none; padding: 6px 10px;
         border: 1px solid rgba(99,102,241,.35); border-radius: 8px; }
  .zip:hover { background: rgba(99,102,241,.08); }
  ul { list-style: none; margin-top: 4px; }
  .row { display: flex; align-items: center; gap: 12px; padding: 10px 2px; }
  .row + .row { border-top: 1px solid #efeff2; }
  .badge { width: 38px; height: 38px; border-radius: 10px; background: rgba(99,102,241,.1); color: #4f46e5;
           display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 700;
           flex-shrink: 0; letter-spacing: .02em; }
  .meta { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 2px; }
  .name { font-size: 13px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .size { font-size: 11px; color: #71717a; font-variant-numeric: tabular-nums; }
  .btn { flex-shrink: 0; font-size: 12px; font-weight: 600; color: #fff; background: #18181b;
         text-decoration: none; padding: 7px 14px; border-radius: 8px; }
  .btn:hover { background: #27272a; }
  .hint { margin-top: 16px; font-size: 11px; color: #9d9da6; line-height: 1.7; }
  .foot { margin-top: 18px; font-size: 11px; color: #9d9da6; text-align: center; }
</style>
</head>
<body>
  <div class="card">
    <div class="brand">
      <span class="logo">☁️</span>
      <span class="title">Cloud Drop 文件分享</span>
    </div>
    ${o.sharer ? `<p class="sub">来自 <b>${escapeHtml(o.sharer)}</b> 的文件分享 · ${expiryText}</p>` : `<p class="sub">${expiryText}</p>`}
    <div class="meta-bar">
      <span class="count">${o.files.length} 个文件 · ${formatBytes(o.files.reduce((s, f) => s + f.size, 0))}</span>
      ${o.files.length > 1 ? `<a class="zip" href="/s/${o.token}/zip">全部下载 ZIP</a>` : ""}
    </div>
    <ul>${fileRows}</ul>
    <p class="hint">点击「下载」直接获取文件；多个文件可一键打包为 ZIP。链接无需登录，到期自动失效。</p>
  </div>
  <p class="foot">Powered by Cloud Drop · Cloudflare Pages + R2</p>
</body>
</html>`;
}

function errorPage(title: string, message: string): Response {
  const html = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>${escapeHtml(title)}</title>
<style>body{font-family:system-ui,"PingFang SC","Microsoft YaHei",sans-serif;background:#0b0b0e;color:#fafafa;
min-height:100vh;display:flex;align-items:center;justify-content:center}
.c{text-align:center;padding:40px}.c h1{font-size:16px;margin-bottom:8px}.c p{font-size:13px;color:#8f8f98}</style></head>
<body><div class="c"><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p></div></body></html>`;
  return new Response(html, { status: 404, headers: HTML_HEADERS });
}

/* ---------------- 流式 ZIP ---------------- */

function zipResponse(
  entries: { name: string; body: ReadableStream<Uint8Array> }[],
  downloadName: string,
): Response {
  let controller: ReadableStreamDefaultController<Uint8Array>;
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
  });

  const zip = new Zip();
  let closed = false;
  const close = () => {
    if (!closed) {
      closed = true;
      controller.close();
    }
  };
  const fail = (error: unknown) => {
    if (!closed) {
      closed = true;
      controller.error(error instanceof Error ? error : new Error(String(error)));
    }
  };

  zip.ondata = (err, data, final) => {
    if (err) return fail(err);
    if (data.length > 0) controller.enqueue(data);
    if (final) close();
  };

  void (async () => {
    try {
      const usedNames = new Set<string>();
      for (const entry of entries) {
        // 展平目录层级 + 去重重名
        let name = entry.name.replace(/[\\/]/g, "_");
        let n = 2;
        while (usedNames.has(name)) {
          const dot = name.lastIndexOf(".");
          name = dot > 0 ? `${name.slice(0, dot)}(${n})${name.slice(dot)}` : `${name}(${n})`;
          n += 1;
        }
        usedNames.add(name);

        const file = new ZipPassThrough(name);
        zip.add(file);
        const reader = entry.body.getReader();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          file.push(value, false);
        }
        file.push(new Uint8Array(0), true);
      }
      zip.end();
    } catch (error) {
      fail(error);
    }
  })();

  const headers = new Headers({
    "Content-Type": "application/zip",
    "Content-Disposition": contentDisposition(downloadName, "attachment"),
    "Cache-Control": "no-store",
  });
  return new Response(stream, { headers });
}

/* ---------------- 路由 ---------------- */

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, request } = context;
  const route = parseRoute(context);
  if (!route || !route.token) {
    return errorPage("链接无效", "分享链接不完整，请向分享者确认完整链接");
  }

  // 兼容两种形式：短 ID（查桶内映射）与旧版自包含长令牌（含 "."）
  const token =
    route.token.includes(".") && route.token.length > 64
      ? route.token
      : await resolveShareId(env.MY_BUCKET, route.token);

  const payload = token ? await verifyShareToken(env, token) : null;
  if (!payload) {
    return errorPage("链接无效或已过期", "该分享链接不存在、已被篡改或已超过有效期");
  }

  // 逐个确认对象仍存在（并行 HEAD）
  const heads = await Promise.all(
    payload.k.map(async (key) => {
      try {
        return await env.MY_BUCKET.head(key);
      } catch {
        return null;
      }
    }),
  );
  const existing = payload.k
    .map((key, index) => ({ key, index, head: heads[index] }))
    .filter((e) => e.head !== null);

  if (existing.length === 0) {
    return errorPage("文件已不存在", "分享中的所有文件都已被删除");
  }

  /* ---- 单文件下载 ---- */
  const fileMatch = route.action.match(/^f\/(\d+)$/);
  if (fileMatch) {
    const index = Number(fileMatch[1]);
    if (!Number.isInteger(index) || index < 0 || index >= payload.k.length) {
      return new Response("Not Found", { status: 404, headers: { "Cache-Control": "no-store" } });
    }
    const target = existing.find((e) => e.index === index);
    if (!target) {
      return new Response("Gone", { status: 404, headers: { "Cache-Control": "no-store" } });
    }
    const object = await env.MY_BUCKET.get(target.key);
    if (!object) {
      return new Response("Gone", { status: 404, headers: { "Cache-Control": "no-store" } });
    }
    const inline = new URL(request.url).searchParams.get("p") === "1";
    const headers = new Headers();
    headers.set("Content-Type", object.httpMetadata?.contentType ?? "application/octet-stream");
    headers.set("Content-Length", String(object.size));
    headers.set("Content-Disposition", contentDisposition(filenameFromKey(target.key), inline ? "inline" : "attachment"));
    headers.set("Cache-Control", "private, max-age=0, must-revalidate");
    return new Response(object.body, { headers });
  }

  /* ---- ZIP 打包 ---- */
  if (route.action === "zip") {
    if (existing.length === 1) {
      // 单文件分享：zip 路由直接回退为该文件下载
      const object = await env.MY_BUCKET.get(existing[0].key);
      if (!object) return errorPage("文件已不存在", "该文件已被删除");
      const headers = new Headers();
      headers.set("Content-Type", object.httpMetadata?.contentType ?? "application/octet-stream");
      headers.set("Content-Length", String(object.size));
      headers.set("Content-Disposition", contentDisposition(filenameFromKey(existing[0].key), "attachment"));
      headers.set("Cache-Control", "no-store");
      return new Response(object.body, { headers });
    }

    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const downloadName = `CloudDrop分享_${stamp}.zip`;
    const settled = await Promise.all(
      existing.map(async (e) => {
        try {
          const object = await env.MY_BUCKET.get(e.key);
          return object
            ? { name: filenameFromKey(e.key), body: object.body as ReadableStream<Uint8Array> }
            : null;
        } catch {
          return null;
        }
      }),
    );
    const validEntries = settled.filter((e): e is { name: string; body: ReadableStream<Uint8Array> } => e !== null);
    if (validEntries.length === 0) return errorPage("文件已不存在", "该文件已被删除");
    return zipResponse(validEntries, downloadName);
  }

  /* ---- 落地页 ---- */
  if (route.action === "") {
    return new Response(
      renderSharePage({
        sharer: payload.u ?? null,
        expiresAt: payload.e ?? null,
        files: existing.map((e) => ({
          name: filenameFromKey(e.key),
          size: e.head!.size,
          index: e.index,
        })),
        token: route.token,
      }),
      { headers: HTML_HEADERS },
    );
  }

  return new Response("Not Found", { status: 404, headers: { "Cache-Control": "no-store" } });
};
