// GET /api/auth/session — 获取当前登录用户 + 存储额度（唯一会自动刷新令牌的入口）

import {
  fetchStorageQuota,
  isAuthContext,
  OAuthUpstreamError,
  requireAuthWithRefresh,
  withAuthCookie,
} from "../../lib/oauth";
import { isAdminUser } from "../../lib/files";
import { jsonResponse } from "../../lib/http";

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const auth = await requireAuthWithRefresh(request, env);
  if (!isAuthContext(auth)) return auth;
  const { session } = auth;

  let quota = null;
  try {
    quota = await fetchStorageQuota(session.at);
  } catch (error) {
    // 缺 storage scope 或主站不可达时不阻塞登录态返回
    if (error instanceof OAuthUpstreamError && error.status === 403) {
      quota = { insufficient_scope: true };
    }
  }

  const response = jsonResponse({
    user: {
      sub: session.user.sub,
      username: session.user.username,
      email: session.user.email ?? null,
      avatar: session.user.avatar ?? null,
    },
    quota,
    isAdmin: isAdminUser(session.user, env),
  });
  return withAuthCookie(response, auth);
};
