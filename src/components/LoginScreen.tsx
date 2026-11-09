import {
  CloudUpload,
  FileText,
  FolderInput,
  Gauge,
  LogIn,
  Share2,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { Button } from "./ui/Button";

interface Feature {
  icon: LucideIcon;
  title: string;
  desc: string;
}

const FEATURES: Feature[] = [
  {
    icon: ShieldCheck,
    title: "浏览器直传 R2",
    desc: "预签名凭证直传专属存储桶，文件不经过任何服务器，大小与类型全程锁定。",
  },
  {
    icon: Gauge,
    title: "存储额度实时可视",
    desc: "上传预扣、事件实扣，由一方工具箱统一记账，剩余空间一目了然。",
  },
  {
    icon: FolderInput,
    title: "文件夹与批量操作",
    desc: "文件夹整理、拖拽移动、多选批量，全局搜索直抵任意层级的文件。",
  },
  {
    icon: Share2,
    title: "短码分享",
    desc: "10 位短码公开链接，支持有效期；多文件一键流式打包为 ZIP 下载。",
  },
];

const STEPS: { title: string; desc: string }[] = [
  { title: "选择文件", desc: "拖拽 / 点击 / Ctrl+V 粘贴文本" },
  { title: "签发凭证", desc: "工具箱校验额度并预扣" },
  { title: "直传 R2", desc: "浏览器携带预签名 URL 上传" },
  { title: "事件实扣", desc: "R2 事件结算，额度精准无误" },
];

export function LoginScreen() {
  const login = () => {
    window.location.href = "/auth/login";
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      {/* 背景装饰 */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-[-30%] h-[560px] w-[900px] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute bottom-[-20%] left-[-15%] h-[360px] w-[460px] rounded-full bg-violet-500/10 blur-3xl" />
        <div className="absolute bottom-[-10%] right-[-10%] h-[300px] w-[400px] rounded-full bg-sky-500/10 blur-3xl" />
      </div>

      {/* 顶部导航 */}
      <header className="relative z-10 mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 shadow-sm shadow-indigo-500/30">
            <CloudUpload className="h-[18px] w-[18px] text-white" />
          </span>
          <span className="text-[15px] font-semibold tracking-tight">Cloud Drop</span>
        </div>
        <Button variant="primary" size="sm" onClick={login}>
          <LogIn className="h-4 w-4" />
          登录
        </Button>
      </header>

      {/* Hero */}
      <section className="relative z-10 mx-auto flex w-full max-w-3xl flex-col items-center px-4 pb-20 pt-16 text-center sm:pt-24">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 shadow-lg shadow-indigo-500/30">
          <CloudUpload className="h-8 w-8 text-white" />
        </div>

        <h1 className="mt-6 text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
          轻量云端文件中转站
        </h1>
        <p className="mt-4 text-2xl font-semibold">
          <span className="bg-gradient-to-r from-indigo-500 to-violet-500 bg-clip-text text-transparent">
            上传、预览、整理、分享，一气呵成
          </span>
        </p>
        <p className="mt-5 max-w-xl text-sm leading-6 text-muted-foreground">
          拖上去、点开看、一链分享。文件存于你专属的 Cloudflare R2，
          登录与存储额度由一方工具箱统一管理，无需注册任何新账号。
        </p>

        <div className="mt-8 flex flex-col items-center gap-3">
          <Button variant="primary" size="lg" className="h-11 px-8 text-[15px]" onClick={login}>
            <LogIn className="h-4 w-4" />
            使用工具箱账号登录
          </Button>
          <span className="text-xs text-muted-foreground">
            SSO 单点登录 · 上传消耗工具箱存储额度
          </span>
        </div>
      </section>

      {/* 功能特性 */}
      <section className="relative z-10 mx-auto w-full max-w-5xl px-4 pb-8 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="rounded-2xl border border-border bg-card/70 p-5 shadow-sm backdrop-blur transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="mt-3.5 text-sm font-semibold">{title}</h3>
              <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 工作原理 */}
      <section className="relative z-10 mx-auto w-full max-w-5xl px-4 pb-20 pt-10 sm:px-6">
        <h2 className="text-center text-lg font-semibold tracking-tight">工作原理</h2>
        <p className="mt-1.5 text-center text-xs text-muted-foreground">
          文件不落地任何中间服务器，额度由主站统一预扣与结算
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, index) => (
            <div key={step.title} className="relative rounded-2xl border border-border bg-card/50 p-5">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-foreground text-xs font-bold text-background">
                {index + 1}
              </span>
              <h3 className="mt-3 text-sm font-semibold">{step.title}</h3>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 底部 CTA */}
      <section className="relative z-10 mx-auto w-full max-w-5xl px-4 pb-16 sm:px-6">
        <div className="rounded-2xl border border-border bg-card/70 p-8 text-center shadow-sm backdrop-blur sm:p-10">
          <h2 className="text-lg font-semibold tracking-tight">准备好了吗？</h2>
          <p className="mx-auto mt-2 max-w-md text-xs leading-5 text-muted-foreground">
            一个工具箱账号即可开始，所有文件都在你自己的 Cloudflare 账号里。
          </p>
          <Button variant="primary" size="lg" className="mt-6 h-11 px-8" onClick={login}>
            <LogIn className="h-4 w-4" />
            立即登录使用
          </Button>
        </div>
      </section>

      <footer className="relative z-10 pb-8 text-center text-[11px] text-muted-foreground/60">
        Powered by Cloudflare Pages + R2 · 统一登录与存储额度由 一方工具箱 提供
      </footer>
    </div>
  );
}
