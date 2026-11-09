import { useEffect, useState } from "react";
import { FileText, UploadCloud } from "lucide-react";
import { formatBytes } from "../lib/format";
import { Modal, ModalHeader } from "./ui/Modal";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";

interface PasteModalProps {
  /** null = 关闭 */
  text: string | null;
  defaultName: string;
  uploading: boolean;
  onClose: () => void;
  onConfirm: (name: string, text: string) => void;
}

/** Ctrl+V 粘贴纯文本 → 保存为 .txt 上传 */
export function PasteModal({ text, defaultName, uploading, onClose, onConfirm }: PasteModalProps) {
  const [name, setName] = useState(defaultName);

  useEffect(() => {
    if (text !== null) setName(defaultName);
  }, [text, defaultName]);

  if (text === null) return null;

  const bytes = new TextEncoder().encode(text).length;
  const preview = text.length > 2000 ? `${text.slice(0, 2000)}…` : text;
  const valid = name.trim().length > 0;

  return (
    <Modal open onClose={onClose} className="max-w-md">
      <ModalHeader
        title={
          <span className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            粘贴文本上传
          </span>
        }
        subtitle={`将保存为 .txt 文件 · ${bytes.toLocaleString()} 字节`}
        onClose={onClose}
      />
      <div className="space-y-3.5 px-5 py-4">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground" htmlFor="paste-name">
            文件名
          </label>
          <Input
            id="paste-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && valid && !uploading) onConfirm(name.trim(), text);
            }}
            className="font-mono text-[13px]"
            autoFocus
            onFocus={(event) => {
              // 光标移到扩展名前，方便改名
              const dot = name.lastIndexOf(".");
              const pos = dot > 0 ? dot : name.length;
              event.target.setSelectionRange(pos, pos);
            }}
          />
        </div>

        <div>
          <div className="mb-1.5 text-xs font-medium text-muted-foreground">
            内容预览（{text.length.toLocaleString()} 字符 · {formatBytes(bytes)}）
          </div>
          <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-xl border border-border bg-muted/30 p-3 font-mono text-xs leading-relaxed text-foreground/85">
            {preview}
          </pre>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose} disabled={uploading}>
            取消
          </Button>
          <Button variant="primary" loading={uploading} disabled={!valid} onClick={() => onConfirm(name.trim(), text)}>
            {!uploading && <UploadCloud className="h-4 w-4" />}
            上传为 TXT
          </Button>
        </div>
      </div>
    </Modal>
  );
}
