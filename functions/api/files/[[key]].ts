// GET /api/files 与 /api/files/<key...> — 文件列表与单文件操作（可选 catch-all 路由）
//   GET /api/files                     : 列出当前用户的文件（含文件夹清单；管理员可见全部）
//   GET /api/files/<key>?mode=preview  : 在线预览（inline）；默认 download（attachment）
//   DELETE /api/files/<key>            : 删除对象 + 清理清单 + 代理主站退还存储额度
//
// 注意：Pages Functions 的可选 catch-all 也会匹配 /api/files 本身，
// 因此列表与单文件逻辑统一收敛在本文件，避免与 index.ts 产生路由歧义。

import {
  contentDisposition,
  filenameFromKey,
  isAllowedKey,
  isAdminUser,
  keyFromParams,
  listAllObjects,
  userPrefix,
} from "../../lib/files";
import {
  isMetaKey,
  ownerPrefixOfKey,
  readManifest,
  writeManifest,
} from "../../lib/folders";
import {
  isAuthContext,
  OAuthUpstreamError,
  refundStorage,
  requireAuth,
} from "../../lib/oauth";
import { errorResponse, jsonResponse } from "../../lib/http";

function getParam(context: { params: unknown }): string | undefined {
  const raw = (context.params as { key?: string | string[] } | undefined)?.key;
  if (raw === undefined) return undefined;
  const joined = Array.isArray(raw) ? raw.join("/") : raw;
  return joined.length > 0 ? joined : undefined;
}

/* ---------------- GET /api/files：列表 ---------------- */

async function listFiles(context: { env: Env; request: Request }): Promise<Response> {
  const { env, request } = context;
  const auth = await requireAuth(request, env);
  if (!isAuthContext(auth)) return auth;
  const { session } = auth;

  const admin = isAdminUser(session.user, env);
  const prefix = admin ? undefined : userPrefix(session.user.sub);
  const objects = await listAllObjects(env.MY_BUCKET, prefix);

  // 过滤内部元数据对象，并按 owner 前缀合并文件夹清单
  const visible = objects.filter((object) => !isMetaKey(object.key));
  const prefixes = new Set<string>();
  for (const object of visible) {
    const ownerPrefix = ownerPrefixOfKey(object.key);
    if (ownerPrefix) prefixes.add(ownerPrefix);
  }
  if (prefixes.size === 0 && prefix) prefixes.add(prefix);

  const manifests = new Map<string, Awaited<ReturnType<typeof readManifest>>>();
  await Promise.all(
    Array.from(prefixes).map(async (ownerPrefix) => {
      manifests.set(ownerPrefix, await readManifest(env.MY_BUCKET, ownerPrefix));
    }),
  );

  const files = visible
    .map((object) => {
      const ownerPrefix = ownerPrefixOfKey(object.key);
      const manifest = ownerPrefix ? manifests.get(ownerPrefix) : undefined;
      return {
        key: object.key,
        filename: filenameFromKey(object.key),
        size: object.size,
        uploadedAt: object.uploaded.toISOString(),
        contentType: object.httpMetadata?.contentType ?? "application/octet-stream",
        folderId: (manifest?.files[object.key]?.folderId ?? null) as string | null,
      };
    })
    .sort((a, b) => (a.uploadedAt < b.uploadedAt ? 1 : -1));

  // 管理员的文件夹树取自己前缀的清单
  const adminManifest = manifests.get(userPrefix(session.user.sub));
  return jsonResponse({
    files,
    folders: adminManifest?.folders ?? [],
    isAdmin: admin,
  });
}

/* ---------------- GET /api/files/<key>：下载 / 预览 ---------------- */

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  const keyParam = getParam(context);
  if (!keyParam) return listFiles({ env, request });

  const auth = await requireAuth(request, env);
  if (!isAuthContext(auth)) return auth;
  const { session } = auth;

  const key = keyFromParams(keyParam);
  if (isMetaKey(key)) return errorResponse(403, "forbidden", "无权访问内部对象");
  const admin = isAdminUser(session.user, env);
  if (!isAllowedKey(key, session.user, admin)) {
    return errorResponse(403, "forbidden", "无权访问该文件");
  }

  const object = await env.MY_BUCKET.get(key);
  if (!object) return errorResponse(404, "not_found", "文件不存在或已被删除");

  const mode = new URL(request.url).searchParams.get("mode") === "preview" ? "inline" : "attachment";
  const headers = new Headers();
  headers.set("Content-Type", object.httpMetadata?.contentType ?? "application/octet-stream");
  headers.set("Content-Length", String(object.size));
  headers.set("Content-Disposition", contentDisposition(filenameFromKey(key), mode));
  headers.set("ETag", object.httpEtag);
  headers.set("Cache-Control", "private, no-store");

  return new Response(object.body, { status: 200, headers });
};

/* ---------------- DELETE /api/files/<key>：删除 + 清理清单 + 退额 ---------------- */

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const auth = await requireAuth(request, env);
  if (!isAuthContext(auth)) return auth;
  const { session } = auth;

  const keyParam = getParam(context);
  if (!keyParam) return errorResponse(400, "invalid_request", "缺少文件路径");
  const key = keyFromParams(keyParam);
  if (isMetaKey(key)) return errorResponse(403, "forbidden", "无权删除内部对象");
  const admin = isAdminUser(session.user, env);
  if (!isAllowedKey(key, session.user, admin)) {
    return errorResponse(403, "forbidden", "无权删除该文件");
  }

  // 1. 删除 R2 对象（幂等：对象不存在时同样成功）
  await env.MY_BUCKET.delete(key);

  // 2. 清理文件夹清单条目
  const ownerPrefix = ownerPrefixOfKey(key);
  if (ownerPrefix) {
    try {
      const manifest = await readManifest(env.MY_BUCKET, ownerPrefix);
      if (manifest.files[key]) {
        delete manifest.files[key];
        await writeManifest(env.MY_BUCKET, ownerPrefix, manifest);
      }
    } catch {
      /* 清理失败不影响删除本身 */
    }
  }

  // 3. 调主站退额接口（额度按主站实扣记账退还；对象已删时重试同样安全）
  try {
    const refund = await refundStorage(session.at, key);
    return jsonResponse({
      ok: true,
      deleted: true,
      refundedBytes: refund.refunded_bytes ?? 0,
      already: refund.already ?? false,
    });
  } catch (error) {
    if (error instanceof OAuthUpstreamError) {
      // 409 not_settled_yet：刚上传就删，主站队列未记账 → 稍后重试
      if (error.status === 409) {
        return jsonResponse({ ok: true, deleted: true, refundPending: true });
      }
      // 404/400：记录不存在或从未计入额度 → 无需退还，直接视为成功
      if (error.status === 404 || error.status === 400) {
        return jsonResponse({ ok: true, deleted: true, refundSkipped: true });
      }
      // 401：refresh 已不可用，需要重新登录后再次调用 DELETE 完成退额
      if (error.status === 401) {
        return errorResponse(401, "unauthorized", "登录已过期，请重新登录");
      }
    }
    // 其他错误（网络等）同样按 pending 处理：文件已删，额度以 quota 查询为准
    return jsonResponse({ ok: true, deleted: true, refundPending: true });
  }
};
