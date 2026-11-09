// 虚拟文件夹清单：每个用户一份 folders.json，存于自己前缀下的 __meta 目录
// 对象 key 由主站签发的上传凭证决定（含 upload_id，不可变更），
// 因此文件归属文件夹的关系记录在清单里，移动 = 改清单，零数据拷贝、零额度影响。

// R2Bucket 类型由 @cloudflare/workers-types 全局提供

export interface FolderNode {
  id: string;
  name: string;
  parentId: string | null;
}

export interface Manifest {
  v: 1;
  folders: FolderNode[];
  /** object key -> 归属文件夹（null = 根目录） */
  files: Record<string, { folderId: string | null }>;
}

export const EMPTY_MANIFEST: Manifest = { v: 1, folders: [], files: {} };

export const META_SEGMENT = "__meta";
/** 短分享链接的映射记录前缀（桶根目录） */
export const SHARES_PREFIX = "__shares/";

/** 依据 owner 前缀（subsite/<uid>/）计算清单对象 key */
export function manifestKeyForPrefix(prefix: string): string {
  return `${prefix}${META_SEGMENT}/folders.json`;
}

/** 从 object key 反推 owner 前缀（subsite/<uid>/），不匹配返回 null */
export function ownerPrefixOfKey(key: string): string | null {
  const match = key.match(/^subsite\/([^/]+)\//);
  return match ? `subsite/${match[1]}/` : null;
}

/** 是否为内部清单/元数据 key（不应出现在列表、分享、下载中） */
export function isMetaKey(key: string): boolean {
  return key.includes(`/${META_SEGMENT}/`) || key.startsWith(SHARES_PREFIX);
}

export async function readManifest(bucket: R2Bucket, prefix: string): Promise<Manifest> {
  try {
    const object = await bucket.get(manifestKeyForPrefix(prefix));
    if (!object) return EMPTY_MANIFEST;
    const text = await object.text();
    const parsed = JSON.parse(text) as Manifest;
    if (parsed?.v !== 1 || !Array.isArray(parsed.folders) || typeof parsed.files !== "object") {
      return EMPTY_MANIFEST;
    }
    return parsed;
  } catch {
    return EMPTY_MANIFEST;
  }
}

export async function writeManifest(bucket: R2Bucket, prefix: string, manifest: Manifest): Promise<void> {
  await bucket.put(manifestKeyForPrefix(prefix), JSON.stringify(manifest), {
    httpMetadata: { contentType: "application/json" },
  });
}

/** 生成文件夹 ID */
export function newFolderId(): string {
  return crypto.randomUUID();
}

/** 清洗文件夹名：去路径分隔符与控制字符，限长 */
export function sanitizeFolderName(name: string): string {
  const cleaned = (name ?? "")
    .replace(/[\\/]/g, " ")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, 80);
  return cleaned;
}

/** 收集 folderId 的全部后代（不含自身），用于防环 */
export function descendantIds(folders: FolderNode[], rootId: string): Set<string> {
  const childrenOf = new Map<string, string[]>();
  for (const folder of folders) {
    if (folder.parentId) {
      const list = childrenOf.get(folder.parentId) ?? [];
      list.push(folder.id);
      childrenOf.set(folder.parentId, list);
    }
  }
  const out = new Set<string>();
  const stack = [rootId];
  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const child of childrenOf.get(current) ?? []) {
      if (!out.has(child)) {
        out.add(child);
        stack.push(child);
      }
    }
  }
  return out;
}
