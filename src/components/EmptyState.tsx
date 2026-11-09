import { CloudUpload, SearchX } from "lucide-react";

interface EmptyStateProps {
  /** 是否因为搜索/筛选无结果 */
  filtered: boolean;
}

export function EmptyState({ filtered }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/40 px-6 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/60">
        {filtered ? (
          <SearchX className="h-7 w-7 text-muted-foreground/70" />
        ) : (
          <CloudUpload className="h-7 w-7 text-muted-foreground/70" />
        )}
      </div>
      <p className="mt-4 text-sm font-medium text-foreground">
        {filtered ? "没有匹配的文件" : "还没有文件"}
      </p>
      <p className="mt-1.5 max-w-xs text-xs leading-5 text-muted-foreground">
        {filtered
          ? "换个关键词，或清除筛选条件试试"
          : "拖拽文件到页面任意位置，点击上方区域选择，或 Ctrl+V 直接粘贴上传"}
      </p>
    </div>
  );
}

export function GridSkeleton({ count = 10 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="aspect-[4/3] animate-pulse bg-muted/60" />
          <div className="space-y-2 p-3">
            <div className="h-3 w-3/4 animate-pulse rounded bg-muted/60" />
            <div className="h-2.5 w-1/2 animate-pulse rounded bg-muted/40" />
          </div>
        </div>
      ))}
    </div>
  );
}
