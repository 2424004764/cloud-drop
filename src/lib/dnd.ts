// 页面内部拖拽（移动文件/文件夹）的数据交换协议
// 注意：全局上传拖拽由 types 中的 "Files" 触发，内部拖拽只携带自定义 MIME，互不干扰

import type { DragEvent } from "react";

export const DND_MIME = "application/x-clouddrop-items";

export interface DragPayload {
  keys: string[];
  folderIds: string[];
}

export function setDragPayload(event: DragEvent, payload: DragPayload): void {
  try {
    event.dataTransfer.setData(DND_MIME, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
  event.dataTransfer.effectAllowed = "move";
}

export function hasDragPayload(event: DragEvent): boolean {
  return Array.from(event.dataTransfer.types ?? []).includes(DND_MIME);
}

export function getDragPayload(event: DragEvent): DragPayload | null {
  try {
    const raw = event.dataTransfer.getData(DND_MIME);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DragPayload;
    if (!Array.isArray(parsed.keys) || !Array.isArray(parsed.folderIds)) return null;
    if (parsed.keys.length === 0 && parsed.folderIds.length === 0) return null;
    return parsed;
  } catch {
    return null;
  }
}
