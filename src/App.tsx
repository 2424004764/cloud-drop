import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CloudUpload } from "lucide-react";
import { api, ApiError, putWithProgress, downloadUrl } from "./lib/api";
import type { CloudFile, CloudUser, FolderNode, KindFilter, Quota, SortKey } from "./lib/types";
import { kindOf } from "./lib/kind";
import { defaultPasteFilename } from "./lib/format";
import { folderChain, folderChildren, descendantIds, folderPathLabel } from "./lib/folders";
import type { DragPayload } from "./lib/dnd";
import { useUploader } from "./hooks/useUploader";
import { useGlobalDrop, useFileDropper } from "./hooks/useGlobalDrop";
import { useTheme } from "./hooks/useTheme";
import { useToast } from "./components/Toast";
import { LoginScreen } from "./components/LoginScreen";
import { TopBar } from "./components/TopBar";
import { UploadZone } from "./components/UploadZone";
import { Toolbar } from "./components/Toolbar";
import { QuotaChip } from "./components/QuotaChip";
import { Breadcrumbs } from "./components/Breadcrumbs";
import { FolderCard } from "./components/FolderCard";
import { FileCard } from "./components/FileCard";
import { FileList } from "./components/FileList";
import { EmptyState, GridSkeleton } from "./components/EmptyState";
import { GlobalDropOverlay } from "./components/GlobalDropOverlay";
import { SelectionBar } from "./components/SelectionBar";
import { ShareDialog } from "./components/ShareDialog";
import { MoveDialog } from "./components/MoveDialog";
import { FolderDialog } from "./components/FolderDialog";
import { TextPreviewModal } from "./components/TextPreviewModal";
import { MediaPreviewModal } from "./components/MediaPreviewModal";
import { ConfirmDeleteDialog } from "./components/ConfirmDeleteDialog";
import { UploadsPanel } from "./components/UploadsPanel";
import { PasteModal } from "./components/PasteModal";

const BATCH_CONCURRENCY = 3;
const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

function sortFiles(list: CloudFile[], sort: SortKey): CloudFile[] {
  const sorted = [...list];
  switch (sort) {
    case "newest":
      sorted.sort((a, b) => (a.uploadedAt < b.uploadedAt ? 1 : -1));
      break;
    case "oldest":
      sorted.sort((a, b) => (a.uploadedAt > b.uploadedAt ? 1 : -1));
      break;
    case "largest":
      sorted.sort((a, b) => b.size - a.size);
      break;
    case "smallest":
      sorted.sort((a, b) => a.size - b.size);
      break;
    case "name":
      sorted.sort((a, b) => a.filename.localeCompare(b.filename, "zh-CN"));
      break;
  }
  return sorted;
}

export default function App() {
  const { toast } = useToast();
  const { theme, toggleTheme } = useTheme();

  /* ---------------- 登录态与数据 ---------------- */
  const [booting, setBooting] = useState(true);
  const [user, setUser] = useState<CloudUser | null>(null);
  const [quota, setQuota] = useState<Quota | null>(null);
  const [quotaScopeError, setQuotaScopeError] = useState(false);
  const [quotaLoading, setQuotaLoading] = useState(false);
  const [files, setFiles] = useState<CloudFile[] | null>(null);
  const [folders, setFolders] = useState<FolderNode[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);

  /* ---------------- 浏览位置与筛选 ---------------- */
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [sort, setSort] = useState<SortKey>("newest");
  const [view, setView] = useState<"grid" | "list">(() =>
    localStorage.getItem("clouddrop-view") === "list" ? "list" : "grid",
  );

  /* ---------------- 多选与批量操作 ---------------- */
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [selectedFolderIds, setSelectedFolderIds] = useState<Set<string>>(new Set());
  const [shareFiles, setShareFiles] = useState<CloudFile[] | null>(null);
  const [batchBusy, setBatchBusy] = useState(false);

  /* ---------------- 弹窗状态 ---------------- */
  const [previewFile, setPreviewFile] = useState<CloudFile | null>(null);
  const [confirmFiles, setConfirmFiles] = useState<CloudFile[] | null>(null);
  const [confirmFolders, setConfirmFolders] = useState<FolderNode[] | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [pasteText, setPasteText] = useState<string | null>(null);
  const [pasteUploading, setPasteUploading] = useState(false);
  const [moveTarget, setMoveTarget] = useState<{ keys: string[]; folderIds: string[] } | null>(null);
  const [folderDialog, setFolderDialog] = useState<
    { mode: "create"; parentId: string | null } | { mode: "rename"; folder: FolderNode } | null
  >(null);
  const [folderDialogBusy, setFolderDialogBusy] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const refundTimersRef = useRef<number[]>([]);

  /* ---------------- 上传 ---------------- */
  const refreshTimer = useRef<number | undefined>(undefined);
  const debouncedRefresh = useCallback(() => {
    window.clearTimeout(refreshTimer.current);
    refreshTimer.current = window.setTimeout(() => {
      void refreshFiles();
      void refreshQuota();
    }, 700);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { items: uploadItems, manager: uploadManager } = useUploader(
    debouncedRefresh,
    useCallback((message: string) => toast("error", message), [toast]),
  );
  const enqueue = useCallback(
    (blob: Blob, name: string, contentType?: string) => {
      // 全局搜索时定位语境不明确，落到根目录
      uploadManager.enqueue(blob, name, contentType, search.trim() ? null : currentFolderId);
    },
    [uploadManager, currentFolderId, search],
  );
  const handlePickedFiles = useFileDropper(enqueue);
  const dropActive = useGlobalDrop(!!user && !booting, handlePickedFiles);

  /* ---------------- 数据加载 ---------------- */
  const handleAuthError = useCallback(
    (error: unknown) => {
      if (error instanceof ApiError && error.status === 401) {
        setUser(null);
        setFiles(null);
        return;
      }
      toast("error", error instanceof Error ? error.message : "请求失败");
    },
    [toast],
  );

  const refreshFiles = useCallback(async () => {
    try {
      const result = await api.files();
      setFiles(result.files);
      setFolders(result.folders);
      setIsAdmin(result.isAdmin);
      // 修剪选择集：已被删除的文件/文件夹自动移出多选
      setSelectedKeys((prev) => {
        if (prev.size === 0) return prev;
        const next = new Set<string>();
        result.files.forEach((f) => {
          if (prev.has(f.key)) next.add(f.key);
        });
        return next;
      });
      setSelectedFolderIds((prev) => {
        if (prev.size === 0) return prev;
        const next = new Set<string>();
        result.folders.forEach((f) => {
          if (prev.has(f.id)) next.add(f.id);
        });
        return next;
      });
    } catch (error) {
      handleAuthError(error);
    }
  }, [handleAuthError]);

  const refreshQuota = useCallback(async () => {
    setQuotaLoading(true);
    try {
      setQuota(await api.quota());
      setQuotaScopeError(false);
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 401) {
          setUser(null);
        } else if (error.code === "insufficient_scope") {
          setQuotaScopeError(true);
        }
      }
    } finally {
      setQuotaLoading(false);
    }
  }, [handleAuthError]);

  const reauthorize = useCallback(() => {
    window.location.href = "/auth/login";
  }, []);

  /* ---------------- 启动 ---------------- */
  useEffect(() => {
    void (async () => {
      const query = new URLSearchParams(window.location.search);
      const loginOk = query.get("login");
      const authError = query.get("auth_error");
      if (loginOk || authError) {
        window.history.replaceState({}, "", window.location.pathname);
      }

      const session = await api.session();
      if (session) {
        setUser(session.user);
        setIsAdmin(session.isAdmin);
        if (session.quota && !("insufficient_scope" in session.quota)) {
          setQuota(session.quota);
        } else if (session.quota && "insufficient_scope" in session.quota) {
          setQuotaScopeError(true);
        }
        void refreshFiles();
      }
      if (loginOk) toast("success", "登录成功，欢迎回来");
      if (authError) toast("error", authError);
      setBooting(false);
    })();
    return () => {
      window.clearTimeout(refreshTimer.current);
      refundTimersRef.current.forEach((t) => window.clearTimeout(t));
      refundTimersRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------- 全局快捷键 ---------------- */
  useEffect(() => {
    if (!user) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "/") return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
      ) {
        return;
      }
      event.preventDefault();
      searchInputRef.current?.focus();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [user]);

  /* ---------------- Ctrl+V 粘贴上传 ---------------- */
  const modalOpenRef = useRef(false);
  modalOpenRef.current =
    !!previewFile ||
    !!confirmFiles ||
    !!confirmFolders ||
    pasteText !== null ||
    !!shareFiles ||
    !!moveTarget ||
    !!folderDialog;

  useEffect(() => {
    if (!user) return;
    const onPaste = (event: ClipboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable ||
          modalOpenRef.current)
      ) {
        return;
      }
      const data = event.clipboardData;
      if (!data) return;

      const clipboardFiles: File[] = [];
      for (const item of Array.from(data.items)) {
        if (item.kind === "file") {
          const file = item.getAsFile();
          if (file) clipboardFiles.push(file);
        }
      }
      if (clipboardFiles.length > 0) {
        event.preventDefault();
        clipboardFiles.forEach((file) => enqueue(file, file.name, file.type));
        toast("info", `已从剪贴板添加 ${clipboardFiles.length} 个文件，开始上传`);
        return;
      }

      const text = data.getData("text/plain");
      if (text && text.trim()) {
        event.preventDefault();
        setPasteText(text);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [user, enqueue, toast]);

  /* ---------------- 视图数据计算 ---------------- */
  const searching = search.trim() !== "";

  const foldersHere = useMemo(
    () => folderChildren(folders, currentFolderId),
    [folders, currentFolderId],
  );

  const filesInView = useMemo(() => {
    let list = files ?? [];
    if (!searching) {
      list = list.filter((f) => f.folderId === currentFolderId);
    }
    const keyword = search.trim().toLowerCase();
    if (keyword) {
      list = list.filter((f) => f.filename.toLowerCase().includes(keyword));
    }
    if (kindFilter !== "all") {
      list = list.filter((f) => kindOf(f.filename) === kindFilter);
    }
    return sortFiles(list, searching ? "newest" : sort);
  }, [files, currentFolderId, searching, search, kindFilter, sort]);

  const displayFolders = searching ? [] : foldersHere;
  const displayFiles = filesInView;

  const totalSize = useMemo(
    () => displayFiles.reduce((sum, file) => sum + file.size, 0),
    [displayFiles],
  );

  const selectedFiles = useMemo(
    () => (files ?? []).filter((f) => selectedKeys.has(f.key)),
    [files, selectedKeys],
  );
  const selectedFolders = useMemo(
    () => folders.filter((f) => selectedFolderIds.has(f.id)),
    [folders, selectedFolderIds],
  );

  const visibleItemCount = displayFiles.length + displayFolders.length;
  const allVisibleSelected =
    visibleItemCount > 0 &&
    displayFiles.every((f) => selectedKeys.has(f.key)) &&
    displayFolders.every((f) => selectedFolderIds.has(f.id));
  const anyVisibleSelected =
    displayFiles.some((f) => selectedKeys.has(f.key)) ||
    displayFolders.some((f) => selectedFolderIds.has(f.id));

  const breadcrumbPath = useMemo(
    () => folderChain(folders, currentFolderId),
    [folders, currentFolderId],
  );

  const changeView = useCallback((next: "grid" | "list") => {
    setView(next);
    try {
      localStorage.setItem("clouddrop-view", next);
    } catch {
      /* ignore */
    }
  }, []);

  const locationLabelOf = useCallback(
    (file: CloudFile) => folderPathLabel(folders, file.folderId),
    [folders],
  );

  /* ---------------- 多选操作 ---------------- */
  const toggleSelect = useCallback((file: CloudFile) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(file.key)) next.delete(file.key);
      else next.add(file.key);
      return next;
    });
  }, []);

  const toggleSelectFolder = useCallback((folder: FolderNode) => {
    setSelectedFolderIds((prev) => {
      const next = new Set(prev);
      if (next.has(folder.id)) next.delete(folder.id);
      else next.add(folder.id);
      return next;
    });
  }, []);

  const toggleSelectAllVisible = useCallback(() => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (displayFiles.length > 0 && displayFiles.every((f) => next.has(f.key))) {
        displayFiles.forEach((f) => next.delete(f.key));
      } else {
        displayFiles.forEach((f) => next.add(f.key));
      }
      return next;
    });
    setSelectedFolderIds((prev) => {
      const next = new Set(prev);
      if (displayFolders.length > 0 && displayFolders.every((f) => next.has(f.id))) {
        displayFolders.forEach((f) => next.delete(f.id));
      } else {
        displayFolders.forEach((f) => next.add(f.id));
      }
      return next;
    });
  }, [displayFiles, displayFolders]);

  const clearSelection = useCallback(() => {
    setSelectedKeys(new Set());
    setSelectedFolderIds(new Set());
  }, []);

  /* ---------------- 拖拽移动 ---------------- */
  const buildFileDragPayload = useCallback(
    (file: CloudFile): DragPayload | null => {
      if (selectedKeys.has(file.key) && selectedKeys.size + selectedFolderIds.size > 1) {
        return { keys: [...selectedKeys], folderIds: [...selectedFolderIds] };
      }
      return { keys: [file.key], folderIds: [] };
    },
    [selectedKeys, selectedFolderIds],
  );

  const buildFolderDragPayload = useCallback(
    (folder: FolderNode): DragPayload | null => {
      if (selectedFolderIds.has(folder.id) && selectedKeys.size + selectedFolderIds.size > 1) {
        return { keys: [...selectedKeys], folderIds: [...selectedFolderIds] };
      }
      return { keys: [], folderIds: [folder.id] };
    },
    [selectedFolderIds, selectedKeys],
  );

  const canDropTo = useCallback(
    (target: string | null, payload: DragPayload): boolean => {
      for (const folderId of payload.folderIds) {
        if (folderId === target) return false;
        if (target && descendantIds(folders, folderId).has(target)) return false;
      }
      return true;
    },
    [folders],
  );

  const handleDropMove = useCallback(
    async (target: string | null, payload: DragPayload) => {
      // 过滤已在目标位置的项
      const keys = payload.keys.filter((key) => {
        const file = (files ?? []).find((f) => f.key === key);
        return file ? file.folderId !== target : true;
      });
      const folderIds = payload.folderIds.filter((folderId) => {
        const folder = folders.find((f) => f.id === folderId);
        return folder ? folder.parentId !== target : true;
      });
      if (keys.length === 0 && folderIds.length === 0) {
        toast("info", "所选内容已在该文件夹中");
        return;
      }
      try {
        await api.moveItems({ keys, folderIds, folderId: target });
        toast("success", `已移动 ${keys.length + folderIds.length} 项`);
        void refreshFiles();
      } catch (error) {
        toast("error", error instanceof Error ? error.message : "移动失败");
      }
    },
    [files, folders, toast, refreshFiles],
  );

  /* ---------------- 删除（文件 + 文件夹） ---------------- */
  const scheduleRefundRetry = useCallback(
    (keys: string[]) => {
      if (keys.length === 0) return;
      const timer = window.setTimeout(() => {
        void (async () => {
          for (const key of keys) {
            await api.deleteFile(key).catch(() => undefined);
          }
          void refreshQuota();
        })();
      }, 35_000);
      refundTimersRef.current.push(timer);
    },
    [refreshQuota],
  );

  const removeFromState = useCallback((keys: string[]) => {
    const keySet = new Set(keys);
    setFiles((prev) => (prev ? prev.filter((f) => !keySet.has(f.key)) : prev));
    setSelectedKeys((prev) => {
      if (prev.size === 0) return prev;
      const next = new Set(prev);
      keys.forEach((k) => next.delete(k));
      return next;
    });
  }, []);

  const performDelete = useCallback(
    async (targets: CloudFile[]) => {
      if (targets.length === 0) return;
      setDeleting(true);
      try {
        if (targets.length === 1) {
          const file = targets[0];
          const result = await api.deleteFile(file.key);
          if (result.refundPending) {
            toast("info", "已删除。主站正在结算额度，约 1 分钟后自动退还（将自动重试确认）");
            scheduleRefundRetry([file.key]);
          } else if (result.refundedBytes && result.refundedBytes > 0) {
            toast("success", `已删除「${file.filename}」，退还 ${humanSize(result.refundedBytes)} 额度`);
          } else {
            toast("success", `已删除「${file.filename}」`);
          }
          removeFromState([file.key]);
        } else {
          const queue = [...targets];
          const pendingKeys: string[] = [];
          let succeeded = 0;
          let failed = 0;
          const workers = Array.from({ length: Math.min(BATCH_CONCURRENCY, queue.length) }, async () => {
            for (;;) {
              const file = queue.shift();
              if (!file) return;
              try {
                const result = await api.deleteFile(file.key);
                if (result.refundPending) pendingKeys.push(file.key);
                succeeded += 1;
                removeFromState([file.key]);
              } catch (error) {
                if (error instanceof ApiError && error.status === 401) {
                  queue.length = 0;
                  throw error;
                }
                failed += 1;
              }
            }
          });
          try {
            await Promise.all(workers);
          } catch {
            handleAuthError(new ApiError(401, "unauthorized", "登录已过期，请重新登录"));
          }
          if (failed === 0) {
            toast("success", `已删除 ${succeeded} 个文件${pendingKeys.length > 0 ? "，额度结算中" : ""}`);
          } else if (succeeded > 0) {
            toast("error", `删除完成：成功 ${succeeded} 个，失败 ${failed} 个`);
          } else {
            toast("error", "删除失败，请重试");
          }
          if (pendingKeys.length > 0) {
            toast("info", "部分文件的额度将在主站结算后自动退还");
            scheduleRefundRetry(pendingKeys);
          }
          void refreshQuota();
        }
      } catch (error) {
        if (error instanceof ApiError && error.status === 403) {
          toast("error", "包含无权删除的文件");
        } else {
          handleAuthError(error);
        }
      } finally {
        setDeleting(false);
        setConfirmFiles(null);
      }
    },
    [toast, refreshQuota, scheduleRefundRetry, removeFromState, handleAuthError],
  );

  const performFolderDelete = useCallback(
    async (targets: FolderNode[]) => {
      if (targets.length === 0) return;
      setDeleting(true);
      try {
        let filesAffected = 0;
        const doomed = new Set<string>();
        for (const folder of targets) {
          doomed.add(folder.id);
          descendantIds(folders, folder.id).forEach((id) => doomed.add(id));
        }
        // 若当前正位于被删文件夹内，先记下要回退到的位置
        const deletedParents = targets.map((t) => t.parentId ?? null);
        for (const folder of targets) {
          const result = await api.deleteFolder(folder.id);
          filesAffected += result.filesAffected;
        }
        setFolders((prev) => prev.filter((f) => !doomed.has(f.id)));
        if (currentFolderId && doomed.has(currentFolderId)) {
          setCurrentFolderId(deletedParents[0] ?? null);
        }
        setSelectedFolderIds(new Set());
        toast(
          "success",
          `已删除 ${targets.length} 个文件夹${filesAffected > 0 ? `，${filesAffected} 个文件移至上一级` : ""}`,
        );
        void refreshFiles();
      } catch (error) {
        toast("error", error instanceof Error ? error.message : "删除文件夹失败");
      } finally {
        setDeleting(false);
        setConfirmFolders(null);
      }
    },
    [folders, currentFolderId, toast, refreshFiles],
  );

  const handleConfirmDeletion = useCallback(() => {
    if (confirmFolders && confirmFolders.length > 0) {
      void performFolderDelete(confirmFolders);
      return;
    }
    if (confirmFiles && confirmFiles.length > 0) {
      void performDelete(confirmFiles);
    }
  }, [confirmFolders, confirmFiles, performFolderDelete, performDelete]);

  /* ---------------- 批量下载 ---------------- */
  const batchDownload = useCallback(async () => {
    if (selectedFiles.length === 0) {
      toast("info", "文件夹不支持直接下载，请选择文件");
      return;
    }
    setBatchBusy(true);
    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        const anchor = document.createElement("a");
        anchor.href = downloadUrl(file.key);
        anchor.download = file.filename;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        if (i < selectedFiles.length - 1) await sleep(600);
      }
      toast("info", `已触发 ${selectedFiles.length} 个下载；若被浏览器拦截，请允许"多个文件下载"`);
    } finally {
      setBatchBusy(false);
    }
  }, [selectedFiles, toast]);

  /* ---------------- 文件夹 CRUD ---------------- */
  const submitFolderDialog = useCallback(
    async (name: string) => {
      if (!folderDialog) return;
      setFolderDialogBusy(true);
      try {
        if (folderDialog.mode === "create") {
          const result = await api.createFolder(name, folderDialog.parentId);
          setFolders(result.folders);
          toast("success", `已创建文件夹「${result.folder.name}」`);
        } else {
          const result = await api.patchFolder(folderDialog.folder.id, { name });
          setFolders(result.folders);
          toast("success", "已重命名");
        }
        setFolderDialog(null);
      } catch (error) {
        toast("error", error instanceof Error ? error.message : "操作失败");
      } finally {
        setFolderDialogBusy(false);
      }
    },
    [folderDialog, toast],
  );

  const submitMoveFolder = useCallback(
    async (folder: FolderNode, parentId: string | null) => {
      try {
        const result = await api.patchFolder(folder.id, { parentId });
        setFolders(result.folders);
        void refreshFiles();
        toast("success", `「${folder.name}」已移动`);
      } catch (error) {
        toast("error", error instanceof Error ? error.message : "移动失败");
      }
    },
    [toast, refreshFiles],
  );

  /* ---------------- 文本编辑保存 ---------------- */
  const saveTextFile = useCallback(
    async (file: CloudFile, content: string): Promise<boolean> => {
      const blob = new Blob([content], { type: "text/plain" });
      try {
        const credential = await api.credential({
          filename: file.filename,
          bytes: blob.size,
          content_type: "text/plain",
        });
        await putWithProgress(credential.upload_url, blob, credential.content_type);
        // 新版本归入原文件所在文件夹
        if (file.folderId) {
          await api.moveItems({ keys: [credential.object_key], folderId: file.folderId }).catch(() => undefined);
        }
        await api.deleteFile(file.key);
        toast("success", `「${file.filename}」已保存为新版本`);
        void refreshFiles();
        void refreshQuota();
        return true;
      } catch (error) {
        if (error instanceof ApiError && error.code === "quota_exceeded") {
          toast("error", `存储额度不足，无法保存（需要 ${humanSize(blob.size)}）`);
        } else {
          toast("error", error instanceof Error ? error.message : "保存失败，请重试");
        }
        return false;
      }
    },
    [toast, refreshFiles, refreshQuota],
  );

  /* ---------------- 粘贴文本确认上传 ---------------- */
  const confirmPasteUpload = useCallback(
    (name: string, text: string) => {
      setPasteUploading(true);
      const blob = new Blob([text], { type: "text/plain" });
      const filename = name.toLowerCase().endsWith(".txt") ? name : `${name}.txt`;
      uploadManager.enqueue(blob, filename, "text/plain", search.trim() ? null : currentFolderId);
      setPasteText(null);
      setPasteUploading(false);
      toast("info", "已加入上传队列");
    },
    [uploadManager, currentFolderId, search, toast],
  );

  /* ---------------- 退出登录 ---------------- */
  const handleLogout = useCallback(async () => {
    setUser(null);
    setFiles(null);
    setQuota(null);
    setPreviewFile(null);
    setConfirmFiles(null);
    setConfirmFolders(null);
    setPasteText(null);
    setSelectedKeys(new Set());
    setSelectedFolderIds(new Set());
    setShareFiles(null);
    setMoveTarget(null);
    setFolderDialog(null);
    setCurrentFolderId(null);
  }, []);

  /* ---------------- 渲染 ---------------- */
  if (booting) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 animate-pulse items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 shadow-lg shadow-indigo-500/25">
            <CloudUpload className="h-6 w-6 text-white" />
          </div>
          <span className="text-xs text-muted-foreground">正在进入 Cloud Drop…</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  const previewKind = previewFile ? kindOf(previewFile.filename) : null;
  const isMediaPreview = previewKind === "image" || previewKind === "pdf";
  const selectionCount = selectedFiles.length + selectedFolders.length;
  const showSelectionBar = !deleting && selectionCount > 0;

  const parentLabelForDialog =
    folderDialog?.mode === "create"
      ? folderDialog.parentId
        ? folders.find((f) => f.id === folderDialog.parentId)?.name ?? null
        : null
      : null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-96 bg-[radial-gradient(ellipse_65%_50%_at_50%_-12%,hsl(var(--primary)/0.09),transparent)]"
      />

      <GlobalDropOverlay active={dropActive} />

      <TopBar
        user={user}
        search={search}
        onSearchChange={setSearch}
        theme={theme}
        onToggleTheme={toggleTheme}
        onLogout={handleLogout}
        searchInputRef={searchInputRef}
      />

      <main className="mx-auto w-full max-w-6xl px-4 pb-20 sm:px-6">
        {/* 上传区 */}
        <section className="mt-6">
          <UploadZone onPickFiles={handlePickedFiles} />
        </section>

        {/* 工具栏 */}
        <section className="mt-7">
          <Toolbar
            kind={kindFilter}
            onKindChange={setKindFilter}
            sort={sort}
            onSortChange={setSort}
            view={view}
            onViewChange={changeView}
            total={displayFiles.length}
            totalSize={totalSize}
            quotaSlot={
              <QuotaChip
                quota={quota}
                insufficientScope={quotaScopeError}
                loading={quotaLoading}
                onRefresh={() => void refreshQuota()}
                onReauth={reauthorize}
              />
            }
          />
        </section>

        {/* 文件夹路径 */}
        <section className="mt-3">
          <Breadcrumbs
            path={breadcrumbPath}
            onNavigate={setCurrentFolderId}
            onNewFolder={() => setFolderDialog({ mode: "create", parentId: currentFolderId })}
            onDropMove={(target, payload) => void handleDropMove(target, payload)}
            canDrop={canDropTo}
          />
        </section>

        {/* 批量操作条 */}
        {showSelectionBar && (
          <section className="mt-3">
            <SelectionBar
              count={selectionCount}
              allVisibleSelected={allVisibleSelected}
              anyVisibleSelected={anyVisibleSelected}
              busy={batchBusy}
              onSelectAll={toggleSelectAllVisible}
              onShare={() => {
                if (selectedFiles.length === 0) {
                  toast("info", "文件夹不支持分享，请选择文件");
                  return;
                }
                setShareFiles(selectedFiles);
              }}
              onDownload={() => void batchDownload()}
              onMove={() => {
                if (selectionCount === 0) return;
                setMoveTarget({ keys: [...selectedKeys], folderIds: [...selectedFolderIds] });
              }}
              onDelete={() => {
                setConfirmFiles(selectedFiles.length > 0 ? selectedFiles : null);
                setConfirmFolders(selectedFolders.length > 0 ? selectedFolders : null);
              }}
              onClear={clearSelection}
            />
          </section>
        )}

        {/* 内容区 */}
        <section className="mt-4">
          {files === null ? (
            <GridSkeleton />
          ) : visibleItemCount === 0 ? (
            <EmptyState filtered={searching || kindFilter !== "all"} />
          ) : view === "grid" ? (
            <>
              {displayFolders.length > 0 && (
                <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {displayFolders.map((folder) => (
                    <FolderCard
                      key={folder.id}
                      folder={folder}
                      view="grid"
                      itemCount={
                        files.filter((f) => f.folderId === folder.id).length +
                        folders.filter((f) => f.parentId === folder.id).length
                      }
                      selected={selectedFolderIds.has(folder.id)}
                      getDragPayload={buildFolderDragPayload}
                      canAcceptDrop={canDropTo}
                      onOpen={(f) => setCurrentFolderId(f.id)}
                      onToggleSelect={toggleSelectFolder}
                      onRename={(f) => setFolderDialog({ mode: "rename", folder: f })}
                      onMove={(f) => setMoveTarget({ keys: [], folderIds: [f.id] })}
                      onDelete={(f) => {
                        setConfirmFiles(null);
                        setConfirmFolders([f]);
                      }}
                      onDropMove={(target, payload) => void handleDropMove(target, payload)}
                    />
                  ))}
                </div>
              )}
              {displayFiles.length > 0 && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {displayFiles.map((file) => (
                    <FileCard
                      key={file.key}
                      file={file}
                      selected={selectedKeys.has(file.key)}
                      locationLabel={searching ? locationLabelOf(file) : null}
                      getDragPayload={buildFileDragPayload}
                      onOpen={setPreviewFile}
                      onShare={(f) => setShareFiles([f])}
                      onMove={(f) => setMoveTarget({ keys: [f.key], folderIds: [] })}
                      onDelete={(f) => {
                        setConfirmFiles([f]);
                        setConfirmFolders(null);
                      }}
                      onToggleSelect={toggleSelect}
                    />
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              {displayFolders.length > 0 && (
                <div className="mb-3 overflow-hidden rounded-xl border border-border bg-card">
                  {displayFolders.map((folder) => (
                    <FolderCard
                      key={folder.id}
                      folder={folder}
                      view="list"
                      itemCount={
                        files.filter((f) => f.folderId === folder.id).length +
                        folders.filter((f) => f.parentId === folder.id).length
                      }
                      selected={selectedFolderIds.has(folder.id)}
                      getDragPayload={buildFolderDragPayload}
                      canAcceptDrop={canDropTo}
                      onOpen={(f) => setCurrentFolderId(f.id)}
                      onToggleSelect={toggleSelectFolder}
                      onRename={(f) => setFolderDialog({ mode: "rename", folder: f })}
                      onMove={(f) => setMoveTarget({ keys: [], folderIds: [f.id] })}
                      onDelete={(f) => {
                        setConfirmFiles(null);
                        setConfirmFolders([f]);
                      }}
                      onDropMove={(target, payload) => void handleDropMove(target, payload)}
                    />
                  ))}
                </div>
              )}
              {displayFiles.length > 0 && (
                <FileList
                  files={displayFiles}
                  isSelected={(f) => selectedKeys.has(f.key)}
                  anyVisibleSelected={anyVisibleSelected}
                  allVisibleSelected={allVisibleSelected}
                  getLocationLabel={searching ? locationLabelOf : undefined}
                  getDragPayload={buildFileDragPayload}
                  onOpen={setPreviewFile}
                  onShare={(f) => setShareFiles([f])}
                  onMove={(f) => setMoveTarget({ keys: [f.key], folderIds: [] })}
                  onDelete={(f) => {
                    setConfirmFiles([f]);
                    setConfirmFolders(null);
                  }}
                  onToggleSelect={toggleSelect}
                  onToggleSelectAll={toggleSelectAllVisible}
                />
              )}
            </>
          )}
        </section>

        {isAdmin && (
          <p className="mt-4 text-center text-[11px] text-muted-foreground/70">
            当前以管理员身份浏览，可见桶内全部文件
          </p>
        )}
      </main>

      <footer className="pb-8 text-center text-[11px] text-muted-foreground/60">
        Cloud Drop · 存储于 Cloudflare R2 · 统一登录与存储额度由一方工具箱提供
      </footer>

      {/* 弹窗 */}
      {previewFile && isMediaPreview && (
        <MediaPreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />
      )}
      {previewFile && !isMediaPreview && (
        <TextPreviewModal
          file={previewFile}
          onClose={() => setPreviewFile(null)}
          onSave={saveTextFile}
        />
      )}
      <ShareDialog
        open={!!shareFiles}
        files={shareFiles ?? []}
        onClose={() => setShareFiles(null)}
      />
      <MoveDialog
        open={!!moveTarget}
        keys={moveTarget?.keys ?? []}
        folderIds={moveTarget?.folderIds ?? []}
        folders={folders}
        onClose={() => setMoveTarget(null)}
        onMoved={() => void refreshFiles()}
      />
      <FolderDialog
        open={!!folderDialog}
        mode={folderDialog?.mode ?? "create"}
        initialName={folderDialog?.mode === "rename" ? folderDialog.folder.name : undefined}
        parentLabel={parentLabelForDialog}
        submitting={folderDialogBusy}
        onClose={() => setFolderDialog(null)}
        onSubmit={(name) => void submitFolderDialog(name)}
      />
      <ConfirmDeleteDialog
        open={!!confirmFiles || !!confirmFolders}
        files={confirmFiles ?? []}
        folders={confirmFolders ?? []}
        loading={deleting}
        onCancel={() => {
          setConfirmFiles(null);
          setConfirmFolders(null);
        }}
        onConfirm={handleConfirmDeletion}
      />
      <PasteModal
        text={pasteText}
        defaultName={defaultPasteFilename()}
        uploading={pasteUploading}
        onClose={() => setPasteText(null)}
        onConfirm={confirmPasteUpload}
      />
      <UploadsPanel items={uploadItems} manager={uploadManager} />
    </div>
  );
}

function humanSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / 1024 ** index;
  return `${index === 0 || value >= 100 ? Math.round(value) : value.toFixed(1)} ${units[index]}`;
}
