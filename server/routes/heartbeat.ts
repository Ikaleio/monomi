import { eq } from "drizzle-orm"
import { Hono } from "hono"

import { monitors } from "../db/schema"
import type { AppDeps, AppEnv } from "../http/types"
import { sha256 } from "../middleware/auth"

export function createHeartbeatRoutes(deps: AppDeps) {
  const receive = async (token: string) => {
    const tokenHash = await sha256(token)
    const monitor = await deps.db.query.monitors.findFirst({
      where: eq(monitors.heartbeatTokenHash, tokenHash),
    })
    if (!monitor || monitor.type !== "heartbeat" || !monitor.enabled)
      return null
    await deps.scheduler.recordHeartbeat(monitor.id)
    return monitor
  }
  return new Hono<AppEnv>()
    .get("/:token", async (c) => {
      const monitor = await receive(c.req.param("token"))
      return monitor ? c.body(null, 204) : c.body(null, 404)
    })
    .post("/:token", async (c) => {
      const monitor = await receive(c.req.param("token"))
      return monitor ? c.body(null, 204) : c.body(null, 404)
    })
}
