import { useEffect, useRef, useState } from "react";
import { CloudUpload, ExternalLink, LogIn, LogOut, Moon, Search, Sun, X } from "lucide-react";
import type { CloudUser } from "../lib/types";
import { useToast } from "./Toast";
import { api } from "../lib/api";
import { Button, IconButton } from "./ui/Button";
import { Input } from "./ui/Input";
import { cn } from "../lib/cn";

interface TopBarProps {
  user: CloudUser;
  search: string;
  onSearchChange: (value: string) => void;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  onLogout: () => Promise<void>;
  searchInputRef: React.RefObject<HTMLInputElement>;
}

export function TopBar({
  user,
  search,
  onSearchChange,
  theme,
  onToggleTheme,
  onLogout,
  searchInputRef,
}: TopBarProps) {
  const { toast } = useToast();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  // 点击外部关闭用户菜单
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menuOpen]);

  const handleLogout = async () => {
    setMenuOpen(false);
    setLoggingOut(true);
    try {
      await api.logout();
      await onLogout();
      toast("success", "已退出登录");
    } catch {
      toast("error", "退出失败，请重试");
    } finally {
      setLoggingOut(false);
    }
  };

  const avatarLabel = user.username?.slice(0, 1).toUpperCase() || "?";

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:px-6">
        {/* Logo */}
        <a href="/" className="flex shrink-0 items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 shadow-sm shadow-indigo-500/30">
            <CloudUpload className="h-4.5 w-4.5 h-[18px] w-[18px] text-white" />
          </span>
          <span className="hidden text-[15px] font-semibold tracking-tight text-foreground sm:block">
            Cloud Drop
          </span>
        </a>

        {/* 搜索（桌面端） */}
        <div className="hidden flex-1 justify-center px-2 md:flex">
          <div className="relative w-full max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70" />
            <Input
              ref={searchInputRef}
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="搜索文件名…（按 / 聚焦）"
              className="h-9 rounded-full border-transparent bg-muted/70 pl-9 pr-8 focus-visible:bg-card"
            />
            {search && (
              <button
                type="button"
                aria-label="清空搜索"
                onClick={() => onSearchChange("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 md:hidden" />

        {/* 右侧操作 */}
        <div className="flex shrink-0 items-center gap-1.5">
          <IconButton
            label={theme === "dark" ? "切换到浅色模式" : "切换到深色模式"}
            onClick={onToggleTheme}
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </IconButton>

          <div ref={menuRef} className="relative">
            <button
              type="button"
              aria-label="账号菜单"
              onClick={() => setMenuOpen((prev) => !prev)}
              className={cn(
                "flex h-8 items-center gap-1.5 rounded-full border border-border bg-card pl-1 pr-1 transition hover:bg-muted/60",
                menuOpen && "ring-2 ring-ring/30",
              )}
            >
              {user.avatar ? (
                <img
                  src={user.avatar}
                  alt={user.username}
                  className="h-6 w-6 rounded-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                  {avatarLabel}
                </span>
              )}
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-10 w-60 animate-scale-in overflow-hidden rounded-xl border border-border bg-card shadow-xl dark:shadow-black/40">
                <div className="flex items-center gap-3 px-4 py-3">
                  {user.avatar ? (
                    <img
                      src={user.avatar}
                      alt={user.username}
                      className="h-9 w-9 rounded-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
                      {avatarLabel}
                    </span>
                  )}
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-foreground">{user.username}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {user.email || `ID: ${user.sub}`}
                    </div>
                  </div>
                </div>
                <div className="h-px bg-border" />
                <div className="p-1.5">
                  <a
                    href="https://tool.fologde.com"
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-foreground/90 transition hover:bg-muted/70"
                  >
                    <ExternalLink className="h-4 w-4 text-muted-foreground" />
                    一方工具箱
                  </a>
                  <Button
                    variant="ghost"
                    size="sm"
                    loading={loggingOut}
                    onClick={handleLogout}
                    className="w-full justify-start px-2.5 py-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    {!loggingOut && <LogOut className="h-4 w-4" />}
                    退出登录
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 搜索（移动端） */}
      <div className="border-t border-border/50 px-4 pb-2.5 pt-2 md:hidden">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70" />
          <Input
            ref={searchInputRef}
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="搜索文件名…"
            className="h-9 rounded-full border-transparent bg-muted/70 pl-9 pr-8"
          />
          {search && (
            <button
              type="button"
              aria-label="清空搜索"
              onClick={() => onSearchChange("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

export function LoginButton() {
  return (
    <Button variant="primary" size="sm" onClick={() => (window.location.href = "/auth/login")}>
      <LogIn className="h-4 w-4" />
      登录
    </Button>
  );
}
