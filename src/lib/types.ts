export interface CloudUser {
  sub: string;
  username: string;
  email?: string | null;
  avatar?: string | null;
}

export interface Quota {
  quota_bytes: number;
  used_bytes: number;
  pending_bytes: number;
  remaining_bytes: number;
  price?: { credits: number; bytes: number };
}

export interface QuotaScopeError {
  insufficient_scope: true;
}

export interface FolderNode {
  id: string;
  name: string;
  parentId: string | null;
}

export interface CloudFile {
  key: string;
  filename: string;
  size: number;
  uploadedAt: string;
  contentType: string;
  folderId: string | null;
}

export interface UploadCredential {
  upload_id: string;
  upload_url: string;
  bucket: string;
  object_key: string;
  bytes: number;
  content_type: string;
  expires_at?: string;
  expires_in?: number;
}

export interface DeleteResult {
  ok: boolean;
  deleted?: boolean;
  refundedBytes?: number;
  already?: boolean;
  refundPending?: boolean;
  refundSkipped?: boolean;
}

export interface ShareCreateResult {
  ok: boolean;
  /** 8 位短码，分享链接形如 /s/<shareId> */
  shareId: string;
  /** 旧版自包含令牌（保留字段，前端不使用） */
  token?: string;
  expiresAt: number | null;
  count: number;
  files: string[];
}

export type FileKind = "text" | "image" | "archive" | "pdf" | "audio" | "video" | "other";

export type KindFilter = "all" | FileKind;

export type SortKey = "newest" | "oldest" | "largest" | "smallest" | "name";
