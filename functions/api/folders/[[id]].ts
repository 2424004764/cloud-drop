// /api/folders/<id> — 文件夹重命名 / 移动 / 删除（删除时内容上移到父级）

import { userPrefix } from "../../lib/files";
import {
  descendantIds,
  readManifest,
  sanitizeFolderName,
  writeManifest,
} from "../../lib/folders";
import { isAuthContext, requireAuth } from "../../lib/oauth";
import { errorResponse, jsonResponse, readJsonBody } from "../../lib/http";

interface PatchBody {
  name?: string;
  parentId?: string | null;
}

export const onRequestPatch: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const auth = await requireAuth(request, env);
  if (!isAuthContext(auth)) return auth;
  const { session } = auth;

  const rawId = (context.params as { id?: string | string[] } | undefined)?.id;
  const id = Array.isArray(rawId) ? rawId.join("/") : String(rawId ?? "");

  const prefix = userPrefix(session.user.sub);
  const manifest = await readManifest(env.MY_BUCKET, prefix);
  const folder = manifest.folders.find((f) => f.id === id);
  if (!folder) return errorResponse(404, "not_found", "文件夹不存在");

  const body = await readJsonBody<PatchBody>(request);
  if (!body) return errorResponse(400, "invalid_request", "缺少参数");

  if (body.name !== undefined) {
    const name = sanitizeFolderName(String(body.name ?? ""));
    if (!name) return errorResponse(400, "invalid_request", "文件夹名称不能为空");
    const siblingNames = manifest.folders
      .filter((f) => f.parentId === folder.parentId && f.id !== id)
      .map((f) => f.name);
    if (siblingNames.includes(name)) {
      return errorResponse(400, "invalid_request", "同级已存在同名文件夹");
    }
    folder.name = name;
  }

  if (body.parentId !== undefined) {
    const parentId = body.parentId;
    if (parentId === id) {
      return errorResponse(400, "invalid_request", "不能将文件夹移动到自身");
    }
    if (parentId !== null) {
      if (typeof parentId !== "string" || !manifest.folders.some((f) => f.id === parentId)) {
        return errorResponse(400, "invalid_request", "目标父文件夹不存在");
      }
      if (descendantIds(manifest.folders, id).has(parentId)) {
        return errorResponse(400, "invalid_request", "不能将文件夹移动到自己的子文件夹内");
      }
    }
    folder.parentId = parentId as string | null;
  }

  await writeManifest(env.MY_BUCKET, prefix, manifest);
  return jsonResponse({ ok: true, folder, folders: manifest.folders });
};

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { env } = context;
  const auth = await requireAuth(context.request, env);
  if (!isAuthContext(auth)) return auth;
  const { session } = auth;

  const rawId = (context.params as { id?: string | string[] } | undefined)?.id;
  const id = Array.isArray(rawId) ? rawId.join("/") : String(rawId ?? "");

  const prefix = userPrefix(session.user.sub);
  const manifest = await readManifest(env.MY_BUCKET, prefix);
  const folder = manifest.folders.find((f) => f.id === id);
  if (!folder) return errorResponse(404, "not_found", "文件夹不存在");

  const parentId = folder.parentId;

  // 内容策略：子文件夹与文件全部上移到被删文件夹的父级（安全、可恢复）
  const doomed = new Set([id, ...descendantIds(manifest.folders, id)]);
  let filesAffected = 0;
  for (const [key, placement] of Object.entries(manifest.files)) {
    if (placement.folderId && doomed.has(placement.folderId)) {
      manifest.files[key] = { folderId: parentId };
      filesAffected += 1;
    }
  }
  manifest.folders = manifest.folders.filter((f) => !doomed.has(f.id));

  await writeManifest(env.MY_BUCKET, prefix, manifest);
  return jsonResponse({ ok: true, folders: manifest.folders, filesAffected });
};
