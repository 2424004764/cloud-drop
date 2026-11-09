import { CloudUpload } from "lucide-react";
import { cn } from "../lib/cn";

export function GlobalDropOverlay({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-[70] flex items-center justify-center bg-primary/5 backdrop-blur-[2px]">
      <div
        className={cn(
          "flex flex-col items-center gap-3 rounded-3xl border-[3px] border-dashed border-primary/60 bg-card/90 px-12 py-10 shadow-2xl",
          "animate-scale-in",
        )}
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <CloudUpload className="h-7 w-7 animate-bounce text-primary" />
        </div>
        <div className="text-base font-semibold text-foreground">松手即上传</div>
        <div className="text-xs text-muted-foreground">支持批量，签发凭证后浏览器直传 R2</div>
      </div>
    </div>
  );
}
