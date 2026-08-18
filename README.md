# Monomi

Monomi 是一个轻量级、自托管的服务可用性监控器。一个 Bun 进程负责 API、静态页面、定时检测、通知重试和 SQLite 持久化。

## 功能

- HTTP/HTTPS、TCP 和 Heartbeat 监视器
- 故障阈值、恢复事件、响应时间和 90 天状态历史
- 单管理员登录和可选的可信网络免登录模式
- 可配置的公开状态页
- Generic Webhook 通知和持久化重试
- 配置导入、配置导出、SQLite 备份和重启式恢复
- 简体中文和英文界面
- Docker Compose 单容器部署

## 快速部署

### 前提

- Docker Engine
- Docker Compose

### 步骤

1. 创建环境文件：

   ```bash
   cp .env.example .env
   ```

2. 按需修改 `.env`。通过 HTTPS 反向代理访问时，将 `MONOMI_SECURE_COOKIE` 设为 `true`。

3. 构建并启动容器：

   ```bash
   docker compose up -d --build
   ```

4. 打开 `http://127.0.0.1:3000/setup`，创建唯一的管理员账户。

Compose 只把端口发布到 `127.0.0.1`。容器内的 Bun 服务监听 `0.0.0.0:3000`，以便 Docker 转发流量。

### Caddy 反向代理

```caddyfile
status.example.com {
    reverse_proxy 127.0.0.1:3000
    encode zstd gzip
}
```

修改 Caddyfile 后，先验证配置，再重新加载：

```bash
caddy validate --config /etc/caddy/Caddyfile
sudo caddy reload --config /etc/caddy/Caddyfile
```

## 配置

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `MONOMI_PORT` | `3000` | Docker Compose 在回环地址发布的主机端口。 |
| `MONOMI_AUTH_MODE` | `password` | 使用 `password`，或在可信私有网络中使用 `none`。 |
| `MONOMI_SECURE_COOKIE` | `false` | 通过 HTTPS 访问时设为 `true`。 |
| `MONOMI_CHECK_CONCURRENCY` | `10` | 单实例并发检测上限。 |
| `MONOMI_SESSION_SECRET` | 自动生成 | 可选会话签名密钥。留空时写入 `/data`。 |

服务端还支持 `MONOMI_HOST`、`MONOMI_DATA_DIR` 和运行时端口配置。Docker 镜像已将它们设为容器内所需值。

## 数据和恢复

Compose 将 `./monomi-data` 挂载到容器的 `/data`。该目录包含：

- SQLite 数据库及 WAL 文件
- 自动生成的会话密钥
- 上传的公开页 Logo
- 备份文件
- 待安装的恢复文件

不要同时启动两个使用同一数据目录的 Monomi 实例。

在“设置”页面创建或下载备份。上传的恢复文件会先经过 SQLite 完整性检查。Monomi 在下一次启动前安装该文件。

配置导出只包含可迁移的监视器、通知渠道和状态页设置。导出内容不包含管理员密码、会话、检查历史或 Heartbeat 令牌。导入 Heartbeat 监视器后，系统生成新令牌。

## 本地开发

Monomi 使用 Bun 作为运行时和包管理器。

```bash
bun install
bun run dev
```

开发模式启动两个进程：

- Hono API：`http://127.0.0.1:3001`
- React Router 开发服务器：终端显示的 Vite 地址

Vite 将 `/api`、`/health` 和 `/uploads` 代理到 Hono。

## 验证命令

```bash
bun run typecheck
bun test
bun run build
bun run db:check
docker compose build
```

`bun run build` 生成 React Router SPA。生产容器由 Hono 提供 `build/client` 和 SPA 回退。

## 数据库变更

`server/db/schema.ts` 是数据库结构的源文件。修改结构后生成迁移：

```bash
bun run db:generate
bun run db:check
```

必须提交 `drizzle/` 中由 drizzle-kit 生成的迁移。不要手写迁移 SQL，也不要使用 `drizzle-kit push`。

## 路由

- `/`：公开状态页
- `/setup`：首次管理员设置
- `/login`：管理员登录
- `/app`：运行总览
- `/app/monitors`：监视器管理
- `/app/incidents`：故障记录
- `/app/notifications`：Webhook 通知
- `/app/status-page`：公开状态页设置
- `/app/settings`：系统设置、备份和配置迁移
- `/health`：容器健康检查

## 安全边界

Monomi 允许回环、RFC1918、链路本地和内部 DNS 目标。这是内部服务监控的必要能力。只把管理界面暴露给可信用户，并在公网部署时使用 HTTPS 和 `MONOMI_SECURE_COOKIE=true`。

公开 API 不返回监视器目标、请求 Header、请求 Body、原始错误、Heartbeat 令牌、会话或 Webhook 配置。
