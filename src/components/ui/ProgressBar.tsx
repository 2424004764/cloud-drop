import { cn } from "../../lib/cn";

interface ProgressBarProps {
  /** 0 - 100 */
  value: number;
  className?: string;
  barClassName?: string;
}

export function ProgressBar({ value, className, barClassName }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-muted", className)}>
      <div
        className={cn("h-full rounded-full bg-primary transition-all duration-150 ease-out", barClassName)}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
