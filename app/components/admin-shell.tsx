import { ActivityIcon, BellRingIcon, CircleAlertIcon, GaugeIcon, LayoutDashboardIcon, SettingsIcon } from "lucide-react"
import { Link, useLocation } from "react-router"
import { useTranslation } from "react-i18next"
import type { ReactNode } from "react"

import packageJson from "../../package.json"
import { BrandMark } from "~/components/brand-mark"
import { UtilityMenus } from "~/components/utility-menus"
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarRail, SidebarTrigger, useSidebar } from "~/components/ui/sidebar"

const navigation = [
  { key: "overview", icon: LayoutDashboardIcon, href: "/app" },
  { key: "monitors", icon: GaugeIcon, href: "/app/monitors" },
  { key: "incidents", icon: CircleAlertIcon, href: "/app/incidents" },
  { key: "notifications", icon: BellRingIcon, href: "/app/notifications" },
  { key: "statusPage", icon: ActivityIcon, href: "/app/status-page" },
  { key: "settings", icon: SettingsIcon, href: "/app/settings" },
] as const

function SidebarBrand() {
  const { state } = useSidebar()
  return <BrandMark compact={state === "collapsed"} />
}

export function AdminShell({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const location = useLocation()
  const activeItem = navigation.find((item) => item.href === "/app" ? location.pathname === item.href : location.pathname.startsWith(item.href)) ?? navigation[0]
  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader className="h-16 justify-center border-b border-sidebar-border px-3"><SidebarBrand /></SidebarHeader>
        <SidebarContent><SidebarGroup><SidebarGroupLabel>{t("runtimeCenter")}</SidebarGroupLabel><SidebarGroupContent><SidebarMenu>{navigation.map((item) => { const Icon = item.icon; const active = item.href === "/app" ? location.pathname === item.href : location.pathname.startsWith(item.href); return <SidebarMenuItem key={item.href}><SidebarMenuButton asChild isActive={active} tooltip={t(item.key)}><Link to={item.href}><Icon aria-hidden="true" /><span>{t(item.key)}</span></Link></SidebarMenuButton></SidebarMenuItem> })}</SidebarMenu></SidebarGroupContent></SidebarGroup></SidebarContent>
        <SidebarFooter><p className="px-2 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">Monomi {packageJson.version}</p></SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <SidebarInset className="min-w-0 bg-muted/45"><header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border/70 bg-background/90 px-4 backdrop-blur-xl md:px-7"><div className="flex items-center gap-3"><SidebarTrigger aria-label={t("runtimeCenter")} /><span className="text-sm font-medium">{t(activeItem.key)}</span></div><UtilityMenus showLogout /></header>{children}</SidebarInset>
    </SidebarProvider>
  )
}
