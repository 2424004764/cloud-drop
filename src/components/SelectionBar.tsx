import { Download, FolderInput, Share2, Trash2, X } from "lucide-react";
import { Checkbox } from "./ui/Checkbox";
import { Button } from "./ui/Button";
import { cn } from "../lib/cn";

interface SelectionBarProps {
  count: number;
  allVisibleSelected: boolean;
  anyVisibleSelected: boolean;
  busy?: boolean;
  onSelectAll: () => void;
  onShare: () => void;
  onDownload: () => void;
  onMove: () => void;
  onDelete: () => void;
  onClear: () => void;
}

export function SelectionBar({
  count,
  allVisibleSelected,
  anyVisibleSelected,
  busy,
  onSelectAll,
  onShare,
  onDownload,
  onMove,
  onDelete,
  onClear,
}: SelectionBarProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-1.5 rounded-xl border border-primary/25 bg-card/95 px-3 py-2 shadow-lg shadow-primary/5 backdrop-blur animate-slide-down",
        "dark:bg-card/90 dark:shadow-black/30",
        "md:sticky md:top-[3.7rem] md:z-30",
      )}
    >
      <Checkbox
        checked={allVisibleSelected}
        indeterminate={anyVisibleSelected && !allVisibleSelected}
        onChange={onSelectAll}
        label="全选 / 取消全选（当前筛选结果）"
      />
      <span className="mr-1 text-xs font-semibold text-foreground">
        已选 {count} 项
      </span>

      <div className="mx-1 hidden h-4 w-px bg-border sm:block" />

      <div className="flex flex-wrap items-center gap-1.5">
        <Button size="sm" variant="primary" loading={busy} onClick={onShare}>
          {!busy && <Share2 className="h-3.5 w-3.5" />}
          分享
        </Button>
        <Button size="sm" variant="secondary" loading={busy} onClick={onDownload}>
          {!busy && <Download className="h-3.5 w-3.5" />}
          下载
        </Button>
        <Button size="sm" variant="secondary" loading={busy} onClick={onMove}>
          {!busy && <FolderInput className="h-3.5 w-3.5" />}
          移动到…
        </Button>
        <Button
          size="sm"
          variant="ghost"
          loading={busy}
          onClick={onDelete}
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          {!busy && <Trash2 className="h-3.5 w-3.5" />}
          删除
        </Button>
        <Button size="sm" variant="ghost" onClick={onClear} disabled={busy}>
          <X className="h-3.5 w-3.5" />
          取消选择
        </Button>
      </div>
    </div>
  );
}
