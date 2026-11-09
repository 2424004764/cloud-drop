// 分享令牌：HMAC-SHA256 签名的自包含 token（零数据库，到期自动失效）
// 格式: base64url(json payload) + "." + base64url(HMAC)
// payload: { k: object keys[], e?: 过期 epoch ms, u?: 分享者用户名, t: 签发时间 }

import { base64UrlDecode, base64UrlEncode } from "./session";
import { SHARES_PREFIX } from "./folders";

export interface SharePayload {
  /** 分享的 object key 列表 */
  k: string[];
  /** 过期时间（epoch ms），缺省 = 永久有效 */
  e?: number;
  /** 分享者用户名（仅用于落地页展示） */
  u?: string;
  /** 签发时间（epoch ms） */
  t: number;
}

/** 单个分享链接最多包含的文件数 */
export const SHARE_MAX_FILES = 50;

async function shareKey(env: Env): Promise<CryptoKey> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode("share:" + env.SESSION_SECRET),
  );
  return crypto.subtle.importKey("raw", digest, { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}

export async function createShareToken(env: Env, payload: SharePayload): Promise<string> {
  const key = await shareKey(env);
  const body = new TextEncoder().encode(JSON.stringify(payload));
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, body));
  return base64UrlEncode(body) + "." + base64UrlEncode(mac);
}

export async function verifyShareToken(env: Env, token: string): Promise<SharePayload | null> {
  const dot = token.indexOf(".");
  if (dot <= 0 || token.length > 32_768) return null;
  try {
    const body = base64UrlDecode(token.slice(0, dot));
    const mac = base64UrlDecode(token.slice(dot + 1));
    const key = await shareKey(env);
    const valid = await crypto.subtle.verify("HMAC", key, mac, body);
    if (!valid) return null;

    const payload = JSON.parse(new TextDecoder().decode(body)) as SharePayload;
    if (!Array.isArray(payload.k) || payload.k.length === 0 || payload.k.length > SHARE_MAX_FILES) {
      return null;
    }
    if (payload.e !== undefined && payload.e < Date.now()) return null;
    const keysOk = payload.k.every(
      (k) =>
        typeof k === "string" &&
        k.length > 0 &&
        k.length <= 1024 &&
        !k.startsWith("/") &&
        !k.includes(".."),
    );
    if (!keysOk) return null;
    return payload;
  } catch {
    return null;
  }
}

/* ---------------- 短链接：短 ID → 桶内映射记录 ---------------- */

const SHARE_ID_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
export const SHARE_ID_LENGTH = 10;

function randomShareId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(SHARE_ID_LENGTH));
  return Array.from(bytes, (b) => SHARE_ID_ALPHABET[b % SHARE_ID_ALPHABET.length]).join("");
}

/** 生成未占用短 ID 并写入映射记录，返回短 ID */
export async function createShareRecord(
  bucket: R2Bucket,
  token: string,
  expiresAt: number | null,
): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const id = randomShareId();
    const recordKey = `${SHARES_PREFIX}sh_${id}.json`;
    const existing = await bucket.head(recordKey);
    if (existing) continue; // 极小概率撞 ID，重试
    await bucket.put(
      recordKey,
      JSON.stringify({ v: 1, token, expiresAt }),
      { httpMetadata: { contentType: "application/json" } },
    );
    return id;
  }
  throw new Error("share_id_exhausted");
}

/** 由短 ID 读取映射记录，还原出分享令牌 */
export async function resolveShareId(bucket: R2Bucket, id: string): Promise<string | null> {
  if (!/^[A-Za-z0-9]{4,32}$/.test(id)) return null;
  try {
    const object = await bucket.get(`${SHARES_PREFIX}sh_${id}.json`);
    if (!object) return null;
    const record = (await object.json()) as { v?: number; token?: string };
    return typeof record?.token === "string" ? record.token : null;
  } catch {
    return null;
  }
}
