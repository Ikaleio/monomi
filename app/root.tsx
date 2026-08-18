import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  isRouteErrorResponse,
} from "react-router"

import type { Route } from "./+types/root"
import { BrandMark } from "~/components/brand-mark"
import { Toaster } from "~/components/ui/sonner"
import { TooltipProvider } from "~/components/ui/tooltip"
import { ThemeProvider, useThemeMode } from "~/hooks/use-theme"
import "~/lib/i18n"
import "./app.css"

function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <ThemedProviders>{children}</ThemedProviders>
    </ThemeProvider>
  )
}

function ThemedProviders({ children }: { children: React.ReactNode }) {
  const { theme } = useThemeMode()
  return (
    <TooltipProvider>
      {children}
      <Toaster theme={theme} position="top-right" />
    </TooltipProvider>
  )
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className="bg-background">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#f7f8f6" />
        <Meta />
        <Links />
      </head>
      <body className="min-h-svh bg-background font-sans antialiased">
        <Providers>{children}</Providers>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  )
}

export default function App() {
  return <Outlet />
}

export function HydrateFallback() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-background p-6">
      <div className="flex flex-col items-center gap-4 text-center">
        <BrandMark />
        <p className="text-sm text-muted-foreground">正在载入运行状态…</p>
      </div>
    </main>
  )
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "页面出现问题"
  let details = "发生了意外错误，请稍后重试。"
  let stack: string | undefined

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "找不到页面" : "请求失败"
    details = error.status === 404 ? "请求的页面不存在。" : error.statusText || details
  } else if (import.meta.env.DEV && error instanceof Error) {
    details = error.message
    stack = error.stack
  }

  return (
    <main className="container mx-auto flex min-h-svh max-w-3xl flex-col gap-4 p-6 pt-20">
      <BrandMark />
      <h1 className="font-serif text-4xl font-semibold">{message}</h1>
      <p className="text-muted-foreground">{details}</p>
      {stack && (
        <pre className="w-full overflow-x-auto rounded-xl bg-muted p-4 text-sm">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  )
}
