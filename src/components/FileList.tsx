import { Download, Folder, FolderInput, Share2, Trash2 } from "lucide-react";
import type { CloudFile } from "../lib/types";
import { formatBytes, formatFullTime, formatRelativeTime } from "../lib/format";
import { kindIconFor } from "../lib/kind";
import { downloadUrl } from "../lib/api";
import { setDragPayload, type DragPayload } from "../lib/dnd";
import { Checkbox } from "./ui/Checkbox";
import { cn } from "../lib/cn";

interface FileListProps {
  files: CloudFile[];
  isSelected: (file: CloudFile) => boolean;
  anyVisibleSelected: boolean;
  allVisibleSelected: boolean;
  /** 全局搜索时显示所在文件夹路径 */
  getLocationLabel?: (file: CloudFile) => string | null;
  getDragPayload: (file: CloudFile) => DragPayload | null;
  onOpen: (file: CloudFile) => void;
  onShare: (file: CloudFile) => void;
  onMove: (file: CloudFile) => void;
  onDelete: (file: CloudFile) => void;
  onToggleSelect: (file: CloudFile) => void;
  onToggleSelectAll: () => void;
}

export function FileList({
  files,
  isSelected,
  anyVisibleSelected,
  allVisibleSelected,
  getLocationLabel,
  getDragPayload,
  onOpen,
  onShare,
  onMove,
  onDelete,
  onToggleSelect,
  onToggleSelectAll,
}: FileListProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      {/* 表头 */}
      <div className="hidden grid-cols-[auto_minmax(0,1fr)_6.5rem_8rem_10rem] items-center gap-3 border-b border-border bg-muted/40 px-4 py-2.5 text-xs font-medium text-muted-foreground sm:grid">
        <Checkbox
          checked={allVisibleSelected}
          indeterminate={anyVisibleSelected && !allVisibleSelected}
          onChange={onToggleSelectAll}
          label="全选 / 取消全选"
        />
        <span>名称</span>
        <span className="text-right">大小</span>
        <span>上传时间</span>
        <span className="text-right">操作</span>
      </div>

      {files.map((file) => {
        const meta = kindIconFor(file.filename);
        const Icon = meta.icon;
        const selected = isSelected(file);
        return (
          <div
            key={file.key}
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
              "group flex cursor-pointer items-center gap-3 border-b border-border/60 px-4 py-2.5 transition-colors last:border-b-0",
              selected ? "bg-primary/[0.06]" : "hover:bg-muted/40",
              "focus-visible:outline-none focus-visible:bg-muted/40",
            )}
          >
            <Checkbox
              checked={selected}
              onChange={() => onToggleSelect(file)}
              label={`选择 ${file.filename}`}
            />

            <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", meta.tile)}>
              <Icon className="h-[18px] w-[18px]" />
            </span>

            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-foreground" title={file.filename}>
                {file.filename}
              </div>
              {getLocationLabel && getLocationLabel(file) && (
                <div
                  className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-indigo-500/90 dark:text-indigo-400/90"
                  title={`位于：${getLocationLabel(file)}`}
                >
                  <Folder className="h-3 w-3 shrink-0" />
                  <span className="truncate">{getLocationLabel(file)}</span>
                </div>
              )}
              <div className="mt-0.5 text-[11px] tabular-nums text-muted-foreground sm:hidden">
                {formatBytes(file.size)} · {formatRelativeTime(file.uploadedAt)}
              </div>
            </div>

            <span className="hidden w-[6.5rem] shrink-0 text-right text-xs tabular-nums text-muted-foreground sm:block">
              {formatBytes(file.size)}
            </span>
            <span
              className="hidden w-32 shrink-0 text-xs text-muted-foreground sm:block"
              title={formatFullTime(file.uploadedAt)}
            >
              {formatRelativeTime(file.uploadedAt)}
            </span>

            <div className="flex w-40 shrink-0 items-center justify-end gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 max-sm:opacity-100">
              <button
                type="button"
                aria-label="分享"
                title="生成分享链接"
                onClick={(event) => {
                  event.stopPropagation();
                  onShare(file);
                }}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-primary"
              >
                <Share2 className="h-4 w-4" />
              </button>
              <a
                href={downloadUrl(file.key)}
                aria-label="下载"
                title="下载"
                onClick={(event) => event.stopPropagation()}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                <Download className="h-4 w-4" />
              </a>
              <button
                type="button"
                aria-label="移动"
                title="移动到其他文件夹"
                onClick={(event) => {
                  event.stopPropagation();
                  onMove(file);
                }}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                <FolderInput className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="删除"
                title="删除"
                onClick={(event) => {
                  event.stopPropagation();
                  onDelete(file);
                }}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
