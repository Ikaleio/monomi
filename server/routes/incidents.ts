import { and, desc, eq, lt } from "drizzle-orm"
import { Hono } from "hono"

import { incidentStatusSchema, paginationSchema } from "../../shared/contracts"
import { incidents, monitors } from "../db/schema"
import type { AppDeps, AppEnv } from "../http/types"

export function createIncidentRoutes(deps: AppDeps) {
  return new Hono<AppEnv>().get("/", async (c) => {
    const pagination = paginationSchema.parse(c.req.query())
    const statusValue = c.req.query("status")
    const status = statusValue ? incidentStatusSchema.parse(statusValue) : null
    const predicates = []
    if (status) predicates.push(eq(incidents.status, status))
    if (pagination.cursor) predicates.push(lt(incidents.id, pagination.cursor))
    const rows = await deps.db
      .select({
        id: incidents.id,
        monitorId: incidents.monitorId,
        monitorName: monitors.name,
        status: incidents.status,
        startedAt: incidents.startedAt,
        resolvedAt: incidents.resolvedAt,
        resolution: incidents.resolution,
      })
      .from(incidents)
      .innerJoin(monitors, eq(monitors.id, incidents.monitorId))
      .where(predicates.length ? and(...predicates) : undefined)
      .orderBy(desc(incidents.id))
      .limit(pagination.limit + 1)
    const hasMore = rows.length > pagination.limit
    const items = hasMore ? rows.slice(0, pagination.limit) : rows
    return c.json({
      incidents: items.map((incident) => ({
        ...incident,
        durationSeconds: Math.max(
          0,
          Math.round(
            ((incident.resolvedAt ?? deps.now?.() ?? new Date()).getTime() -
              incident.startedAt.getTime()) /
              1000
          )
        ),
      })),
      nextCursor: hasMore ? items.at(-1)?.id : null,
    })
  })
}
