import { useState, type DragEvent } from "react";
import { ChevronRight, FolderPlus, House } from "lucide-react";
import type { FolderNode } from "../lib/types";
import { hasDragPayload, getDragPayload, type DragPayload } from "../lib/dnd";
import { cn } from "../lib/cn";

interface BreadcrumbsProps {
  /** 当前路径（根 → 当前，不含根节点本身） */
  path: FolderNode[];
  onNavigate: (folderId: string | null) => void;
  onNewFolder: () => void;
  /** 拖拽项目到面包屑上移动 */
  onDropMove: (targetFolderId: string | null, payload: DragPayload) => void;
  /** 判断拖拽内容能否放入目标文件夹 */
  canDrop: (targetFolderId: string | null, payload: DragPayload) => boolean;
}

export function Breadcrumbs({ path, onNavigate, onNewFolder, onDropMove, canDrop }: BreadcrumbsProps) {
  // null 代表根目录；最后一个节点为当前所在位置
  const nodes: { id: string | null; name: string }[] = [
    { id: null, name: "全部文件" },
    ...path.map((f) => ({ id: f.id, name: f.name })),
  ];
  const [dropTarget, setDropTarget] = useState<string | null | undefined>(undefined);

  const handleDragOver = (event: DragEvent, targetId: string | null) => {
    if (!hasDragPayload(event)) return;
    const payload = getDragPayload(event);
    if (!payload || !canDrop(targetId, payload)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDropTarget(targetId);
  };

  const handleDrop = (event: DragEvent, targetId: string | null) => {
    event.preventDefault();
    setDropTarget(undefined);
    const payload = getDragPayload(event);
    if (payload && canDrop(targetId, payload)) onDropMove(targetId, payload);
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <nav className="flex min-w-0 flex-wrap items-center gap-0.5 text-sm" aria-label="文件夹路径">
        {nodes.map((node, index) => {
          const isLast = index === nodes.length - 1;
          const active = dropTarget === node.id;
          return (
            <span key={node.id ?? "root"} className="flex min-w-0 items-center">
              {index > 0 && <ChevronRight className="mx-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />}
              <button
                type="button"
                disabled={isLast && !active}
                onClick={() => onNavigate(node.id)}
                onDragOver={(event) => handleDragOver(event, node.id)}
                onDragLeave={() => setDropTarget((prev) => (prev === node.id ? undefined : prev))}
                onDrop={(event) => handleDrop(event, node.id)}
                className={cn(
                  "flex min-w-0 items-center gap-1.5 rounded-lg px-2 py-1 text-sm transition-colors",
                  isLast
                    ? "font-semibold text-foreground"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                  active && "bg-primary/10 text-primary ring-1 ring-primary/40",
                )}
                title={node.name}
              >
                {index === 0 && <House className="h-3.5 w-3.5 shrink-0" />}
                <span className="max-w-[12rem] truncate">{node.name}</span>
              </button>
            </span>
          );
        })}
      </nav>

      <button
        type="button"
        onClick={onNewFolder}
        className="flex h-8 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-muted/60"
      >
        <FolderPlus className="h-3.5 w-3.5" />
        新建文件夹
      </button>
    </div>
  );
}
