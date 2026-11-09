# Cloud Drop ☁️

轻量级个人云端文件中转站 / 网盘。部署在 **Cloudflare Pages** 上，文件浏览器直传 **Cloudflare R2**，
登录与存储额度复用 **一方工具箱（tool.fologde.com）OAuth2 统一登录**，无需任何数据库。

```
浏览器 ──登录──▶ 工具站 OAuth2 授权（SSO）
   │                    │ code 换 token（Pages Functions 服务端）
   │◀──────── AES-GCM 加密会话 Cookie ────────│
   │
   ├── POST /api/upload/credential ──▶ 主站签发预签名 PUT（额度预扣）
   ├── PUT 文件 ─────────────────────▶ R2 专属桶（浏览器直传，不经过子站服务器）
   ├── GET  /api/files ──────────────▶ R2 list（Pages Function，MY_BUCKET 绑定）
   └── DELETE /api/files/<key> ──────▶ R2 delete + 主站 storage-refund 退额
```

## 技术栈

- **前端**：Vite + React 18 + TypeScript + Tailwind CSS + lucide-react（shadcn 风格设计令牌，深/浅色模式）
- **后端**：Cloudflare Pages Functions（`/functions` 目录，TypeScript，workers-types 全程类型安全）
- **存储**：Cloudflare R2（主站登记的子站专属桶，对象 key 形如 `subsite/<uid>/<upload_id>/<文件名>`）
- **鉴权**：一方工具箱 OAuth2 授权码模式（`profile storage` scope），会话为 AES-GCM 加密 HttpOnly Cookie

## 项目结构

```
cloud-drop/
├── functions/                  # Pages Functions 后端
│   ├── auth/
│   │   ├── login.ts            # GET  /auth/login          生成 state → 跳转授权页
│   │   └── callback.ts         # GET  /auth/callback       换令牌 + 拉 userinfo + 种会话 Cookie
│   ├── api/
│   │   ├── auth/session.ts     # GET  /api/auth/session    当前用户 + 额度（唯一自动刷新令牌的入口）
│   │   ├── auth/logout.ts      # POST /api/auth/logout     撤销令牌 + 清 Cookie
│   │   ├── quota.ts            # GET  /api/quota           代理主站存储额度
│   │   ├── share.ts            # POST /api/share           创建 HMAC 签名分享链接
│   │   ├── move.ts             # POST /api/move            批量移动文件/文件夹（改清单，零拷贝）
│   │   ├── folders/
│   │   │   ├── index.ts        # POST /api/folders         新建文件夹
│   │   │   └── [[id]].ts       # PATCH/DELETE /api/folders/<id>  重命名/移动/删除（删除时内容上移）
│   │   ├── upload/credential.ts# POST /api/upload/credential  代理主站申请直传凭证
│   │   └── files/
│   │       └── [[key]].ts      # GET /api/files(列表+文件夹) 与 GET/DELETE /api/files/<key>
│   ├── s/
│   │   └── [[token]].ts        # GET /s/<token>            公开分享落地页 / 单文件下载 / 流式 ZIP 打包（无需登录）
│   └── lib/
│       ├── http.ts             # JSON 响应 / Cookie 解析
│       ├── session.ts          # AES-GCM 会话加解密 + Cookie
│       ├── oauth.ts            # 工具站 OAuth2 客户端 + 鉴权中间件
│       ├── share.ts            # 分享令牌 HMAC 签名 / 校验（零数据库）
│       ├── folders.ts          # 虚拟文件夹清单（__meta/folders.json）存取与防环
│       └── files.ts            # 用户隔离 / key 解析 / R2 遍历
├── src/                        # React 前端
│   ├── components/             # 上传区、文件网格/列表、预览弹窗、Toast 等
│   ├── hooks/                  # 主题 / 上传队列 / 全局拖拽
│   └── lib/                    # API 客户端、上传管理器、格式化、类型
├── wrangler.toml               # Pages + R2 绑定配置
├── tailwind.config.js / postcss.config.js
├── index.html
└── .dev.vars.example           # 本地环境变量模板
```

## 环境变量

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `OAUTH_CLIENT_ID` | ✅ | 工具箱后台 OAuth 应用的 `client_id`（`tc_` 开头） |
| `OAUTH_CLIENT_SECRET` | ✅ | `client_secret`（`tcs_` 开头），**仅存服务端** |
| `SESSION_SECRET` | ✅ | 会话 Cookie 加密密钥，随机长字符串（`openssl rand -hex 32`） |
| `OAUTH_REDIRECT_URI` | 可选 | 覆盖自动推导的回调地址（本地 Vite 代理调试时使用） |
| `ADMIN_USERS` | 可选 | 管理员用户名/用户ID（逗号分隔），可见并管理桶内全部文件 |

R2 绑定：`MY_BUCKET`（wrangler.toml 或 Dashboard Bindings 中配置），
**桶名必须与工具箱后台 OAuth 应用里登记的 R2 桶名一致**，且该桶位于主站的 Cloudflare 账号中
（本 Pages 项目需部署在同一账号下才能绑定到它）。

---

# 一、准备工作（工具箱后台）

1. 登录 [tool.fologde.com](https://tool.fologde.com) → **系统 → OAuth 应用 → 新建应用**：
   - **回调地址白名单**（精确匹配，每行一个）：
     ```
     http://localhost:5173/auth/callback     # 本地 Vite 代理调试
     http://localhost:8788/auth/callback     # 本地 wrangler 直接调试
     https://<你的-pages-域名>/auth/callback  # 生产（如 cloud-drop.pages.dev）
     ```
   - scope 申请：`profile storage`
2. 在该 OAuth 应用 **编辑页登记 R2 桶名**：先在主站同一 Cloudflare 账号中创建桶（如 `cloud-drop`），
   再填入应用设置。未登记桶名的应用申请凭证会返回 `403 upload_not_enabled`。
3. **为桶配置 R2 事件通知（实扣必须）**：上传完成后由主站 worker 消费 R2 事件队列完成额度实扣，
   桶必须把 `subsite/` 前缀的对象创建事件推送到主站队列（参照已登记的子站桶 `idea-store` 的规则）：
   ```bash
   npx wrangler r2 bucket notification create cloud-drop \
     --queue tools-web-file-upload-event \
     --event-types object-create \
     --prefix subsite/
   ```
   不配置的话：上传能成功、额度一直停在「预留中」，`used_bytes` 不增长。
4. 记下 `client_id` / `client_secret`（secret 仅展示一次）。

# 二、本地开发

```bash
cd D:\dev\cloudflare\pages\cloud-drop
npm install

# 配置本地环境变量
copy .dev.vars.example .dev.vars
#   填入 OAUTH_CLIENT_ID / OAUTH_CLIENT_SECRET / SESSION_SECRET
#   OAUTH_REDIRECT_URI=http://localhost:5173/auth/callback

npm run build        # 先构建一次（wrangler 需要静态目录）
```

开两个终端：

```bash
# 终端 A：Pages Functions（含 R2 本地模拟桶）
npm run pages:dev    # http://localhost:8788

# 终端 B：Vite 前端（/api 与 /auth 自动代理到 8788）
npm run dev          # http://localhost:5173  ← 浏览器访问这个
```

> **本地 R2 说明**：`wrangler pages dev` 默认使用**本地模拟桶**（空的）。浏览器直传走的是
> 主站签发到**真实桶**的预签名 URL，所以本地列表/删除操作的是模拟桶，看不到真实文件。
> **请勿在本地模式对真实文件执行删除**（R2 对象不会被删，但主站退额会真实生效）。
> 端到端联调建议直接部署一个 Pages 预览环境测试。

# 三、部署到 Cloudflare Pages

### 方式 A：wrangler 直传（推荐，配置全在 wrangler.toml）

```bash
# 首次：wrangler login 登录你的 Cloudflare 账号（主站同一账号）
npm run deploy
```

然后配置机密变量（wrangler.toml 不放机密）：

```bash
npx wrangler pages secret put OAUTH_CLIENT_SECRET --project-name cloud-drop
npx wrangler pages secret put SESSION_SECRET --project-name cloud-drop
```

非机密变量在 Dashboard → Workers & Pages → cloud-drop → **Settings → Variables** 添加：
`OAUTH_CLIENT_ID`（Production 与 Preview 都要加）。

R2 绑定已由 wrangler.toml 声明（`MY_BUCKET` → 你登记的桶名）。

### 方式 B：Git 集成

Dashboard → Workers & Pages → Create → Pages → 连接 Git 仓库：

- 构建命令：`npm run build`
- 输出目录：`dist`
- 部署后在 Settings 里手动添加 R2 绑定 `MY_BUCKET` 与上述环境变量
  （若项目启用了 wrangler.toml 配置导致后台不可编辑，可删除 wrangler.toml 中的绑定改在后台配置）。

### 最后一步

把 Pages 分配的域名（如 `https://cloud-drop.pages.dev/auth/callback`）**加入 OAuth 应用回调白名单**，
之后即可正常登录。

# 四、功能一览

- **上传**：页面任意位置拖拽 / 点击选择 / `Ctrl+V` 粘贴文件；粘贴纯文本自动生成 `.txt`（可改文件名）；
  XHR 直传带真实进度条，失败原因明确（额度不足 402 / 大小类型与凭证不符 403 / 超限等）
- **多选与批量**：网格卡片与列表行均支持复选（悬浮出现，移动端常显），支持当前筛选结果全选；
  批量操作条提供 **分享 / 批量下载 / 批量删除**（删除并发 3，额度结算中自动重试）
- **分享**：文件卡片「分享」按钮或多选批量生成公开链接（HMAC 签名，**零数据库**，1小时/24小时/7天/30天/永久五种有效期）；
  链接为 10 位短码形式 `/s/Ab3xK9zQ12`（映射记录存在桶的 `__shares/` 中，旧版长令牌链接保持兼容）；
  接收方无需登录，落地页展示文件列表，支持单文件下载与 **服务端流式 ZIP 一键打包**
  （fflate 直接串接 R2 流，不吃内存）；到期自动失效，无签名即 404
- **管理**：网格 / 列表视图，按名称搜索、按类型筛选（文本 / 图片 / 压缩包 / 其他）、按时间 / 大小 / 名称排序
- **文件夹**：新建 / 重命名 / 删除（内容自动上移到父级），面包屑导航；文件与文件夹均可移动——
  支持拖拽到文件夹卡片或面包屑节点、批量选中后「移动到…」弹窗树选择；新上传自动落入当前所在文件夹；
  搜索为全局范围并在结果中标注所在路径。
  设计说明：主站签发的对象 key 含 upload_id 不可变更，因此文件夹归属记录在用户前缀下的
  `__meta/folders.json` 清单中（移动 = 改清单），零数据拷贝、零额度影响
- **预览**：文本（txt / md / json / 代码等）在线查看 + 一键复制全文 + **在线编辑保存为新版本**；
  图片与 PDF 弹窗预览；任何文件一键下载
- **删除**：二次确认；删除后代理主站 `storage-refund` 退还额度，`409 not_settled_yet` 时 35 秒后自动重试
- **额度**：顶栏额度芯片（用量进度条 + 颜色分级），弹窗查看总容量 / 已用 / 预留中 / 剩余，点击可刷新
- **会话**：30 天有效；access_token 过期由前端串行化刷新后重试，退出登录撤销主站令牌
- **安全**：`client_secret` 仅存服务端；OAuth `state` 防 CSRF；会话 AES-GCM 加密 HttpOnly Cookie；
  文件按 `subsite/<uid>/` 前缀严格隔离，管理员（`ADMIN_USERS`）可管理全部

# 五、常见问题

| 现象 | 原因与处理 |
| --- | --- |
| 登录报 `redirect_uri 不一致` | 回调白名单是**精确匹配**，确认协议 / 域名 / 端口 / 路径与实际完全一致 |
| 登录后额度处显示「授权存储额度」按钮 | 令牌缺 `storage` scope（早期只授权过 profile），点按钮重新走一次授权即可 |
| 上传报 `upload_not_enabled` | 工具箱后台该 OAuth 应用未登记 R2 桶名 |
| 上传报「存储额度不足」 | 主站额度用完（402），去工具箱个人中心补充额度 |
| 上传成功但额度一直是「预留中」不实扣 | 桶缺少 R2 事件通知规则，见「准备工作」第 3 步配置 `subsite/` 前缀的 object-create 事件 |
| 上传 403「大小或类型与凭证不符」 | 预签名 PUT 把大小/类型签死，重试即可（原预扣已自动回滚） |
| 分享链接打开显示「链接无效」 | 令牌签名校验失败或已过有效期；重新生成即可。链接公开可访问，请只分享给信任对象 |
| 删除后提示「结算中」 | 刚上传就删、主站队列未记账，会自动重试；也可稍后手动刷新额度确认 |
| 本地 8788 端口被占用 | `npm run pages:dev -- --port 8791`，并把 `vite.config.ts` 中代理 target 的 8788 一并改掉 |
| 部署时 Dashboard 配置不可编辑 | 项目已由 wrangler.toml 接管配置，属于预期行为；绑定改动改 wrangler.toml 后重新 `npm run deploy` |

# 六、常用命令

```bash
npm run dev          # Vite 前端开发（代理到 8788）
npm run pages:dev    # Wrangler Pages Functions
npm run typecheck    # 前端 + Functions 双 tsconfig 类型检查
npm run build        # 类型检查 + 构建到 dist/
npm run deploy       # 构建 + 部署到 Cloudflare Pages
```
