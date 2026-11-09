import { AlertTriangle } from "lucide-react";
import { Modal } from "./Modal";
import { Button } from "./Button";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmText?: string;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmText = "确认",
  loading,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={loading ? () => {} : onCancel} className="max-w-sm">
      <div className="px-5 pt-5">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle className="h-5 w-5 text-destructive" />
        </div>
        <h2 className="mt-3.5 text-center text-sm font-semibold text-foreground">{title}</h2>
        <div className="mt-2 text-center text-xs leading-5 text-muted-foreground">{message}</div>
      </div>
      <div className="flex gap-2 px-5 pb-5 pt-4">
        <Button variant="secondary" className="flex-1" onClick={onCancel} disabled={loading}>
          取消
        </Button>
        <Button variant="destructive" className="flex-1" loading={loading} onClick={onConfirm}>
          {confirmText}
        </Button>
      </div>
    </Modal>
  );
}
