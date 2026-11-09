import type {
  CloudFile,
  CloudUser,
  DeleteResult,
  FolderNode,
  Quota,
  QuotaScopeError,
  ShareCreateResult,
  UploadCredential,
} from "./types";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public data?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function toApiError(response: Response): Promise<ApiError> {
  let code = `http_${response.status}`;
  let message = `请求失败（HTTP ${response.status}）`;
  let data: Record<string, unknown> | undefined;
  try {
    const body = (await response.json()) as Record<string, unknown>;
    data = body;
    if (typeof body.error === "string") code = body.error;
    if (typeof body.message === "string" && body.message) message = body.message;
  } catch {
    /* 非 JSON 响应 */
  }
  return new ApiError(response.status, code, message, data);
}

/** 401 时自动走一次「刷新会话 → 重试」；刷新全程串行化，避免 refresh_token 轮换竞态 */
let refreshing: Promise<CloudUser | null> | null = null;

async function request<T>(url: string, init?: RequestInit, allowRetry = true): Promise<T> {
  const response = await fetch(url, { credentials: "same-origin", ...init });
  if (response.status === 401 && allowRetry && !url.startsWith("/api/auth/")) {
    refreshing ??= fetchSession().finally(() => {
      refreshing = null;
    });
    const user = await refreshing;
    if (!user) throw new ApiError(401, "unauthorized", "登录已过期，请重新登录");
    return request<T>(url, init, false);
  }
  if (!response.ok) throw await toApiError(response);
  return (await response.json()) as T;
}

/* ---------------- URL 辅助 ---------------- */

export function encodeKey(key: string): string {
  return key.split("/").map(encodeURIComponent).join("/");
}

export function previewUrl(key: string): string {
  return `/api/files/${encodeKey(key)}?mode=preview`;
}

export function downloadUrl(key: string): string {
  return `/api/files/${encodeKey(key)}?mode=download`;
}

/** 分享落地页地址（短码） */
export function sharePageUrl(shareId: string): string {
  return `${window.location.origin}/s/${shareId}`;
}

/* ---------------- API ---------------- */

export interface SessionInfo {
  user: CloudUser;
  quota: (Quota & Partial<QuotaScopeError>) | null;
  isAdmin: boolean;
}

async function fetchSession(): Promise<CloudUser | null> {
  try {
    const res = await fetch("/api/auth/session", { credentials: "same-origin" });
    if (!res.ok) return null;
    const body = (await res.json()) as SessionInfo;
    return body.user;
  } catch {
    return null;
  }
}

export const api = {
  async session(): Promise<SessionInfo | null> {
    try {
      return await request<SessionInfo>("/api/auth/session", undefined, false);
    } catch {
      return null;
    }
  },

  logout(): Promise<{ ok: boolean }> {
    return request<{ ok: boolean }>("/api/auth/logout", { method: "POST" });
  },

  files(): Promise<{ files: CloudFile[]; folders: FolderNode[]; isAdmin: boolean }> {
    return request<{ files: CloudFile[]; folders: FolderNode[]; isAdmin: boolean }>("/api/files");
  },

  createFolder(name: string, parentId: string | null): Promise<{ ok: boolean; folder: FolderNode; folders: FolderNode[] }> {
    return request("/api/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, parentId }),
    });
  },

  patchFolder(
    id: string,
    patch: { name?: string; parentId?: string | null },
  ): Promise<{ ok: boolean; folder: FolderNode; folders: FolderNode[] }> {
    return request(`/api/folders/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
  },

  deleteFolder(id: string): Promise<{ ok: boolean; folders: FolderNode[]; filesAffected: number }> {
    return request(`/api/folders/${encodeURIComponent(id)}`, { method: "DELETE" });
  },

  moveItems(payload: { keys?: string[]; folderIds?: string[]; folderId: string | null }): Promise<{
    ok: boolean;
    moved: { files: number; folders: number };
  }> {
    return request("/api/move", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  },

  quota(): Promise<Quota> {
    return request<Quota>("/api/quota");
  },

  credential(payload: {
    filename: string;
    bytes: number;
    content_type: string;
  }): Promise<UploadCredential> {
    return request<UploadCredential>("/api/upload/credential", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  },

  deleteFile(key: string): Promise<DeleteResult> {
    return request<DeleteResult>(`/api/files/${encodeKey(key)}`, { method: "DELETE" });
  },

  createShare(keys: string[], expiresIn: number | null): Promise<ShareCreateResult> {
    return request<ShareCreateResult>("/api/share", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keys, expiresIn }),
    });
  },

  async fetchText(key: string): Promise<string> {
    const response = await fetch(previewUrl(key), { credentials: "same-origin" });
    if (!response.ok) throw await toApiError(response);
    return response.text();
  },
};

/* ---------------- 带进度的直传（XHR） ---------------- */

export function putWithProgress(
  url: string,
  blob: Blob,
  contentType: string,
  onProgress?: (loaded: number, total: number) => void,
  onXhr?: (xhr: XMLHttpRequest) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    onXhr?.(xhr);
    xhr.open("PUT", url, true);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(event.loaded, event.total);
    };
    xhr.onload = () => {
      if (xhr.status === 200 || xhr.status === 204) {
        resolve();
        return;
      }
      let message = `上传失败（HTTP ${xhr.status}）`;
      if (xhr.status === 403) message = "上传被 R2 拒绝：文件大小或类型与凭证不符，请重试";
      if (xhr.status === 0) message = "网络错误，上传中断";
      reject(new Error(message));
    };
    xhr.onerror = () => reject(new Error("网络错误，上传中断"));
    xhr.onabort = () => reject(new Error("上传已取消"));
    xhr.send(blob);
  });
}
