import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// 本地开发：
//   终端 A: npm run dev       → Vite 开发服务器 (http://localhost:5173)
//   终端 B: npm run pages:dev → Wrangler Pages Functions (http://localhost:8788)
// Vite 将 /api 与 /auth 代理到 Wrangler，前端热更新与后端函数同时可用。
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": { target: "http://127.0.0.1:8788", changeOrigin: true },
      "/auth": { target: "http://127.0.0.1:8788", changeOrigin: true },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    chunkSizeWarningLimit: 900,
  },
});
