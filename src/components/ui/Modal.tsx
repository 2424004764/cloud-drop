import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "../../lib/cn";
import { IconButton } from "./Button";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  /** 点击遮罩是否关闭（默认 true） */
  dismissable?: boolean;
}

export function Modal({ open, onClose, children, className, dismissable = true }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && dismissable) onClose();
    };
    window.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose, dismissable]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6" role="dialog" aria-modal="true">
      <div
        aria-hidden
        className="absolute inset-0 animate-fade-in bg-black/40 backdrop-blur-sm dark:bg-black/60"
        onClick={dismissable ? onClose : undefined}
      />
      <div
        className={cn(
          "relative flex w-full flex-col overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-2xl animate-scale-in",
          "max-h-[calc(100vh-2rem)] dark:shadow-black/50",
          className ?? "max-w-lg",
        )}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function ModalHeader({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  onClose?: () => void;
  children?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-sm font-semibold leading-5" title={typeof title === "string" ? title : undefined}>
          {title}
        </h2>
        {subtitle && <div className="mt-0.5 text-xs text-muted-foreground">{subtitle}</div>}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {children}
        {onClose && <IconButton label="关闭" onClick={onClose} className="-mr-1">
          <X className="h-4 w-4" />
        </IconButton>}
      </div>
    </div>
  );
}
