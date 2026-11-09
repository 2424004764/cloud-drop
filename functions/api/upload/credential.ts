// POST /api/upload/credential — 代理主站申请「子站直传上传凭证」
// 前端拿到 upload_url 后携带文件直传 R2（额度由主站签发时预扣）

import {
  isAuthContext,
  OAuthUpstreamError,
  requestUploadCredential,
  requireAuth,
} from "../../lib/oauth";
import { sanitizeFilename } from "../../lib/files";
import { errorResponse, jsonResponse, readJsonBody } from "../../lib/http";

const MAX_SINGLE_FILE = 500 * 1024 * 1024; // 与主站单文件上限一致

interface CredentialBody {
  filename?: string;
  bytes?: number;
  content_type?: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const auth = await requireAuth(request, env);
  if (!isAuthContext(auth)) return auth;

  const body = await readJsonBody<CredentialBody>(request);
  if (!body || typeof body.bytes !== "number" || !Number.isFinite(body.bytes)) {
    return errorResponse(400, "invalid_request", "缺少文件大小信息");
  }
  if (!Number.isInteger(body.bytes) || body.bytes <= 0) {
    return errorResponse(400, "invalid_request", "文件大小不合法");
  }
  if (body.bytes > MAX_SINGLE_FILE) {
    return errorResponse(400, "invalid_request", "单文件最大 500MB");
  }

  const filename = sanitizeFilename(String(body.filename ?? ""));
  const contentType =
    typeof body.content_type === "string" && body.content_type.trim()
      ? body.content_type.trim()
      : "application/octet-stream";

  try {
    const credential = await requestUploadCredential(auth.session.at, {
      filename,
      bytes: body.bytes,
      content_type: contentType,
    });
    return jsonResponse(credential);
  } catch (error) {
    if (error instanceof OAuthUpstreamError) {
      // 透传主站错误（402 quota_exceeded 附带 remaining_bytes / need_bytes）
      return errorResponse(
        error.status === 502 ? 502 : error.status,
        error.code,
        error.description,
        error.data,
      );
    }
    return errorResponse(502, "upstream_error", "申请上传凭证失败");
  }
};
