import { AnimatePresence, motion } from "framer-motion"
import {
  ActivityIcon,
  ChevronLeftIcon,
  CircleAlertIcon,
  FileKey2Icon,
  GaugeIcon,
  LayoutDashboardIcon,
  MenuIcon,
  MonitorCogIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  ShieldCheckIcon,
} from "lucide-react"
import { useState, type ReactNode } from "react"

import { BrandMark } from "~/components/brand-mark"
import { UtilityMenus } from "~/components/utility-menus"
import { Button } from "~/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip"
import { cn } from "~/lib/utils"

const navigation = [
  { label: "总览", icon: LayoutDashboardIcon, active: true },
  { label: "监视器", icon: GaugeIcon },
  { label: "事件", icon: CircleAlertIcon },
  { label: "状态页", icon: ActivityIcon },
  { label: "API 密钥", icon: FileKey2Icon },
  { label: "系统", icon: MonitorCogIcon },
  { label: "安全", icon: ShieldCheckIcon },
]

export function AdminShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="min-h-svh bg-muted/45">
      <motion.aside
        className="fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-sidebar-border bg-sidebar p-3 lg:flex"
        animate={{ width: collapsed ? 76 : 248 }}
        transition={{ type: "spring", stiffness: 280, damping: 28 }}
      >
        <div className="flex h-14 items-center px-2">
          <BrandMark compact={collapsed} />
        </div>
        <nav
          aria-label="后台主导航"
          className="flex flex-1 flex-col gap-1 py-5"
        >
          {navigation.map((item, index) => {
            const Icon = item.icon
            const button = (
              <motion.button
                key={item.label}
                type="button"
                aria-label={item.label}
                className={cn(
                  "flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors",
                  item.active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  collapsed && "justify-center px-0"
                )}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.08 + index * 0.045, duration: 0.45 }}
              >
                <Icon className="size-4 shrink-0" aria-hidden="true" />
                <AnimatePresence initial={false}>
                  {!collapsed && (
                    <motion.span
                      className="truncate"
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: "auto" }}
                      exit={{ opacity: 0, width: 0 }}
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.button>
            )

            return collapsed ? (
              <Tooltip key={item.label}>
                <TooltipTrigger asChild>{button}</TooltipTrigger>
                <TooltipContent side="right">{item.label}</TooltipContent>
              </Tooltip>
            ) : (
              button
            )
          })}
        </nav>
        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          className="flex h-10 items-center justify-center gap-2 rounded-xl text-sm text-sidebar-foreground/65 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          aria-label={collapsed ? "展开导航" : "收起导航"}
        >
          {collapsed ? (
            <PanelLeftOpenIcon className="size-4" />
          ) : (
            <PanelLeftCloseIcon className="size-4" />
          )}
          {!collapsed && <span>收起导航</span>}
        </button>
      </motion.aside>

      <div
        className={cn(
          "min-h-svh transition-[padding-left] duration-500 ease-out",
          collapsed ? "lg:pl-19" : "lg:pl-62"
        )}
      >
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border/70 bg-background/85 px-4 backdrop-blur-xl md:px-7">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setMobileOpen((value) => !value)}
              aria-label="打开导航"
            >
              <MenuIcon aria-hidden="true" />
            </Button>
            <div className="flex items-center gap-2 text-sm">
              <span className="hidden text-muted-foreground sm:inline">
                运行中心
              </span>
              <ChevronLeftIcon
                className="hidden size-3 rotate-180 text-muted-foreground sm:block"
                aria-hidden="true"
              />
              <span className="font-medium">总览</span>
            </div>
          </div>
          <UtilityMenus showLogout />
        </header>

        <AnimatePresence>
          {mobileOpen && (
            <motion.nav
              aria-label="移动端后台导航"
              className="fixed inset-x-3 top-20 z-50 flex flex-col gap-1 rounded-2xl bg-popover p-3 text-popover-foreground shadow-xl ring-1 ring-foreground/10 lg:hidden"
              initial={{ opacity: 0, y: -16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.98 }}
            >
              {navigation.map((item) => {
                const Icon = item.icon
                return (
                  <button
                    key={item.label}
                    type="button"
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm",
                      item.active && "bg-primary text-primary-foreground"
                    )}
                  >
                    <Icon className="size-4" aria-hidden="true" />
                    {item.label}
                  </button>
                )
              })}
            </motion.nav>
          )}
        </AnimatePresence>

        {children}
      </div>
    </div>
  )
}
