// POST /api/folders — 新建文件夹（写入当前用户的清单）

import { userPrefix } from "../../lib/files";
import {
  newFolderId,
  readManifest,
  sanitizeFolderName,
  writeManifest,
} from "../../lib/folders";
import { isAuthContext, requireAuth } from "../../lib/oauth";
import { errorResponse, jsonResponse, readJsonBody } from "../../lib/http";

interface CreateBody {
  name?: string;
  parentId?: string | null;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const auth = await requireAuth(request, env);
  if (!isAuthContext(auth)) return auth;
  const { session } = auth;

  const body = await readJsonBody<CreateBody>(request);
  const name = sanitizeFolderName(String(body?.name ?? ""));
  if (!name) return errorResponse(400, "invalid_request", "文件夹名称不能为空");

  const prefix = userPrefix(session.user.sub);
  const manifest = await readManifest(env.MY_BUCKET, prefix);

  const parentId = body?.parentId ?? null;
  if (parentId !== null) {
    if (typeof parentId !== "string" || !manifest.folders.some((f) => f.id === parentId)) {
      return errorResponse(400, "invalid_request", "目标父文件夹不存在");
    }
  }

  // 同级不允许重名
  const siblingNames = manifest.folders
    .filter((f) => f.parentId === parentId)
    .map((f) => f.name);
  if (siblingNames.includes(name)) {
    return errorResponse(400, "invalid_request", "同级已存在同名文件夹");
  }

  const folder = { id: newFolderId(), name, parentId: parentId as string | null };
  manifest.folders.push(folder);
  await writeManifest(env.MY_BUCKET, prefix, manifest);

  return jsonResponse({ ok: true, folder, folders: manifest.folders });
};
