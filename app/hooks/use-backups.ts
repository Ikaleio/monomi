import type { InferResponseType } from "hono/client"
import useSWR from "swr"

import { api, swrConfig, unwrap } from "~/lib/api-client"

export type BackupsData = InferResponseType<typeof api.admin.backups.$get, 200>

export function useBackups() {
  return useSWR<BackupsData>(
    "backups",
    async () => unwrap(await api.admin.backups.$get()),
    swrConfig
  )
}
