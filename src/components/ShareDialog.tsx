import { useState } from "react";
import { Check, Copy, ExternalLink, Link2, Loader2, ShieldAlert } from "lucide-react";
import type { CloudFile } from "../lib/types";
import { api, sharePageUrl } from "../lib/api";
import { formatBytes, formatFullTime } from "../lib/format";
import { Modal, ModalHeader } from "./ui/Modal";
import { Button } from "./ui/Button";
import { useToast } from "./Toast";
import { cn } from "../lib/cn";

interface ShareDialogProps {
  open: boolean;
  files: CloudFile[];
  onClose: () => void;
}

const EXPIRY_OPTIONS: { value: number | null; label: string }[] = [
  { value: 3600, label: "1 小时" },
  { value: 86400, label: "24 小时" },
  { value: 604800, label: "7 天" },
  { value: 2_592_000, label: "30 天" },
  { value: null, label: "永久" },
];

interface ShareResult {
  url: string;
  expiresAt: number | null;
}

export function ShareDialog({ open, files, onClose }: ShareDialogProps) {
  const { toast } = useToast();
  const [expiresIn, setExpiresIn] = useState<number | null>(604_800);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<ShareResult | null>(null);
  const [copied, setCopied] = useState(false);

  const totalSize = files.reduce((sum, f) => sum + f.size, 0);

  const reset = () => {
    setResult(null);
    setCopied(false);
    setGenerating(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const generate = async () => {
    setGenerating(true);
    try {
      const created = await api.createShare(
        files.map((f) => f.key),
        expiresIn,
      );
      setResult({
        url: sharePageUrl(created.shareId),
        expiresAt: created.expiresAt,
      });
    } catch (error) {
      toast("error", error instanceof Error ? error.message : "生成分享链接失败");
    } finally {
      setGenerating(false);
    }
  };

  const copyLink = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
      toast("success", "分享链接已复制");
    } catch {
      toast("error", "复制失败，请手动复制输入框中的链接");
    }
  };

  if (!open || files.length === 0) return null;

  return (
    <Modal open onClose={handleClose} className="max-w-md">
      <ModalHeader
        title={
          <span className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-primary" />
            分享文件
          </span>
        }
        subtitle={`${files.length} 个文件 · 共 ${formatBytes(totalSize)}`}
        onClose={handleClose}
      />

      <div className="space-y-4 px-5 py-4">
        {!result ? (
          <>
            <p className="text-xs leading-5 text-muted-foreground">
              将创建一个公开分享链接，任何人无需登录即可在落地页查看并下载这些文件。
            </p>

            <div>
              <div className="mb-1.5 text-xs font-medium text-muted-foreground">链接有效期</div>
              <div className="flex flex-wrap gap-1.5">
                {EXPIRY_OPTIONS.map((option) => (
                  <button
                    key={option.label}
                    type="button"
                    onClick={() => setExpiresIn(option.value)}
                    className={cn(
                      "h-7 rounded-full border px-3 text-xs font-medium transition-colors",
                      expiresIn === option.value
                        ? "border-transparent bg-foreground text-background shadow-sm"
                        : "border-border bg-card text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/[0.06] p-3">
              <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
              <p className="text-[11px] leading-4 text-amber-600 dark:text-amber-400/90">
                任何拿到链接的人都可下载这些文件，请仅分享给信任的对象。链接到期后自动失效。
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="secondary" onClick={handleClose} disabled={generating}>
                取消
              </Button>
              <Button variant="primary" loading={generating} onClick={generate}>
                {!generating && <Link2 className="h-4 w-4" />}
                生成分享链接
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-start gap-2 rounded-xl border border-border bg-muted/30 p-3">
              <Link2 className="mt-2 h-4 w-4 shrink-0 text-primary" />
              <input
                readOnly
                value={result.url}
                onFocus={(event) => event.target.select()}
                className="w-full bg-transparent py-2 font-mono text-xs text-foreground outline-none"
              />
            </div>

            <p className="text-xs text-muted-foreground">
              {result.expiresAt
                ? `有效期至 ${formatFullTime(new Date(result.expiresAt).toISOString())}`
                : "该链接永久有效，请妥善保管"}
            </p>

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="secondary" onClick={reset}>
                重新生成
              </Button>
              <a
                href={result.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted/60"
              >
                <ExternalLink className="h-4 w-4" />
                打开落地页
              </a>
              <Button variant="primary" onClick={copyLink}>
                {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                {copied ? "已复制" : "复制链接"}
              </Button>
            </div>
          </>
        )}

        {generating && (
          <div className="flex items-center justify-center gap-2 py-1 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            正在签名生成链接…
          </div>
        )}
      </div>
    </Modal>
  );
}
