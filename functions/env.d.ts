// Cloudflare Pages Functions 环境类型
// - MY_BUCKET: R2 存储桶绑定（wrangler.toml [[r2_buckets]] 或 Dashboard Bindings 中配置）
// - OAUTH_CLIENT_ID / OAUTH_CLIENT_SECRET: 一方工具箱 OAuth 应用凭证
// - SESSION_SECRET: 会话 Cookie 加密密钥（随机长字符串）
// - OAUTH_REDIRECT_URI: 可选，覆盖自动推导的回调地址
// - ADMIN_USERS: 可选，逗号分隔的管理员用户名/用户ID（可见并管理全部文件）

declare interface Env {
  MY_BUCKET: R2Bucket;
  OAUTH_CLIENT_ID: string;
  OAUTH_CLIENT_SECRET: string;
  SESSION_SECRET: string;
  OAUTH_REDIRECT_URI?: string;
  ADMIN_USERS?: string;
}
