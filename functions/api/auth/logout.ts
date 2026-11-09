// POST /api/auth/logout — 撤销主站令牌并清除会话 Cookie

import { revokeToken } from "../../lib/oauth";
import { jsonResponse } from "../../lib/http";
import { clearSessionCookie, readSessionFromRequest } from "../../lib/session";

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const session = await readSessionFromRequest(request, env);

  if (session) {
    // access_token 与 refresh_token 都尝试撤销（尽力而为）
    await revokeToken(env, session.at);
    if (session.rt) await revokeToken(env, session.rt);
  }

  const response = jsonResponse({ ok: true });
  response.headers.append("Set-Cookie", clearSessionCookie(request));
  return response;
};
