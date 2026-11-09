import { useEffect, useState } from "react";
import { FolderPlus, Pencil } from "lucide-react";
import { Modal, ModalHeader } from "./ui/Modal";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";

interface FolderDialogProps {
  open: boolean;
  mode: "create" | "rename";
  initialName?: string;
  /** create 模式下的父文件夹名（提示文案用） */
  parentLabel?: string | null;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (name: string) => void;
}

export function FolderDialog({ open, mode, initialName, parentLabel, submitting, onClose, onSubmit }: FolderDialogProps) {
  const [name, setName] = useState("");

  useEffect(() => {
    if (open) setName(initialName ?? "");
  }, [open, initialName]);

  if (!open) return null;
  const valid = name.trim().length > 0;

  return (
    <Modal open onClose={onClose} className="max-w-sm" dismissable={!submitting}>
      <ModalHeader
        title={
          <span className="flex items-center gap-2">
            {mode === "create" ? <FolderPlus className="h-4 w-4 text-primary" /> : <Pencil className="h-4 w-4 text-primary" />}
            {mode === "create" ? "新建文件夹" : "重命名文件夹"}
          </span>
        }
        subtitle={
          mode === "create"
            ? parentLabel
              ? `将创建于「${parentLabel}」内`
              : "将创建于全部文件（根目录）"
            : undefined
        }
        onClose={onClose}
      />
      <div className="space-y-4 px-5 py-4">
        <Input
          value={name}
          autoFocus
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && valid && !submitting) onSubmit(name.trim());
          }}
          placeholder="文件夹名称"
          maxLength={80}
        />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            取消
          </Button>
          <Button
            variant="primary"
            loading={submitting}
            disabled={!valid}
            onClick={() => onSubmit(name.trim())}
          >
            {mode === "create" ? "创建" : "保存"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
