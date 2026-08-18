# AGENTS.md

## 项目边界

Monomi 是一个单用户、单实例、单容器的自托管可用性监控器。

- Bun 是运行时和包管理器。
- Hono 提供 API、健康检查、静态资源和 SPA 回退。
- React Router v7 使用 SPA 模式，`ssr: false`。
- SQLite 通过 `bun:sqlite` 使用 WAL 模式。
- Drizzle ORM 定义结构并访问数据。
- drizzle-kit 生成并检查迁移。
- Zod 定义共享输入契约。
- SWR 管理浏览器 API 状态。

不要引入 PostgreSQL、Redis、队列、分布式 Worker、团队、RBAC、计费、企业 SSO 或多租户抽象。

## 必读文档

修改界面、组件、样式或动画前，必须阅读 `DESIGN-SYSTEM.md`。

修改部署、环境变量或运维流程时，必须同步检查 `README.md`、`.env.example`、`Dockerfile` 和 `compose.yaml`。

## 架构

```text
app/                         React Router SPA
  components/                业务组件和 shadcn/ui 组件
  hooks/                     SWR 读取模型
  lib/                       API、认证、i18n 和工具函数
  routes/                    公开页、认证页和 /app 管理页
server/                      Bun + Hono 服务
  db/                        Drizzle schema、SQLite 客户端和种子设置
  middleware/                管理员认证
  routes/                    Hono API
  services/                  检测器、调度器、通知、备份和配置迁移
shared/                      浏览器与服务端共享的 Zod 契约
drizzle/                     drizzle-kit 生成的迁移
tests/                       Bun 行为测试和本地测试夹具
```

生产环境由一个 Bun 进程运行 `server/index.ts`。该进程负责 HTTP 服务、调度、检测、通知重试、保留清理和 SQLite。

## 稳定契约

监视器类型：

- `http`
- `tcp`
- `heartbeat`

监视器状态：

- `pending`
- `operational`
- `degraded`
- `outage`
- `paused`

事件状态：

- `ongoing`
- `resolved`

通知事件：

- `outage`
- `recovery`
- `certificate_expiry`
- `test`

公开 API 不得返回目标地址、请求 Header、请求 Body、原始错误、Heartbeat 令牌、会话或 Webhook 配置。

内部目标是受支持的产品能力。不要阻止回环、RFC1918、链路本地或内部 DNS 地址。继续执行协议、超时、响应大小、重定向和输入长度限制。

## 数据库规则

`server/db/schema.ts` 是结构源文件。

修改数据库结构时：

1. 修改 Drizzle schema。
2. 运行 `bun run db:generate`。
3. 检查生成迁移。
4. 运行 `bun run db:check`。
5. 提交 schema、迁移和元数据。

不得手写迁移 SQL。不得使用 `drizzle-kit push`。不得绕过启动迁移。

需要跨表保持一致性的状态变化必须使用 SQLite 事务。事件创建、事件恢复、监视器状态和通知投递必须保持原子性。

## API 和认证规则

- `/` 是公开状态页。
- `/setup` 只在首次初始化前创建管理员。
- `/login` 登录唯一管理员。
- 所有管理页面位于 `/app/*`。
- 所有管理 API 位于 `/api/admin/*`。
- Heartbeat 接收路径位于 `/api/heartbeat/:token`。
- `/health` 必须同时检查数据库和调度器状态。

密码使用 `Bun.password` 的 Argon2id。会话 Cookie 必须是 HTTP-only。数据库只存储会话令牌的 SHA-256 哈希。

修改写入接口时，保留同源检查、Zod 校验和统一错误结构。

## 监控规则

- HTTP 检测必须限制重定向、响应体大小和总超时。
- TCP 检测必须使用 Bun TCP API，并在所有路径关闭 socket。
- Heartbeat 必须使用高熵令牌。轮换后旧令牌立即失效。
- 调度器不得回放停机期间错过的所有间隔。
- 同一监视器不得并发运行两个检测。
- 第一次失败只增加连续失败计数。达到阈值后创建故障事件。
- 故障后的第一次成功必须恢复事件并重置状态。

Generic Webhook 是唯一通知渠道。不要添加 SMTP 或特定聊天平台集成。

## UI 规则

- 优先复用 `app/components/ui/` 中的 shadcn/ui 组件。
- 新增 shadcn/ui 组件时使用 CLI。不要使用 `--overwrite`。
- 不要在页面中手写已有的 shadcn primitive。
- 组件之间使用 `gap-*`。不要使用 `space-x-*` 或 `space-y-*`。
- 使用语义颜色 token。不要在页面中新增任意颜色值。
- 图标使用 `lucide-react`。不要用 emoji 代替图标。
- 交互控件必须有可访问名称。
- 大型检查、事件和通知列表必须继续使用虚拟滚动。
- 浏览器状态使用 SWR。不要使用 `localStorage`。
- 主题、语言和会话使用 Cookie。

修改共享或导出符号前，使用 LSP 查找全部引用。迁移所有调用方，并删除旧路径、别名和兼容层。

## 开发命令

```bash
bun install
bun run dev
bun run typecheck
bun test
bun run build
bun run db:check
bun run format
```

只使用 Bun 运行项目命令和管理依赖。不要提交 npm、pnpm 或 Yarn 锁文件。

## 验证要求

错误修复必须先复现，再确认原路径不再失败。

后端或数据变更至少运行：

```bash
bun run typecheck
bun test
bun run db:check
```

前端变更还必须运行：

```bash
bun run build
```

使用真实浏览器验证受影响页面。完整功能变更需要覆盖首次设置、登录、监视器创建、故障、恢复和公开状态页。

部署变更必须运行 `docker compose build`。启动容器后检查 `/health`，并确认主机端口只绑定到 `127.0.0.1`。

## 部署和 Git

- `Dockerfile` 的构建和运行阶段都使用 Bun。
- `compose.yaml` 只将端口发布到主机回环地址。
- `/data` 是唯一持久化目录。
- 不要提交 `.env`、`monomi-data/`、SQLite 文件、WAL 文件、备份、构建产物或临时截图。
- 保留用户未提交的无关改动。
- 只有用户明确授权时才能提交、推送或修改生产部署。
