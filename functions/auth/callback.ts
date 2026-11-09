// GET /auth/callback — OAuth 回调：校验 state → 换令牌 → 拉 userinfo → 签发会话 Cookie → 回首页

import {
  exchangeAuthorizationCode,
  fetchUserInfo,
  OAuthUpstreamError,
} from "../lib/oauth";
import { parseCookies } from "../lib/http";
import {
  buildSessionCookie,
  clearSessionCookie,
  clearStateCookie,
  STATE_COOKIE,
  type SessionPayload,
} from "../lib/session";

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);
  const cookies = parseCookies(request);

  const fail = (message: string, alsoClearSession = false) => {
    const response = new Response(null, {
      status: 302,
      headers: {
        Location: `/?auth_error=${encodeURIComponent(message)}`,
        "Cache-Control": "no-store",
      },
    });
    response.headers.append("Set-Cookie", clearStateCookie(request));
    if (alsoClearSession) {
      response.headers.append("Set-Cookie", clearSessionCookie(request));
    }
    return response;
  };

  // 用户拒绝授权或其他上游错误
  const upstreamError = url.searchParams.get("error");
  if (upstreamError) {
    const description =
      url.searchParams.get("error_description") ?? "授权失败，请重试";
    return fail(description);
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) return fail("回调参数缺失，请重新登录");

  // CSRF 防护：state 必须与发起登录时写入的 Cookie 一致
  if (!cookies[STATE_COOKIE] || cookies[STATE_COOKIE] !== state) {
    return fail("安全校验失败（state 不匹配），请重新登录", true);
  }

  try {
    const tokens = await exchangeAuthorizationCode(env, request, code);
    const user = await fetchUserInfo(tokens.access_token);

    const payload: SessionPayload = {
      v: 1,
      user: {
        sub: user.sub,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
      },
      at: tokens.access_token,
      rt: tokens.refresh_token ?? "",
      accessExpiresAt: Date.now() + tokens.expires_in * 1000,
    };

    const response = new Response(null, {
      status: 302,
      headers: { Location: "/?login=ok", "Cache-Control": "no-store" },
    });
    response.headers.append("Set-Cookie", await buildSessionCookie(request, env, payload));
    response.headers.append("Set-Cookie", clearStateCookie(request));
    return response;
  } catch (error) {
    const message =
      error instanceof OAuthUpstreamError
        ? `登录失败：${error.description ?? error.code}`
        : "登录失败，请稍后重试";
    return fail(message, true);
  }
};
