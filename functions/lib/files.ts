// R2 文件工具：用户隔离、参数解析、遍历列举

export function userPrefix(sub: string): string {
  return `subsite/${sub}/`;
}

export interface MinimalUser {
  sub: string;
  username: string;
}

/** 管理员：env.ADMIN_USERS 逗号分隔的用户名或用户ID */
export function isAdminUser(user: MinimalUser, env: Env): boolean {
  const list = (env.ADMIN_USERS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.toLowerCase());
  if (list.length === 0) return false;
  return list.includes(user.username.toLowerCase()) || list.includes(user.sub.toLowerCase());
}

/** 是否允许访问该 object key（管理员放行全部，普通用户仅限自己的前缀） */
export function isAllowedKey(key: string, user: MinimalUser, admin: boolean): boolean {
  return admin || key.startsWith(userPrefix(user.sub));
}

/** 路由参数还原 object key（兼容 %编码 与 数组形式） */
export function keyFromParams(raw: string | string[] | undefined): string {
  const joined = Array.isArray(raw) ? raw.join("/") : String(raw ?? "");
  return joined
    .split("/")
    .map((seg) => {
      try {
        return decodeURIComponent(seg);
      } catch {
        return seg;
      }
    })
    .join("/");
}

/** 从 object key 提取文件名（最后一段，保留中文等 unicode） */
export function filenameFromKey(key: string): string {
  const last = key.split("/").pop() ?? key;
  try {
    return decodeURIComponent(last);
  } catch {
    return last;
  }
}

/** 遍历分页取全部对象（R2 单页最多 1000 条） */
export async function listAllObjects(
  bucket: R2Bucket,
  prefix?: string,
  maxPages = 20,
): Promise<R2Object[]> {
  const out: R2Object[] = [];
  let cursor: string | undefined;
  for (let i = 0; i < maxPages; i++) {
    const page = await bucket.list({
      prefix,
      cursor,
      include: ["customMetadata", "httpMetadata"],
    });
    out.push(...page.objects);
    if (!page.truncated || !page.cursor) break;
    cursor = page.cursor;
  }
  return out;
}

/** RFC 5987 Content-Disposition（支持中文文件名） */
export function contentDisposition(filename: string, type: "inline" | "attachment"): string {
  const asciiFallback =
    filename.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_") || "file";
  const encoded = encodeURIComponent(filename)
    .replace(/['()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase())
    .replace(/%(7C|60|5E)/g, (c) => c);
  return `${type}; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
}

/** 上传凭证用的文件名清洗：只取最后一段路径，去掉控制字符 */
export function sanitizeFilename(name: string): string {
  const last = name.split(/[\\/]/).pop() ?? "";
  const cleaned = last.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return (cleaned || "file").slice(0, 255);
}
