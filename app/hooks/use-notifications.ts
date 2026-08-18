import type { InferResponseType } from "hono/client"
import useSWR from "swr"

import { api, swrConfig, unwrap } from "~/lib/api-client"

export type NotificationsData = InferResponseType<
  typeof api.admin.notifications.$get,
  200
>

export function useNotifications() {
  return useSWR<NotificationsData>(
    "notifications",
    async () => unwrap(await api.admin.notifications.$get()),
    { ...swrConfig, refreshInterval: 10000 },
  )
}
