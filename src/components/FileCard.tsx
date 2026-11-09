import { Download, Folder, FolderInput, Share2, Trash2 } from "lucide-react";
import type { CloudFile } from "../lib/types";
import { formatBytes, formatRelativeTime } from "../lib/format";
import { IMAGE_THUMB_MAX_BYTES, isImageFile, kindIconFor } from "../lib/kind";
import { downloadUrl, previewUrl } from "../lib/api";
import { setDragPayload, type DragPayload } from "../lib/dnd";
import { Checkbox } from "./ui/Checkbox";
import { cn } from "../lib/cn";

interface FileCardProps {
  file: CloudFile;
  selected: boolean;
  /** 全局搜索时显示所在文件夹路径 */
  locationLabel?: string | null;
  getDragPayload: (file: CloudFile) => DragPayload | null;
  onOpen: (file: CloudFile) => void;
  onShare: (file: CloudFile) => void;
  onMove: (file: CloudFile) => void;
  onDelete: (file: CloudFile) => void;
  onToggleSelect: (file: CloudFile) => void;
}

export function FileCard({
  file,
  selected,
  locationLabel,
  getDragPayload,
  onOpen,
  onShare,
  onMove,
  onDelete,
  onToggleSelect,
}: FileCardProps) {
  const meta = kindIconFor(file.filename);
  const Icon = meta.icon;
  const showThumb = isImageFile(file.filename) && file.size <= IMAGE_THUMB_MAX_BYTES;

  return (
    <div
      role="button"
      tabIndex={0}
      draggable
      onDragStart={(event) => {
        const payload = getDragPayload(file);
        if (payload) setDragPayload(event, payload);
      }}
      onClick={() => onOpen(file)}
      onKeyDown={(event) => {
        if (event.key === "Enter") onOpen(file);
      }}
      className={cn(
        "group relative cursor-pointer overflow-hidden rounded-xl border bg-card transition-all duration-200",
        selected
          ? "border-primary/50 ring-2 ring-primary/40"
          : "border-border hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg hover:shadow-black/5 dark:hover:shadow-black/30",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
      )}
    >
      {/* 预览区 */}
      <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden bg-muted/30">
        {showThumb ? (
          <img
            src={previewUrl(file.key)}
            alt={file.filename}
            loading="lazy"
            className={cn(
              "h-full w-full object-cover transition-transform duration-300",
              !selected && "group-hover:scale-[1.03]",
            )}
          />
        ) : (
          <span className={cn("flex h-16 w-16 items-center justify-center rounded-2xl transition-transform duration-200 group-hover:scale-105", meta.tile)}>
            <Icon className="h-8 w-8" />
          </span>
        )}

        {/* 多选框 */}
        <div
          className={cn(
            "absolute left-2 top-2 z-10 rounded-full bg-card/80 p-0.5 backdrop-blur transition-opacity",
            selected ? "opacity-100" : "opacity-0 focus-within:opacity-100 group-hover:opacity-100 max-sm:opacity-100",
          )}
        >
          <Checkbox
            checked={selected}
            onChange={() => onToggleSelect(file)}
            label={`选择 ${file.filename}`}
          />
        </div>

        {/* 悬浮操作 */}
        <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity duration-150 focus-within:opacity-100 group-hover:opacity-100 max-sm:opacity-100">
          <button
            type="button"
            aria-label="分享"
            title="生成分享链接"
            onClick={(event) => {
              event.stopPropagation();
              onShare(file);
            }}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-card/90 text-muted-foreground shadow-sm backdrop-blur transition hover:text-primary"
          >
            <Share2 className="h-3.5 w-3.5" />
          </button>
          <a
            href={downloadUrl(file.key)}
            aria-label="下载"
            title="下载"
            onClick={(event) => event.stopPropagation()}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-card/90 text-muted-foreground shadow-sm backdrop-blur transition hover:text-foreground"
          >
            <Download className="h-3.5 w-3.5" />
          </a>
          <button
            type="button"
            aria-label="移动"
            title="移动到其他文件夹"
            onClick={(event) => {
              event.stopPropagation();
              onMove(file);
            }}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-card/90 text-muted-foreground shadow-sm backdrop-blur transition hover:text-foreground"
          >
            <FolderInput className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            aria-label="删除"
            title="删除"
            onClick={(event) => {
              event.stopPropagation();
              onDelete(file);
            }}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-card/90 text-muted-foreground shadow-sm backdrop-blur transition hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* 信息区 */}
      <div className="border-t border-border/60 px-3 py-2.5">
        <div className="truncate text-[13px] font-medium text-foreground" title={file.filename}>
          {file.filename}
        </div>
        {locationLabel && (
          <div
            className="mt-1 flex items-center gap-1 truncate text-[11px] text-indigo-500/90 dark:text-indigo-400/90"
            title={`位于：${locationLabel}`}
          >
            <Folder className="h-3 w-3 shrink-0" />
            <span className="truncate">{locationLabel}</span>
          </div>
        )}
        <div className={cn("flex items-center justify-between text-[11px] tabular-nums text-muted-foreground", locationLabel ? "mt-0.5" : "mt-1")}>
          <span>{formatBytes(file.size)}</span>
          <span>{formatRelativeTime(file.uploadedAt)}</span>
        </div>
      </div>
    </div>
  );
}
