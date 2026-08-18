import { type RouteConfig, index, route } from "@react-router/dev/routes"

export default [
  index("routes/home.tsx"),
  route("login", "routes/login.tsx"),
  route("setup", "routes/setup.tsx"),
  route("app", "routes/app-layout.tsx", [
    index("routes/app-overview.tsx"),
    route("monitors", "routes/monitors.tsx"),
    route("monitors/new", "routes/monitor-new.tsx"),
    route("monitors/:monitorId", "routes/monitor-detail.tsx"),
    route("monitors/:monitorId/edit", "routes/monitor-edit.tsx"),
    route("incidents", "routes/incidents.tsx"),
    route("notifications", "routes/notifications.tsx"),
    route("status-page", "routes/status-page-settings.tsx"),
    route("settings", "routes/settings.tsx"),
  ]),
] satisfies RouteConfig
