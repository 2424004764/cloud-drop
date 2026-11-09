// 上传队列管理器：申请凭证 → 浏览器直传 R2 → 进度回调
// 并发 2，进度按 1% 步进节流通知，避免大文件高频 re-render

import { api, ApiError, putWithProgress } from "./api";
import { formatBytes } from "./format";

export type UploadStatus = "queued" | "preparing" | "uploading" | "success" | "error" | "canceled";

export interface UploadItem {
  id: number;
  name: string;
  size: number;
  status: UploadStatus;
  /** 0-100 */
  progress: number;
  error?: string;
}

const MAX_SINGLE_FILE = 500 * 1024 * 1024;
const CONCURRENCY = 2;

export class UploadManager {
  items: UploadItem[] = [];
  /** 每个文件成功后触发一次 */
  onUploaded?: () => void;
  /** 单文件失败时触发（带友好错误信息） */
  onFailed?: (message: string) => void;

  private seq = 0;
  private active = 0;
  private listeners = new Set<() => void>();
  private xhrs = new Map<number, XMLHttpRequest>();
  /** blob 存放处：不放进 React 状态，避免拷贝 */
  private blobs = new Map<number, { blob: Blob; contentType: string }>();
  /** 上传完成后要归入的文件夹 */
  private folderIds = new Map<number, string>();

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    this.items = [...this.items];
    this.listeners.forEach((fn) => fn());
  }

  enqueue(blob: Blob, name: string, contentType?: string, folderId?: string | null): void {
    if (blob.size > MAX_SINGLE_FILE) {
      this.onFailed?.(`「${name}」超过单文件 500MB 上限，已跳过`);
      return;
    }
    if (blob.size === 0) {
      this.onFailed?.(`「${name}」是空文件，已跳过`);
      return;
    }
    const id = ++this.seq;
    const type = (contentType || blob.type || "application/octet-stream").split(";")[0].trim();
    this.blobs.set(id, { blob, contentType: type });
    if (folderId) this.folderIds.set(id, folderId);
    this.items.push({
      id,
      name,
      size: blob.size,
      status: "queued",
      progress: 0,
    });
    this.emit();
    this.pump();
  }

  cancel(id: number): void {
    const item = this.items.find((i) => i.id === id);
    if (!item) return;
    if (item.status === "queued") {
      this.patch(id, { status: "canceled" });
      this.blobs.delete(id);
      this.emit();
      return;
    }
    this.xhrs.get(id)?.abort();
  }

  clearFinished(): void {
    const active = new Set(["queued", "preparing", "uploading"]);
    this.items = this.items.filter((i) => active.has(i.status));
    this.emit();
  }

  get activeCount(): number {
    return this.items.filter((i) =>
      ["queued", "preparing", "uploading"].includes(i.status),
    ).length;
  }

  get succeededCount(): number {
    return this.items.filter((i) => i.status === "success").length;
  }

  get failedCount(): number {
    return this.items.filter((i) => i.status === "error").length;
  }

  private patch(id: number, part: Partial<UploadItem>): void {
    const item = this.items.find((i) => i.id === id);
    if (!item) return;
    Object.assign(item, part);
    this.emit();
  }

  private pump(): void {
    while (this.active < CONCURRENCY) {
      const next = this.items.find((i) => i.status === "queued");
      if (!next) return;
      this.active += 1;
      void this.run(next.id).finally(() => {
        this.active -= 1;
        this.pump();
      });
    }
  }

  private async run(id: number): Promise<void> {
    const entry = this.blobs.get(id);
    const item = this.items.find((i) => i.id === id);
    if (!entry || !item) return;
    const { blob, contentType } = entry;

    this.patch(id, { status: "preparing", error: undefined });
    try {
      // 1. 向主站申请直传凭证（额度预扣）
      const credential = await api.credential({
        filename: item.name,
        bytes: blob.size,
        content_type: contentType,
      });

      // 2. 浏览器直传 R2（预签名 PUT，大小/类型均被签名锁定）
      this.patch(id, { status: "uploading" });
      let lastProgress = -1;
      await putWithProgress(
        credential.upload_url,
        blob,
        credential.content_type,
        (loaded, total) => {
          const percent = total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : 0;
          if (percent !== lastProgress) {
            lastProgress = percent;
            this.patch(id, { progress: percent });
          }
        },
        (xhr) => this.xhrs.set(id, xhr),
      );
      this.xhrs.delete(id);
      this.blobs.delete(id);

      // 归入目标文件夹（清单操作，瞬时完成；失败不阻塞上传结果）
      const folderId = this.folderIds.get(id);
      this.folderIds.delete(id);
      if (folderId) {
        await api
          .moveItems({ keys: [credential.object_key], folderId })
          .catch(() => undefined);
      }

      this.patch(id, { status: "success", progress: 100 });
      this.onUploaded?.();
    } catch (error) {
      this.xhrs.delete(id);
      this.blobs.delete(id);
      this.patch(id, { status: "error", error: this.describeError(error, item.size) });
      this.onFailed?.(this.describeError(error, item.size));
    }
  }

  private describeError(error: unknown, size: number): string {
    if (error instanceof ApiError) {
      if (error.status === 401) return "登录已过期，请重新登录";
      if (error.code === "quota_exceeded") {
        const remaining = Number(error.data?.remaining_bytes ?? 0);
        return `存储额度不足：本文件 ${formatBytes(size)}，剩余可用 ${formatBytes(remaining)}`;
      }
      if (error.code === "upload_not_enabled") return "该 OAuth 应用未开通直传（主站后台未登记 R2 桶）";
      if (error.code === "insufficient_scope") return "缺少存储授权，请重新登录并同意存储权限";
      return error.message;
    }
    return error instanceof Error ? error.message : "上传失败";
  }
}
