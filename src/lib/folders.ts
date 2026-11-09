// 文件夹树工具（前端）

import type { FolderNode } from "./types";

export function folderChildren(folders: FolderNode[], parentId: string | null): FolderNode[] {
  return folders
    .filter((f) => f.parentId === parentId)
    .sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
}

/** 从根到该文件夹的链路（含自身） */
export function folderChain(folders: FolderNode[], id: string | null): FolderNode[] {
  const chain: FolderNode[] = [];
  let cursor = id;
  const guard = new Set<string>();
  while (cursor) {
    if (guard.has(cursor)) break; // 防环
    guard.add(cursor);
    const folder = folders.find((f) => f.id === cursor);
    if (!folder) break;
    chain.unshift(folder);
    cursor = folder.parentId;
  }
  return chain;
}

/** 路径标签："工作 / 2026"；根目录返回 null */
export function folderPathLabel(folders: FolderNode[], id: string | null): string | null {
  if (!id) return null;
  const chain = folderChain(folders, id);
  if (chain.length === 0) return null;
  return chain.map((f) => f.name).join(" / ");
}

/** 全部后代 id（不含自身） */
export function descendantIds(folders: FolderNode[], rootId: string): Set<string> {
  const out = new Set<string>();
  const stack = [rootId];
  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const folder of folders) {
      if (folder.parentId === current && !out.has(folder.id)) {
        out.add(folder.id);
        stack.push(folder.id);
      }
    }
  }
  return out;
}

/** 树形展开的行（用于移动弹窗） */
export interface FolderTreeRow {
  folder: FolderNode;
  depth: number;
}

export function flattenFolderTree(folders: FolderNode[]): FolderTreeRow[] {
  const rows: FolderTreeRow[] = [];
  const walk = (parentId: string | null, depth: number) => {
    for (const folder of folderChildren(folders, parentId)) {
      rows.push({ folder, depth });
      walk(folder.id, depth + 1);
    }
  };
  walk(null, 0);
  return rows;
}
