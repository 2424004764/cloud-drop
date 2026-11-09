// GET /auth/login — 生成 state 并 302 到工具站授权页

import { buildAuthorizeUrl, randomState } from "../lib/oauth";
import { buildStateCookie } from "../lib/session";

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const state = randomState();
  const target = buildAuthorizeUrl(request, env, state);

  const response = new Response(null, {
    status: 302,
    headers: { Location: target, "Cache-Control": "no-store" },
  });
  response.headers.append("Set-Cookie", buildStateCookie(request, state));
  return response;
};
