import { ArrowUpDown, ChevronDown, LayoutGrid, List } from "lucide-react";
import type { KindFilter, SortKey } from "../lib/types";
import { formatBytes } from "../lib/format";
import { cn } from "../lib/cn";

const KIND_CHIPS: { key: KindFilter; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "text", label: "文本" },
  { key: "image", label: "图片" },
  { key: "archive", label: "压缩包" },
  { key: "other", label: "其他" },
];

const SORTS: { key: SortKey; label: string }[] = [
  { key: "newest", label: "最新上传" },
  { key: "oldest", label: "最早上传" },
  { key: "largest", label: "体积从大到小" },
  { key: "smallest", label: "体积从小到大" },
  { key: "name", label: "文件名 A→Z" },
];

interface ToolbarProps {
  kind: KindFilter;
  onKindChange: (kind: KindFilter) => void;
  sort: SortKey;
  onSortChange: (sort: SortKey) => void;
  view: "grid" | "list";
  onViewChange: (view: "grid" | "list") => void;
  total: number;
  totalSize: number;
  quotaSlot?: React.ReactNode;
}

export function Toolbar({
  kind,
  onKindChange,
  sort,
  onSortChange,
  view,
  onViewChange,
  total,
  totalSize,
  quotaSlot,
}: ToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* 类型筛选 */}
      <div className="flex flex-wrap items-center gap-1.5">
        {KIND_CHIPS.map((chip) => (
          <button
            key={chip.key}
            type="button"
            onClick={() => onKindChange(chip.key)}
            className={cn(
              "h-7 rounded-full border px-3 text-xs font-medium transition-colors",
              kind === chip.key
                ? "border-transparent bg-foreground text-background shadow-sm"
                : "border-border bg-card text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}
          >
            {chip.label}
          </button>
        ))}
      </div>

      <div className="ml-auto flex flex-wrap items-center gap-2">
        {/* 统计 */}
        <span className="mr-1 hidden text-xs tabular-nums text-muted-foreground lg:block">
          {total} 个文件 · {formatBytes(totalSize)}
        </span>

        {quotaSlot}

        {/* 排序 */}
        <div className="relative">
          <ArrowUpDown className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <select
            value={sort}
            onChange={(event) => onSortChange(event.target.value as SortKey)}
            aria-label="排序方式"
            className={cn(
              "h-8 appearance-none rounded-lg border border-border bg-card py-0 pl-7.5 pl-8 pr-7 text-xs text-foreground outline-none transition",
              "hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring/30",
            )}
          >
            {SORTS.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        </div>

        {/* 视图切换 */}
        <div className="flex h-8 items-center rounded-lg border border-border bg-card p-0.5">
          {(
            [
              { key: "grid", icon: LayoutGrid, label: "网格视图" },
              { key: "list", icon: List, label: "列表视图" },
            ] as const
          ).map(({ key, icon: Icon, label }) => (
            <button
              key={key}
              type="button"
              aria-label={label}
              title={label}
              onClick={() => onViewChange(key)}
              className={cn(
                "flex h-7 w-8 items-center justify-center rounded-md transition-colors",
                view === key
                  ? "bg-muted text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
