import { useRef } from "react";
import { CloudUpload, MousePointerClick } from "lucide-react";
import { cn } from "../lib/cn";

interface UploadZoneProps {
  onPickFiles: (files: File[]) => void;
}

export function UploadZone({ onPickFiles }: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="选择文件上传"
      onClick={() => inputRef.current?.click()}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") inputRef.current?.click();
      }}
      className={cn(
        "group flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-border bg-card/50 px-6 py-9 text-center outline-none transition-all duration-200 sm:py-10",
        "hover:border-primary/50 hover:bg-primary/[0.04] hover:shadow-[0_0_0_4px_hsl(var(--primary)/0.06)]",
        "focus-visible:border-primary/60 focus-visible:ring-2 focus-visible:ring-ring/30",
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:scale-105">
        <CloudUpload className="h-6 w-6 text-primary" />
      </div>

      <div className="text-sm font-medium text-foreground">
        拖拽文件到页面任意位置，或
        <span className="mx-1 inline-flex items-center gap-0.5 text-primary">
          <MousePointerClick className="h-3.5 w-3.5" />
          点击选择文件
        </span>
      </div>

      <div className="max-w-md text-xs leading-5 text-muted-foreground">
        支持批量上传 · 单文件最大 500MB · 也可直接
        <kbd className="mx-1 rounded border border-border bg-muted px-1 py-0.5 font-mono text-[10px]">
          Ctrl+V
        </kbd>
        粘贴文件，或粘贴文本自动生成 .txt
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          if (files.length > 0) onPickFiles(files);
          event.target.value = "";
        }}
      />
    </div>
  );
}
