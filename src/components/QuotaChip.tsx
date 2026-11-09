import { useState } from "react";
import { Database, ExternalLink, Gauge, RefreshCw } from "lucide-react";
import type { Quota } from "../lib/types";
import { formatBytes } from "../lib/format";
import { Modal, ModalHeader } from "./ui/Modal";
import { ProgressBar } from "./ui/ProgressBar";
import { Button } from "./ui/Button";
import { cn } from "../lib/cn";

function quotaPercent(quota: Quota): number {
  if (quota.quota_bytes <= 0) return 0;
  return Math.min(100, (quota.used_bytes / quota.quota_bytes) * 100);
}

function quotaBarColor(quota: Quota): string {
  const percent = quotaPercent(quota);
  if (percent >= 90) return "bg-destructive";
  if (percent >= 70) return "bg-amber-500";
  return "bg-emerald-500";
}

interface QuotaChipProps {
  quota: Quota | null;
  insufficientScope?: boolean;
  loading: boolean;
  onRefresh: () => void;
  onReauth: () => void;
}

export function QuotaChip({ quota, insufficientScope, loading, onRefresh, onReauth }: QuotaChipProps) {
  const [detailOpen, setDetailOpen] = useState(false);

  if (insufficientScope || (!quota && !loading)) {
    return (
      <Button size="sm" onClick={onReauth} className="h-8">
        <Gauge className="h-3.5 w-3.5" />
        授权存储额度
      </Button>
    );
  }

  if (!quota) {
    return <div className="h-8 w-44 animate-pulse rounded-full border border-border bg-muted/50" />;
  }

  return (
    <>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setDetailOpen(true)}
          title="存储额度详情"
          className="flex h-8 items-center gap-2 rounded-full border border-border bg-card px-2.5 text-xs transition-colors hover:bg-muted/60"
        >
          <Database className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="hidden text-muted-foreground sm:inline">已用</span>
          <span className="font-medium tabular-nums text-foreground">
            {formatBytes(quota.used_bytes)}
          </span>
          <span className="text-muted-foreground/60">/</span>
          <span className="tabular-nums text-muted-foreground">
            {formatBytes(quota.quota_bytes)}
          </span>
          <span className="ml-0.5 h-1.5 w-14 overflow-hidden rounded-full bg-muted">
            <span
              className={cn("block h-full rounded-full transition-all", quotaBarColor(quota))}
              style={{ width: `${quotaPercent(quota)}%` }}
            />
          </span>
        </button>
        <button
          type="button"
          aria-label="刷新额度"
          title="刷新额度"
          onClick={onRefresh}
          className="flex h-8 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
        </button>
      </div>

      <Modal open={detailOpen} onClose={() => setDetailOpen(false)} className="max-w-sm">
        <ModalHeader title="存储额度" subtitle="由一方工具箱统一预扣与结算" onClose={() => setDetailOpen(false)} />
        <div className="space-y-4 px-5 py-4">
          <div>
            <div className="mb-1.5 flex items-baseline justify-between text-xs">
              <span className="text-muted-foreground">已使用</span>
              <span className="tabular-nums text-foreground">
                {formatBytes(quota.used_bytes)} / {formatBytes(quota.quota_bytes)}
              </span>
            </div>
            <ProgressBar value={quotaPercent(quota)} className="h-2" barClassName={quotaBarColor(quota)} />
          </div>

          <div className="space-y-2 rounded-xl border border-border bg-muted/30 p-3 text-xs">
            <Row label="总容量" value={formatBytes(quota.quota_bytes)} />
            <Row label="已使用（已确认上传）" value={formatBytes(quota.used_bytes)} />
            <Row label="预留中（上传中）" value={formatBytes(quota.pending_bytes)} />
            <Row label="剩余可用" value={formatBytes(quota.remaining_bytes)} strong />
            {quota.price && (
              <Row
                label="额度定价"
                value={`${quota.price.credits} 积分 / ${formatBytes(quota.price.bytes)}`}
              />
            )}
          </div>

          <p className="text-[11px] leading-4 text-muted-foreground/80">
            上传签发凭证时即预扣额度，完成后按实际大小结算；15 分钟内未完成会自动归还。删除文件后额度由主站记账退还。
          </p>

          <a
            href="https://tool.fologde.com"
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-1.5 text-xs text-primary hover:underline"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            前往工具箱管理额度
          </a>
        </div>
      </Modal>
    </>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("tabular-nums", strong ? "font-semibold text-foreground" : "text-foreground/90")}>
        {value}
      </span>
    </div>
  );
}
