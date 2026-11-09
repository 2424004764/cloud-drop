import { AlertTriangle } from "lucide-react";
import type { CloudFile, FolderNode } from "../lib/types";
import { formatBytes } from "../lib/format";
import { Modal } from "./ui/Modal";
import { Button } from "./ui/Button";

interface ConfirmDeleteDialogProps {
  open: boolean;
  files: CloudFile[];
  folders: FolderNode[];
  loading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmDeleteDialog({ open, files, folders, loading, onCancel, onConfirm }: ConfirmDeleteDialogProps) {
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  const previewNames = files.slice(0, 3);
  const restCount = files.length - previewNames.length;
  const folderNames = folders.map((f) => f.name);

  return (
    <Modal open={open} onClose={loading ? () => {} : onCancel} className="max-w-sm">
      <div className="px-5 pt-5">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle className="h-5 w-5 text-destructive" />
        </div>
        <h2 className="mt-3.5 text-center text-sm font-semibold text-foreground">确认删除？</h2>
        <p className="mt-2 text-center text-xs leading-5 text-muted-foreground">
          {folders.length > 0 && (
            <>
              <span className="break-all font-medium text-foreground/80">
                「{folderNames.join("」「")}」{folders.length > 1 ? "等" : ""} {folders.length} 个文件夹
              </span>
              将被删除（其中的内容会移至上一级）。
              {files.length > 0 && <br />}
            </>
          )}
          {files.length > 0 && (
            <>
              <span className="break-all font-medium text-foreground/80">
                「{previewNames.map((f) => f.filename).join("」「")}
                {restCount > 0 ? `」等 ${files.length} 个文件` : "」"}
              </span>
              {files.length > 1 && <>（共 {formatBytes(totalSize)}）</>}
              将被永久删除，占用的存储额度将在主站结算后自动退还。
            </>
          )}
          此操作不可撤销。
        </p>
      </div>
      <div className="flex gap-2 px-5 pb-5 pt-4">
        <Button variant="secondary" className="flex-1" onClick={onCancel} disabled={loading}>
          取消
        </Button>
        <Button variant="destructive" className="flex-1" loading={loading} onClick={onConfirm}>
          确认删除
        </Button>
      </div>
    </Modal>
  );
}
