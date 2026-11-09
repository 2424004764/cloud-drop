// GET /api/quota — 代理主站存储额度查询

import {
  fetchStorageQuota,
  isAuthContext,
  OAuthUpstreamError,
  requireAuth,
} from "../lib/oauth";
import { errorResponse, jsonResponse } from "../lib/http";

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const auth = await requireAuth(request, env);
  if (!isAuthContext(auth)) return auth;

  try {
    const quota = await fetchStorageQuota(auth.session.at);
    return jsonResponse(quota);
  } catch (error) {
    if (error instanceof OAuthUpstreamError) {
      if (error.status === 401) {
        return errorResponse(401, "unauthorized", "登录已过期，请重新登录");
      }
      if (error.status === 403) {
        return errorResponse(
          403,
          "insufficient_scope",
          "当前授权缺少存储权限（storage scope），请重新登录并同意授权",
        );
      }
      return errorResponse(502, "upstream_error", error.description ?? "获取额度失败");
    }
    return errorResponse(502, "upstream_error", "获取额度失败");
  }
};
