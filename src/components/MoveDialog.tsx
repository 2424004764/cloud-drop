import { useEffect, useMemo, useState } from "react";
import { FolderInput, House } from "lucide-react";
import type { FolderNode } from "../lib/types";
import { descendantIds, flattenFolderTree } from "../lib/folders";
import { api } from "../lib/api";
import { Modal, ModalHeader } from "./ui/Modal";
import { Button } from "./ui/Button";
import { useToast } from "./Toast";
import { cn } from "../lib/cn";

interface MoveDialogProps {
  open: boolean;
  /** 待移动内容 */
  keys: string[];
  folderIds: string[];
  folders: FolderNode[];
  onClose: () => void;
  onMoved: () => void;
}

/** 移动文件/文件夹到目标文件夹的树形选择弹窗 */
export function MoveDialog({ open, keys, folderIds, folders, onClose, onMoved }: MoveDialogProps) {
  const { toast } = useToast();
  const [targetId, setTargetId] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);

  useEffect(() => {
    if (open) setTargetId(null);
  }, [open]);

  // 被移动的文件夹自身及其后代不可作为目标
  const disabledIds = useMemo(() => {
    const disabled = new Set<string>(folderIds);
    for (const folderId of folderIds) {
      descendantIds(folders, folderId).forEach((id) => disabled.add(id));
    }
    return disabled;
  }, [folders, folderIds]);

  const rows = useMemo(() => flattenFolderTree(folders), [folders]);

  const handleMove = async () => {
    if (moving) return;
    setMoving(true);
    try {
      await api.moveItems({ keys, folderIds, folderId: targetId });
      toast(
        "success",
        `已移动 ${keys.length + folderIds.length} 项到「${targetId ? folders.find((f) => f.id === targetId)?.name ?? "" : "全部文件"}」`,
      );
      onMoved();
      onClose();
    } catch (error) {
      toast("error", error instanceof Error ? error.message : "移动失败");
    } finally {
      setMoving(false);
    }
  };

  if (!open) return null;
  const total = keys.length + folderIds.length;

  return (
    <Modal open onClose={onClose} className="max-w-sm">
      <ModalHeader
        title={
          <span className="flex items-center gap-2">
            <FolderInput className="h-4 w-4 text-primary" />
            移动 {total} 项
          </span>
        }
        subtitle={folderIds.length > 0 ? `${folderIds.length} 个文件夹、${keys.length} 个文件` : `${keys.length} 个文件`}
        onClose={onClose}
      />

      <div className="max-h-[46vh] overflow-y-auto px-3 py-3">
        {/* 根目录 */}
        <button
          type="button"
          disabled={folderIds.length > 0}
          onClick={() => setTargetId(null)}
          className={cn(
            "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors",
            targetId === null
              ? "bg-primary/10 font-medium text-primary"
              : "text-foreground hover:bg-muted/60",
            folderIds.length > 0 && "cursor-not-allowed opacity-40",
          )}
        >
          <House className="h-4 w-4 shrink-0" />
          全部文件（根目录）
          {folderIds.length > 0 && <span className="ml-auto text-[10px] text-muted-foreground">文件夹不可移到根</span>}
        </button>

        <div className="my-1.5 h-px bg-border/70" />

        {rows.length === 0 && (
          <p className="px-2.5 py-3 text-xs text-muted-foreground">还没有其他文件夹，可移到根目录或先新建文件夹</p>
        )}

        {rows.map(({ folder, depth }) => {
          const disabled = disabledIds.has(folder.id);
          const active = targetId === folder.id;
          return (
            <button
              key={folder.id}
              type="button"
              disabled={disabled}
              onClick={() => setTargetId(folder.id)}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg py-1.5 pr-2.5 text-sm transition-colors",
                active ? "bg-primary/10 font-medium text-primary" : "text-foreground hover:bg-muted/60",
                disabled && "cursor-not-allowed opacity-35 hover:bg-transparent",
              )}
              style={{ paddingLeft: `${0.625 + depth * 1.1}rem` }}
              title={disabled ? "不能移动到自身或其子文件夹" : folder.name}
            >
              <span className="w-4 shrink-0" />
              <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-40", active && "opacity-100")} />
              <span className="truncate">{folder.name}</span>
            </button>
          );
        })}
      </div>

      <div className="flex justify-end gap-2 border-t border-border px-5 py-3.5">
        <Button variant="secondary" onClick={onClose} disabled={moving}>
          取消
        </Button>
        <Button variant="primary" loading={moving} onClick={handleMove}>
          移动到此处
        </Button>
      </div>
    </Modal>
  );
}
