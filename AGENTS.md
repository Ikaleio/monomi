# AGENTS.md

## 项目边界

Monomi 是一个纯前端 Uptime / 服务状态监控 DEMO。

- 项目使用 Bun、React Router v7 SPA、Tailwind CSS v4、shadcn/ui 和 Framer Motion。
- 页面只展示本地 Mock 数据。
- 项目不连接后端，不发送业务网络请求，不使用数据库。
- 项目不实现身份验证、权限、真实监控、证书扫描、通知、定时任务、WebSocket 或持久化。
- 按钮、菜单和导航项可以展示交互状态，但不得伪装成已实现的业务功能。

## 必读文档

修改任何页面、组件、样式、动画或 Mock 数据前，**必须先阅读 `DESIGN-SYSTEM.md`**。

`DESIGN-SYSTEM.md` 定义以下内容：

- 色板和语义 token
- 思源黑体、思源宋体的使用规则
- 页面布局和响应式断点
- shadcn/ui 组件组合方式
- Framer Motion 动画节奏
- 可访问性和视觉验证要求

如果改动与设计系统冲突，优先修改实现以符合设计系统。只有在需求明确改变视觉方向时，才修改设计系统文档。

## 目录结构

```text
app/
├── app.css                         全局 token、字体和基础样式
├── root.tsx                        HTML 壳、Meta、TooltipProvider
├── routes.ts                       React Router 路由表
├── routes/
│   ├── home.tsx                    公开状态页路由 `/`
│   └── overview.tsx                后台总览路由 `/overview`
├── components/
│   ├── public-status-page.tsx      公开状态页组合
│   ├── admin-shell.tsx             后台侧栏和顶部壳
│   ├── overview-dashboard.tsx      后台总览内容
│   ├── monitor-card.tsx             监视器状态卡片
│   ├── status-history.tsx           90 天状态单元和 Tooltip
│   ├── utility-menus.tsx            语言、主题和退出入口
│   ├── motion-primitives.tsx        Reveal 和 stagger 动画
│   └── ui/                         shadcn/ui 源码组件
└── data/
    └── mock-data.ts                 所有本地展示数据和类型
```

## 页面契约

### 公开状态页 `/`

必须保留以下信息层级：

1. 站点标识和语言、主题入口。
2. 当前项目名称、整体状态、更新时间。
3. 多个监视器及其 24 小时、7 天、30 天可用率。
4. 每个监视器的连续 90 天每日记录。
5. 每个日期的 Tooltip：日期、状态、可用率、检查次数。
6. 最近事件列表或空状态。
7. footer。

### 后台总览 `/overview`

必须保留以下信息层级：

1. 后台导航：总览、监视器、事件、状态页、API 密钥、系统、安全、收起导航。
2. 顶部语言、主题和退出入口。
3. 全局运行状态、成功率、监视器数量、故障数量、证书数量。
4. 核心统计。
5. 监视器摘要。
6. 需要关注列表或空状态。

其他导航项不应新增没有实现的页面。

## 数据约定

- 所有展示数据放在 `app/data/mock-data.ts`。
- 使用 TypeScript 类型描述监视器、每日历史、事件、证书和待关注项。
- 页面组件必须支持数组中的多条数据。
- 不要把页面结构写成只支持一条监视器或一条事件。
- 日期历史必须保持 90 条连续记录。
- 修改 Mock 数据时，同时检查公开页和后台页是否仍能展示正常、异常、维护和空状态。

## UI 实现规则

- 修改界面前阅读 `DESIGN-SYSTEM.md`。
- 优先复用 `app/components/ui/` 中的 shadcn/ui 组件。
- 新增 shadcn/ui 组件前使用 shadcn CLI 安装，并检查生成文件。
- 组件之间使用 `gap-*`，不要使用 `space-x-*` 或 `space-y-*`。
- 使用语义 token，例如 `bg-background`、`text-foreground`、`bg-primary` 和 `text-muted-foreground`。
- 不在页面中直接新增任意颜色值。
- 图标使用项目已有的 `lucide-react`，不要使用 emoji 代替图标。
- 交互控件必须有可访问名称。图标按钮必须使用 `aria-label`。
- 90 天状态单元必须支持键盘焦点和 Tooltip。
- 弹层组件必须保留可访问标题或可访问名称。
- 页面必须先满足移动端布局，再增强桌面端布局。

## 动画规则

- 使用 Framer Motion，不要添加新的动画库。
- 动画应表达内容层级和状态变化，不得遮挡信息。
- 使用短距离位移、透明度、轻微缩放和 spring；避免夸张弹跳。
- 滚动进入动画必须设置 `viewport={{ once: true }}`，避免重复触发造成阅读干扰。
- 动画失败时，内容仍必须可读。不要依赖动画完成后才生成内容。
- 不使用渐变、发光装饰、漂浮抽象形状或无意义的技术标签。

## 开发命令

在仓库根目录运行：

```bash
bun install
bun run dev
bun run typecheck
bun run build
bun run format
```

- `bun run typecheck` 检查 React Router 类型生成和 TypeScript。
- `bun run build` 生成 React Router SPA 构建产物。
- `bun run format` 使用 Prettier 和 Tailwind 插件格式化 TypeScript 文件。
- 不要把 `build/` 产物手动复制回 `app/`。

## 验证要求

完成界面改动后，必须：

1. 运行 `bun run typecheck`。
2. 运行 `bun run build`。
3. 启动开发服务器，在浏览器打开 `/` 和 `/overview`。
4. 检查桌面端和移动端首屏。
5. 检查路由直接访问、移动导航、侧栏收起和 Tooltip。
6. 检查页面内容在动画未触发时仍然可读。

除非用户明确要求，不要添加后端测试、数据库、认证或数据持久化。

## 部署和 Git

- Vercel 配置位于 `vercel.json`。
- 这是 SPA。路由直接访问必须回退到 `index.html`。
- 提交前检查 `git diff`，确认没有凭据、临时截图、构建产物或本地状态文件。
- 不要覆盖用户未创建的改动。
- 不要在没有明确授权时执行 `git push`、删除远程分支或修改生产部署。
