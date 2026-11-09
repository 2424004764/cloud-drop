import { useEffect, useState } from "react";
import { Check, Copy, Download, Pencil, Save, X } from "lucide-react";
import type { CloudFile } from "../lib/types";
import { api, downloadUrl } from "../lib/api";
import { formatBytes, formatFullTime } from "../lib/format";
import { kindIconFor } from "../lib/kind";
import { Modal, ModalHeader } from "./ui/Modal";
import { Button } from "./ui/Button";
import { useToast } from "./Toast";
import { cn } from "../lib/cn";

const PREVIEW_MAX_BYTES = 2 * 1024 * 1024;

interface TextPreviewModalProps {
  file: CloudFile | null;
  onClose: () => void;
  /** 保存为新版本：申请新凭证直传 → 删除旧对象退额 → 刷新列表。成功返回 true */
  onSave: (file: CloudFile, content: string) => Promise<boolean>;
}

export function TextPreviewModal({ file, onClose, onSave }: TextPreviewModalProps) {
  const { toast } = useToast();
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!file) return;
    // 重置状态
    setContent("");
    setError(null);
    setEditing(false);
    setSaving(false);
    setCopied(false);

    if (file.size > PREVIEW_MAX_BYTES) {
      setError(`文件较大（${formatBytes(file.size)}），超过 2MB 在线预览上限，请下载后查看`);
      return;
    }

    let cancelled = false;
    setLoading(true);
    api
      .fetchText(file.key)
      .then((text) => {
        if (!cancelled) setContent(text);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "读取文件失败");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [file]);

  if (!file) return null;

  const meta = kindIconFor(file.filename);
  const Icon = meta.icon;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
      toast("success", "已复制全文到剪贴板");
    } catch {
      toast("error", "复制失败，请手动选择文本复制");
    }
  };

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    const ok = await onSave(file, content);
    setSaving(false);
    if (ok) onClose();
  };

  return (
    <Modal open onClose={onClose} className="max-w-3xl">
      <ModalHeader
        title={
          <span className="flex items-center gap-2">
            <Icon className={cn("h-4 w-4 shrink-0", meta.color)} />
            {file.filename}
          </span>
        }
        subtitle={`${formatBytes(file.size)} · ${formatFullTime(file.uploadedAt)}${
          content && !loading ? ` · ${content.length.toLocaleString()} 字符` : ""
        }`}
        onClose={onClose}
      >
        {!error && !loading && !editing && (
          <>
            <Button size="sm" variant="ghost" onClick={handleCopy} title="复制全文">
              {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
              <span className="hidden sm:inline">复制全文</span>
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)} title="在线编辑">
              <Pencil className="h-4 w-4" />
              <span className="hidden sm:inline">编辑</span>
            </Button>
          </>
        )}
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

      <div className="min-h-0 flex-1 overflow-auto px-5 py-4">
        {loading && (
          <div className="space-y-2.5">
            {Array.from({ length: 8 }, (_, i) => (
              <div
                key={i}
                className="h-3.5 animate-pulse rounded bg-muted/70"
                style={{ width: `${58 + ((i * 37) % 42)}%` }}
              />
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <Icon className="h-10 w-10 text-muted-foreground/50" />
            <p className="max-w-xs text-sm text-muted-foreground">{error}</p>
            <Button size="sm" variant="secondary" onClick={onClose}>
              <X className="h-3.5 w-3.5" />
              关闭
            </Button>
          </div>
        )}

        {!loading && !error && !editing && (
          <pre className="whitespace-pre-wrap break-words font-mono text-[13px] leading-relaxed text-foreground/90">
            {content}
          </pre>
        )}

        {!loading && !error && editing && (
          <div className="flex flex-col gap-3">
            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              autoFocus
              spellCheck={false}
              className={cn(
                "h-[52vh] w-full resize-none rounded-xl border border-input bg-background/60 p-4 font-mono text-[13px] leading-relaxed text-foreground outline-none transition",
                "focus-visible:border-ring/60 focus-visible:ring-2 focus-visible:ring-ring/30",
              )}
            />
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">
                保存将上传为新版本并替换原文件（消耗相应存储额度）
              </span>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => setEditing(false)} disabled={saving}>
                  <X className="h-3.5 w-3.5" />
                  取消
                </Button>
                <Button size="sm" variant="primary" loading={saving} onClick={handleSave}>
                  {!saving && <Save className="h-3.5 w-3.5" />}
                  保存
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
