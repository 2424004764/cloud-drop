// 会话管理：AES-GCM 加密的 HttpOnly Cookie，零数据库
// Cookie 内容: base64url(iv || ciphertext) ，密钥由 SESSION_SECRET 派生

import { parseCookies } from "./http";

export const SESSION_COOKIE = "cd_session";
export const STATE_COOKIE = "cd_oauth_state";

// 与主站 refresh_token 生命周期（30 天）对齐
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30;
// OAuth state 防 CSRF，10 分钟有效
export const STATE_MAX_AGE = 600;

export interface SessionUser {
  sub: string;
  username: string;
  email?: string;
  avatar?: string;
}

export interface SessionPayload {
  v: 1;
  user: SessionUser;
  /** 主站 access_token（用于代理调用主站接口） */
  at: string;
  /** 主站 refresh_token（轮换制） */
  rt: string;
  /** access_token 过期时间（epoch ms） */
  accessExpiresAt: number;
}

/* ---------------- base64url ---------------- */

export function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function base64UrlDecode(text: string): Uint8Array {
  const b64 = text.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/* ---------------- 加密 / 解密 ---------------- */

async function importSessionKey(secret: string): Promise<CryptoKey> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

export async function sealSession(env: Env, payload: SessionPayload): Promise<string> {
  const key = await importSessionKey(env.SESSION_SECRET);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(payload));
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext));
  const combined = new Uint8Array(iv.length + cipher.length);
  combined.set(iv, 0);
  combined.set(cipher, iv.length);
  return base64UrlEncode(combined);
}

export async function openSession(env: Env, token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const key = await importSessionKey(env.SESSION_SECRET);
    const combined = base64UrlDecode(token);
    if (combined.length <= 12) return null;
    const iv = combined.slice(0, 12);
    const cipher = combined.slice(12);
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, cipher);
    const payload = JSON.parse(new TextDecoder().decode(plain)) as SessionPayload;
    if (payload?.v !== 1 || typeof payload.at !== "string") return null;
    return payload;
  } catch {
    return null;
  }
}

/* ---------------- Cookie ---------------- */

export function isSecureRequest(request: Request): boolean {
  try {
    return new URL(request.url).protocol === "https:";
  } catch {
    return false;
  }
}

export async function buildSessionCookie(
  request: Request,
  env: Env,
  payload: SessionPayload,
  maxAge = SESSION_MAX_AGE,
): Promise<string> {
  const token = await sealSession(env, payload);
  const secure = isSecureRequest(request) ? "; Secure" : "";
  return `${SESSION_COOKIE}=${token}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${secure}`;
}

export function clearSessionCookie(request: Request): string {
  const secure = isSecureRequest(request) ? "; Secure" : "";
  return `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${secure}`;
}

export function buildStateCookie(request: Request, state: string): string {
  const secure = isSecureRequest(request) ? "; Secure" : "";
  return `${STATE_COOKIE}=${state}; Path=/; Max-Age=${STATE_MAX_AGE}; HttpOnly; SameSite=Lax${secure}`;
}

export function clearStateCookie(request: Request): string {
  const secure = isSecureRequest(request) ? "; Secure" : "";
  return `${STATE_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${secure}`;
}

export async function readSessionFromRequest(request: Request, env: Env): Promise<SessionPayload | null> {
  const cookies = parseCookies(request);
  return openSession(env, cookies[SESSION_COOKIE]);
}

/** 会话是否有效（access_token 未过期） */
export function isSessionUsable(payload: SessionPayload): boolean {
  return payload.accessExpiresAt > Date.now();
}
