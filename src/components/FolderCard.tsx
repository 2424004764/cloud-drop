import { useState, type DragEvent } from "react";
import { Folder, FolderInput, FolderOpen, Pencil, Trash2 } from "lucide-react";
import type { FolderNode } from "../lib/types";
import { getDragPayload as readDragPayload, hasDragPayload, setDragPayload, type DragPayload } from "../lib/dnd";
import { Checkbox } from "./ui/Checkbox";
import { cn } from "../lib/cn";

interface FolderCardProps {
  folder: FolderNode;
  view: "grid" | "list";
  /** 直接子项数量（文件 + 子文件夹） */
  itemCount: number;
  selected: boolean;
  /** 构建拖拽负载（多选拖拽时由父级返回整个选择集） */
  getDragPayload: (folder: FolderNode) => DragPayload | null;
  /** 该文件夹能否接收拖拽内容（排除自身与后代） */
  canAcceptDrop: (folderId: string, payload: DragPayload) => boolean;
  onOpen: (folder: FolderNode) => void;
  onToggleSelect: (folder: FolderNode) => void;
  onRename: (folder: FolderNode) => void;
  onMove: (folder: FolderNode) => void;
  onDelete: (folder: FolderNode) => void;
  onDropMove: (targetFolderId: string, payload: DragPayload) => void;
}

export function FolderCard({
  folder,
  view,
  itemCount,
  selected,
  getDragPayload,
  canAcceptDrop,
  onOpen,
  onToggleSelect,
  onRename,
  onMove,
  onDelete,
  onDropMove,
}: FolderCardProps) {
  const [dragOver, setDragOver] = useState(false);
  const itemLabel = `${itemCount} 项`;

  const handleDragStart = (event: DragEvent) => {
    const payload = getDragPayload(folder);
    if (!payload) return;
    setDragPayload(event, payload);
  };

  const handleDragOver = (event: DragEvent) => {
    if (!hasDragPayload(event)) return;
    const payload = readDragPayload(event);
    if (!payload || !canAcceptDrop(folder.id, payload)) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "move";
    setDragOver(true);
  };

  const handleDrop = (event: DragEvent) => {
    event.stopPropagation();
    setDragOver(false);
    const payload = readDragPayload(event);
    if (payload && canAcceptDrop(folder.id, payload)) {
      event.preventDefault();
      onDropMove(folder.id, payload);
    }
  };

  const actions = (
    <>
      <button
        type="button"
        aria-label="重命名"
        title="重命名"
        onClick={(event) => {
          event.stopPropagation();
          onRename(folder);
        }}
        className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-card/90 text-muted-foreground shadow-sm backdrop-blur transition hover:text-foreground"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        aria-label="移动"
        title="移动"
        onClick={(event) => {
          event.stopPropagation();
          onMove(folder);
        }}
        className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-card/90 text-muted-foreground shadow-sm backdrop-blur transition hover:text-foreground"
      >
        <FolderInput className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        aria-label="删除文件夹"
        title="删除文件夹（内容移至上级）"
        onClick={(event) => {
          event.stopPropagation();
          onDelete(folder);
        }}
        className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-card/90 text-muted-foreground shadow-sm backdrop-blur transition hover:text-destructive"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </>
  );

  if (view === "list") {
    return (
      <div
        role="button"
        tabIndex={0}
        draggable
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => onOpen(folder)}
        onKeyDown={(event) => {
          if (event.key === "Enter") onOpen(folder);
        }}
        className={cn(
          "group flex cursor-pointer items-center gap-3 border-b border-border/60 px-4 py-2.5 transition-colors last:border-b-0",
          selected ? "bg-primary/[0.06]" : dragOver ? "bg-primary/10 ring-1 ring-inset ring-primary/40" : "hover:bg-muted/40",
          "focus-visible:outline-none focus-visible:bg-muted/40",
        )}
      >
        <Checkbox
          checked={selected}
          onChange={() => onToggleSelect(folder)}
          label={`选择文件夹 ${folder.name}`}
        />
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
            dragOver ? "bg-primary/15 text-primary" : "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
          )}
        >
          {dragOver ? <FolderOpen className="h-[18px] w-[18px]" /> : <Folder className="h-[18px] w-[18px]" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-foreground" title={folder.name}>
            {folder.name}
          </div>
          <div className="mt-0.5 text-[11px] text-muted-foreground sm:hidden">{itemLabel}</div>
        </div>
        <span className="hidden w-[6.5rem] shrink-0 text-right text-xs text-muted-foreground sm:block">
          {itemLabel}
        </span>
        <span className="hidden w-32 shrink-0 text-xs text-muted-foreground sm:block">文件夹</span>
        <div className="flex w-[5.5rem] shrink-0 items-center justify-end gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 max-sm:opacity-100">
          {actions}
        </div>
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      draggable
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={() => onOpen(folder)}
      onKeyDown={(event) => {
        if (event.key === "Enter") onOpen(folder);
      }}
      className={cn(
        "group relative cursor-pointer overflow-hidden rounded-xl border bg-card transition-all duration-200",
        selected
          ? "border-primary/50 ring-2 ring-primary/40"
          : dragOver
            ? "border-primary/60 bg-primary/[0.06] ring-2 ring-primary/40"
            : "border-border hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg hover:shadow-black/5 dark:hover:shadow-black/30",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
      )}
    >
      <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden bg-muted/30">
        <span
          className={cn(
            "flex h-16 w-16 items-center justify-center rounded-2xl transition-transform duration-200",
            dragOver
              ? "scale-110 bg-primary/15 text-primary"
              : "bg-indigo-500/10 text-indigo-500 group-hover:scale-105",
          )}
        >
          {dragOver ? <FolderOpen className="h-9 w-9" /> : <Folder className="h-9 w-9" />}
        </span>

        <div
          className={cn(
            "absolute left-2 top-2 z-10 rounded-full bg-card/80 p-0.5 backdrop-blur transition-opacity",
            selected ? "opacity-100" : "opacity-0 focus-within:opacity-100 group-hover:opacity-100 max-sm:opacity-100",
          )}
        >
          <Checkbox checked={selected} onChange={() => onToggleSelect(folder)} label={`选择文件夹 ${folder.name}`} />
        </div>

        <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity duration-150 focus-within:opacity-100 group-hover:opacity-100 max-sm:opacity-100">
          {actions}
        </div>
      </div>

      <div className="border-t border-border/60 px-3 py-2.5">
        <div className="truncate text-[13px] font-medium text-foreground" title={folder.name}>
          {folder.name}
        </div>
        <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>{itemLabel}</span>
          <span>文件夹</span>
        </div>
      </div>
    </div>
  );
}
