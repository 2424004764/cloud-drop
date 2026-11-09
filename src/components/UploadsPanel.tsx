import { useEffect, useRef, useState } from "react";
import { CheckCircle2, ChevronDown, ChevronUp, Loader2, Trash2, X, XCircle } from "lucide-react";
import type { UploadItem } from "../lib/uploader";
import type { UploadManager } from "../lib/uploader";
import { formatBytes } from "../lib/format";
import { ProgressBar } from "./ui/ProgressBar";
import { cn } from "../lib/cn";

interface UploadsPanelProps {
  items: UploadItem[];
  manager: UploadManager;
}

const STATUS_ICON: Record<UploadItem["status"], React.ReactNode> = {
  queued: <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />,
  preparing: <Loader2 className="h-4 w-4 animate-spin text-sky-500" />,
  uploading: <Loader2 className="h-4 w-4 animate-spin text-primary" />,
  success: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
  error: <XCircle className="h-4 w-4 text-destructive" />,
  canceled: <X className="h-4 w-4 text-muted-foreground" />,
};

export function UploadsPanel({ items, manager }: UploadsPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const prevCount = useRef(0);

  // 有新任务入队时自动展开
  useEffect(() => {
    if (items.length > prevCount.current) setCollapsed(false);
    prevCount.current = items.length;
  }, [items]);

  if (items.length === 0) return null;

  const active = items.filter((i) => ["queued", "preparing", "uploading"].includes(i.status));
  const done = manager.succeededCount;
  const failed = manager.failedCount;
  const overall =
    active.length > 0
      ? Math.round(active.reduce((sum, i) => sum + (i.status === "uploading" ? i.progress : 0), 0) / items.length)
      : 100;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[min(22rem,calc(100vw-2rem))] animate-float-up overflow-hidden rounded-2xl border border-border bg-card/95 shadow-2xl backdrop-blur dark:shadow-black/50">
      {/* 头部 */}
      <button
        type="button"
        onClick={() => setCollapsed((prev) => !prev)}
        className="flex w-full items-center gap-2.5 border-b border-border/70 px-4 py-3 text-left transition-colors hover:bg-muted/40"
      >
        {active.length > 0 ? (
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
        ) : failed > 0 ? (
          <XCircle className="h-4 w-4 text-destructive" />
        ) : (
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
        )}
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold text-foreground">
            {active.length > 0
              ? `上传中 ${done + failed + 1}/${items.length} · ${overall}%`
              : `上传完成 ${done}/${items.length}${failed > 0 ? ` · 失败 ${failed}` : ""}`}
          </div>
          {!collapsed && active.length > 0 && (
            <ProgressBar value={overall} className="mt-1.5 h-1" />
          )}
        </div>
        {collapsed ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {/* 任务列表 */}
      {!collapsed && (
        <div className="max-h-64 overflow-y-auto px-2 py-1.5">
          {items.map((item) => (
            <div key={item.id} className="flex items-start gap-2.5 rounded-lg px-2 py-2">
              <span className="mt-0.5 shrink-0">{STATUS_ICON[item.status]}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-xs font-medium text-foreground" title={item.name}>
                    {item.name}
                  </span>
                  <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                    {item.status === "uploading"
                      ? `${item.progress}%`
                      : formatBytes(item.size)}
                  </span>
                </div>
                {(item.status === "uploading" || item.status === "preparing") && (
                  <ProgressBar
                    value={item.status === "uploading" ? item.progress : 0}
                    className="mt-1.5 h-1"
                  />
                )}
                {item.status === "error" && (
                  <div className="mt-1 text-[11px] leading-4 text-destructive">{item.error}</div>
                )}
              </div>
              {["queued", "preparing", "uploading"].includes(item.status) && (
                <button
                  type="button"
                  aria-label="取消"
                  title="取消"
                  onClick={() => manager.cancel(item.id)}
                  className="mt-0.5 shrink-0 rounded p-0.5 text-muted-foreground/60 transition hover:text-destructive"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 底部操作 */}
      {!collapsed && active.length === 0 && (
        <div className="flex justify-end border-t border-border/70 px-3 py-2">
          <button
            type="button"
            onClick={() => manager.clearFinished()}
            className={cn("flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-muted-foreground transition hover:bg-muted/60 hover:text-foreground")}
          >
            <Trash2 className="h-3 w-3" />
            清空列表
          </button>
        </div>
      )}
    </div>
  );
}
