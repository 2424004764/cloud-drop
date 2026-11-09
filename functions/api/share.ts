// POST /api/share — 为选中文件创建公开分享链接
// 服务端校验文件归属后签发 HMAC 分享令牌；接收方无需登录，通过 /s/<token> 访问

import { isAdminUser, filenameFromKey } from "../lib/files";
import { isMetaKey } from "../lib/folders";
import { isAuthContext, requireAuth } from "../lib/oauth";
import { errorResponse, jsonResponse, readJsonBody } from "../lib/http";
import { createShareToken, createShareRecord, SHARE_MAX_FILES } from "../lib/share";

interface ShareBody {
  keys?: unknown;
  expiresIn?: unknown;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const auth = await requireAuth(request, env);
  if (!isAuthContext(auth)) return auth;
  const { session } = auth;

  const body = await readJsonBody<ShareBody>(request);
  if (!body || !Array.isArray(body.keys) || body.keys.length === 0) {
    return errorResponse(400, "invalid_request", "请选择要分享的文件");
  }
  if (body.keys.length > SHARE_MAX_FILES) {
    return errorResponse(400, "invalid_request", `单次最多分享 ${SHARE_MAX_FILES} 个文件`);
  }

  const keys = body.keys.filter((k): k is string => typeof k === "string" && k.length > 0);
  if (keys.length !== body.keys.length) {
    return errorResponse(400, "invalid_request", "文件列表不合法");
  }

  // 归属校验：普通用户只能分享自己前缀下的文件（管理员可分享全部）；内部元数据不可分享
  const admin = isAdminUser(session.user, env);
  for (const key of keys) {
    if (isMetaKey(key)) {
      return errorResponse(403, "forbidden", "包含不可分享的对象");
    }
    if (!admin && !key.startsWith(`subsite/${session.user.sub}/`)) {
      return errorResponse(403, "forbidden", "包含无权分享的文件");
    }
  }

  let expiresAt: number | undefined;
  if (body.expiresIn !== null && body.expiresIn !== undefined) {
    if (typeof body.expiresIn !== "number" || !Number.isInteger(body.expiresIn)) {
      return errorResponse(400, "invalid_request", "有效期不合法");
    }
    if (body.expiresIn < 60 || body.expiresIn > 31_536_000) {
      return errorResponse(400, "invalid_request", "有效期需在 1 分钟到 365 天之间");
    }
    expiresAt = Date.now() + body.expiresIn * 1000;
  }

  const token = await createShareToken(env, {
    k: keys,
    e: expiresAt,
    u: session.user.username,
    t: Date.now(),
  });

  // 写入短 ID 映射记录（桶内 __shares/，公开链接只带 8 位短码）
  let shareId: string;
  try {
    shareId = await createShareRecord(env.MY_BUCKET, token, expiresAt ?? null);
  } catch {
    return errorResponse(502, "share_record_failed", "生成短链接失败，请重试");
  }

  return jsonResponse({
    ok: true,
    shareId,
    token,
    expiresAt: expiresAt ?? null,
    count: keys.length,
    // 供前端即时展示的文件名列表
    files: keys.map((k) => filenameFromKey(k)),
  });
};
