// POST /api/move — 批量移动文件/文件夹到目标文件夹（root = null）
// 文件移动只改清单，不搬数据；跨用户（管理员）操作会写入文件所属前缀的清单。

import { isAllowedKey, isAdminUser, userPrefix } from "../lib/files";
import {
  descendantIds,
  ownerPrefixOfKey,
  readManifest,
  writeManifest,
} from "../lib/folders";
import { isAuthContext, requireAuth } from "../lib/oauth";
import { errorResponse, jsonResponse, readJsonBody } from "../lib/http";

interface MoveBody {
  keys?: unknown;
  folderIds?: unknown;
  folderId?: unknown;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const auth = await requireAuth(request, env);
  if (!isAuthContext(auth)) return auth;
  const { session } = auth;

  const body = await readJsonBody<MoveBody>(request);
  if (!body) return errorResponse(400, "invalid_request", "缺少参数");

  const keys = Array.isArray(body.keys) ? body.keys.filter((k): k is string => typeof k === "string" && k.length > 0) : [];
  const folderIds = Array.isArray(body.folderIds)
    ? body.folderIds.filter((f): f is string => typeof f === "string" && f.length > 0)
    : [];
  if (keys.length === 0 && folderIds.length === 0) {
    return errorResponse(400, "invalid_request", "请提供要移动的文件或文件夹");
  }

  const admin = isAdminUser(session.user, env);
  const ownPrefix = userPrefix(session.user.sub);

  // 目标文件夹必须存在于用户自己的清单
  const ownManifest = await readManifest(env.MY_BUCKET, ownPrefix);
  let targetFolderId: string | null = null;
  if (body.folderId !== null && body.folderId !== undefined) {
    if (typeof body.folderId !== "string" || !ownManifest.folders.some((f) => f.id === body.folderId)) {
      return errorResponse(400, "invalid_request", "目标文件夹不存在");
    }
    targetFolderId = body.folderId;
  }

  // 文件夹移动：防自嵌套/防移入后代
  for (const folderId of folderIds) {
    const folder = ownManifest.folders.find((f) => f.id === folderId);
    if (!folder) return errorResponse(400, "invalid_request", "待移动的文件夹不存在");
    if (folderId === targetFolderId) {
      return errorResponse(400, "invalid_request", "不能将文件夹移动到自身");
    }
    if (targetFolderId && descendantIds(ownManifest.folders, folderId).has(targetFolderId)) {
      return errorResponse(400, "invalid_request", "不能将文件夹移动到自己的子文件夹内");
    }
  }

  // 文件归属校验
  for (const key of keys) {
    if (ownerPrefixOfKey(key) === null || !isAllowedKey(key, session.user, admin)) {
      return errorResponse(403, "forbidden", "包含无权操作的文件");
    }
  }

  // 执行文件夹移动
  if (folderIds.length > 0) {
    for (const folderId of folderIds) {
      const folder = ownManifest.folders.find((f) => f.id === folderId)!;
      folder.parentId = targetFolderId;
    }
    await writeManifest(env.MY_BUCKET, ownPrefix, ownManifest);
  }

  // 执行文件移动（按文件所属前缀分组更新各自清单）
  const byPrefix = new Map<string, string[]>();
  for (const key of keys) {
    const ownerPrefix = ownerPrefixOfKey(key) ?? ownPrefix;
    const list = byPrefix.get(ownerPrefix) ?? [];
    list.push(key);
    byPrefix.set(ownerPrefix, list);
  }
  await Promise.all(
    Array.from(byPrefix.entries()).map(async ([ownerPrefix, prefixKeys]) => {
      const manifest =
        ownerPrefix === ownPrefix ? ownManifest : await readManifest(env.MY_BUCKET, ownerPrefix);
      for (const key of prefixKeys) {
        manifest.files[key] = { folderId: targetFolderId };
      }
      await writeManifest(env.MY_BUCKET, ownerPrefix, manifest);
    }),
  );

  return jsonResponse({ ok: true, moved: { files: keys.length, folders: folderIds.length } });
};
