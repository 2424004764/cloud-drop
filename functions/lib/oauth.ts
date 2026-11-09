// 一方工具箱 OAuth2 客户端 + 鉴权辅助
// 文档: https://tool.fologde.com/oauth/docs/

import { errorResponse } from "./http";
import {
  buildSessionCookie,
  readSessionFromRequest,
  type SessionPayload,
} from "./session";

export const MAIN_SITE = "https://tool.fologde.com";
export const OAUTH_SCOPE = "profile storage";

export interface OAuthTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
}

export interface OAuthUser {
  sub: string;
  id?: string;
  username: string;
  email?: string;
  avatar?: string;
  created_at?: string;
}

export interface StorageQuota {
  sub?: string;
  quota_bytes: number;
  used_bytes: number;
  pending_bytes: number;
  remaining_bytes: number;
  price?: { credits: number; bytes: number };
}

export interface UploadCredentialResponse {
  ok: boolean;
  upload_id: string;
  upload_url: string;
  bucket: string;
  object_key: string;
  bytes: number;
  content_type: string;
  expires_at?: string;
  expires_in?: number;
}

export interface RefundResponse {
  ok: boolean;
  refunded_bytes?: number;
  already?: boolean;
}

/** 主站返回错误时抛出，携带 HTTP 状态与 RFC 6749/6750 错误码 */
export class OAuthUpstreamError extends Error {
  constructor(
    public status: number,
    public code: string,
    public description?: string,
    public data?: Record<string, unknown>,
  ) {
    super(description ?? code);
    this.name = "OAuthUpstreamError";
  }
}

/* ---------------- 基础请求 ---------------- */

async function upstreamFetch(url: string, init: RequestInit): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(url, { ...init, signal: AbortSignal.timeout(15_000) });
  } catch {
    throw new OAuthUpstreamError(502, "upstream_unreachable", "无法连接统一登录服务");
  }
  return response;
}

async function parseUpstream<T>(response: Response): Promise<T> {
  let body: Record<string, unknown> = {};
  try {
    body = (await response.json()) as Record<string, unknown>;
  } catch {
    /* ignore */
  }
  if (!response.ok) {
    const code = typeof body.error === "string" ? body.error : `http_${response.status}`;
    const description =
      typeof body.error_description === "string"
        ? body.error_description
        : typeof body.message === "string"
          ? body.message
          : undefined;
    throw new OAuthUpstreamError(response.status, code, description, body);
  }
  return body as T;
}

/* ---------------- OAuth 流程 ---------------- */

export function resolveRedirectUri(request: Request, env: Env): string {
  if (env.OAUTH_REDIRECT_URI) return env.OAUTH_REDIRECT_URI;
  return new URL(request.url).origin + "/auth/callback";
}

export function buildAuthorizeUrl(request: Request, env: Env, state: string): string {
  const url = new URL(`${MAIN_SITE}/oauth/authorize`);
  url.searchParams.set("client_id", env.OAUTH_CLIENT_ID);
  url.searchParams.set("redirect_uri", resolveRedirectUri(request, env));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", state);
  url.searchParams.set("scope", OAUTH_SCOPE);
  return url.toString();
}

export function randomState(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function tokenEndpoint(env: Env, params: Record<string, string>): Promise<OAuthTokenResponse> {
  const body = new URLSearchParams(params);
  const response = await upstreamFetch(`${MAIN_SITE}/api/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  return parseUpstream<OAuthTokenResponse>(response);
}

export function exchangeAuthorizationCode(
  env: Env,
  request: Request,
  code: string,
): Promise<OAuthTokenResponse> {
  return tokenEndpoint(env, {
    grant_type: "authorization_code",
    code,
    redirect_uri: resolveRedirectUri(request, env),
    client_id: env.OAUTH_CLIENT_ID,
    client_secret: env.OAUTH_CLIENT_SECRET,
  });
}

export function refreshAccessToken(env: Env, refreshToken: string): Promise<OAuthTokenResponse> {
  return tokenEndpoint(env, {
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: env.OAUTH_CLIENT_ID,
    client_secret: env.OAUTH_CLIENT_SECRET,
  });
}

/* ---------------- 资源端点 ---------------- */

async function bearerJson<T>(
  path: string,
  accessToken: string,
  init?: RequestInit,
): Promise<T> {
  const response = await upstreamFetch(`${MAIN_SITE}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${accessToken}`, ...(init?.headers ?? {}) },
  });
  return parseUpstream<T>(response);
}

export function fetchUserInfo(accessToken: string): Promise<OAuthUser> {
  return bearerJson<OAuthUser>("/api/oauth/userinfo", accessToken);
}

export function fetchStorageQuota(accessToken: string): Promise<StorageQuota> {
  return bearerJson<StorageQuota>("/api/oauth/storage-quota", accessToken);
}

export function requestUploadCredential(
  accessToken: string,
  payload: { filename: string; bytes: number; content_type?: string },
): Promise<UploadCredentialResponse> {
  return bearerJson<UploadCredentialResponse>("/api/oauth/storage-upload-credential", accessToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function refundStorage(
  accessToken: string,
  objectKey: string,
): Promise<RefundResponse> {
  return bearerJson<RefundResponse>("/api/oauth/storage-refund", accessToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ object_key: objectKey }),
  });
}

/** 退出登录：撤销令牌（尽力而为，无论结果都视为成功） */
export async function revokeToken(env: Env, token: string): Promise<void> {
  try {
    const body = new URLSearchParams({
      token,
      client_id: env.OAUTH_CLIENT_ID,
      client_secret: env.OAUTH_CLIENT_SECRET,
    });
    await upstreamFetch(`${MAIN_SITE}/api/oauth/revoke`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
  } catch {
    /* 忽略撤销失败 */
  }
}

/* ---------------- API 鉴权 ---------------- */

export interface AuthContext {
  session: SessionPayload;
  /** 若发生过令牌刷新，需要附加到响应的 Set-Cookie */
  setCookie?: string;
}

/**
 * 仅校验会话有效性（不自动刷新）。
 * 其他 API 使用该函数：过期时返回 401，由前端引导走
 * /api/auth/session（带刷新）后重试，串行化避免 refresh_token 轮换竞态。
 */
export async function requireAuth(request: Request, env: Env): Promise<AuthContext | Response> {
  const session = await readSessionFromRequest(request, env);
  if (!session || !isSessionUsableLocal(session)) {
    return errorResponse(401, "unauthorized", "登录已过期，请重新登录");
  }
  return { session };
}

function isSessionUsableLocal(payload: SessionPayload): boolean {
  return payload.accessExpiresAt > Date.now();
}

/**
 * 校验会话并在 access_token 即将过期时静默刷新（轮换 refresh_token）。
 * 仅 /api/auth/session 使用。
 */
export async function requireAuthWithRefresh(
  request: Request,
  env: Env,
): Promise<AuthContext | Response> {
  const current = await readSessionFromRequest(request, env);
  if (!current) return errorResponse(401, "unauthorized", "未登录或登录已过期");

  const marginMs = 120_000;
  if (current.accessExpiresAt - Date.now() > marginMs) {
    return { session: current };
  }

  if (!current.rt) {
    return errorResponse(401, "unauthorized", "登录已过期，请重新登录");
  }

  try {
    const tokens = await refreshAccessToken(env, current.rt);
    const next: SessionPayload = {
      v: 1,
      user: current.user,
      at: tokens.access_token,
      rt: tokens.refresh_token ?? current.rt,
      accessExpiresAt: Date.now() + tokens.expires_in * 1000,
    };
    return { session: next, setCookie: await buildSessionCookie(request, env, next) };
  } catch {
    return errorResponse(401, "unauthorized", "登录已过期，请重新登录");
  }
}

export function isAuthContext(value: AuthContext | Response): value is AuthContext {
  return !(value instanceof Response);
}

/** 若刷新过令牌，把新会话 Cookie 附加到响应上 */
export function withAuthCookie<T extends Response>(response: T, auth: AuthContext): T {
  if (auth.setCookie) {
    response.headers.append("Set-Cookie", auth.setCookie);
  }
  return response;
}
