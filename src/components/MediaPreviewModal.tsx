import { Download } from "lucide-react";
import type { CloudFile } from "../lib/types";
import { downloadUrl } from "../lib/api";
import { formatBytes, formatFullTime } from "../lib/format";
import { extOf } from "../lib/kind";
import { Modal, ModalHeader } from "./ui/Modal";
import { cn } from "../lib/cn";

interface MediaPreviewModalProps {
  file: CloudFile | null;
  onClose: () => void;
}

/** 图片 / PDF 在线预览 */
export function MediaPreviewModal({ file, onClose }: MediaPreviewModalProps) {
  if (!file) return null;
  const isPdf = extOf(file.filename) === "pdf";

  return (
    <Modal open onClose={onClose} className="max-w-4xl">
      <ModalHeader
        title={file.filename}
        subtitle={`${formatBytes(file.size)} · ${formatFullTime(file.uploadedAt)}${isPdf ? " · PDF 预览" : ""}`}
        onClose={onClose}
      >
        <a
          href={downloadUrl(file.key)}
          aria-label="下载"
          title="下载"
          className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
        >
          <Download className="h-4 w-4" />
          <span className="hidden sm:inline">下载</span>
        </a>
      </ModalHeader>

      <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-muted/30 p-4">
        {isPdf ? (
          <iframe
            src={downloadUrl(file.key)}
            title={file.filename}
            className="h-[70vh] w-full rounded-lg border border-border bg-white"
          />
        ) : (
          <img
            src={downloadUrl(file.key)}
            alt={file.filename}
            className={cn("max-h-[70vh] max-w-full rounded-lg object-contain shadow-lg")}
          />
        )}
      </div>
    </Modal>
  );
}
