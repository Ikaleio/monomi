import { Link } from "react-router"
import { useState } from "react"

import { VirtualList } from "~/components/virtual-list"
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert"
import { Badge } from "~/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "~/components/ui/empty"
import { Skeleton } from "~/components/ui/skeleton"
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group"
import { useIncidents } from "~/hooks/use-incidents"

export function meta() {
  return [{ title: "故障记录 · Monomi" }]
}

export default function IncidentsRoute() {
  const [filter, setFilter] = useState<"all" | "ongoing" | "resolved">("all")
  const { data, error, isLoading } = useIncidents(
    filter === "all" ? undefined : filter
  )
  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-5 px-3 py-6 md:gap-6 md:px-8 md:py-8">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-primary">事件</p>
        <h1 className="font-serif text-4xl font-semibold">故障记录</h1>
        <p className="text-muted-foreground">
          由检测状态机自动生成，只读且可追溯。
        </p>
      </div>
      <ToggleGroup
        type="single"
        value={filter}
        onValueChange={(value) => value && setFilter(value as typeof filter)}
        className="justify-start"
      >
        <ToggleGroupItem value="all">全部</ToggleGroupItem>
        <ToggleGroupItem value="ongoing">进行中</ToggleGroupItem>
        <ToggleGroupItem value="resolved">已解决</ToggleGroupItem>
      </ToggleGroup>
      {isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : error || !data ? (
        <Alert variant="destructive">
          <AlertTitle>无法加载故障</AlertTitle>
          <AlertDescription>
            {error instanceof Error ? error.message : "请稍后重试。"}
          </AlertDescription>
        </Alert>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-2xl">事件时间线</CardTitle>
            <CardDescription>
              {data.incidents.length} 条记录，使用虚拟滚动。
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.incidents.length === 0 ? (
              <Empty className="min-h-64">
                <EmptyHeader>
                  <EmptyMedia variant="icon">✓</EmptyMedia>
                  <EmptyTitle>没有匹配的故障</EmptyTitle>
                  <EmptyDescription>当前筛选范围内没有事件。</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <VirtualList
                items={data.incidents}
                estimateSize={104}
                height={560}
                getKey={(incident) => incident.id}
                renderItem={(incident) => (
                  <article className="grid h-full gap-3 border-b px-2 py-4 md:grid-cols-[10rem_1fr_auto] md:items-center">
                    <time className="text-sm text-muted-foreground">
                      {new Date(incident.startedAt).toLocaleString("zh-CN")}
                    </time>
                    <div className="flex min-w-0 flex-col gap-1">
                      <Link
                        to={`/app/monitors/${incident.monitorId}`}
                        className="truncate font-medium hover:underline"
                      >
                        {incident.monitorName}
                      </Link>
                      <p className="text-sm text-muted-foreground">
                        持续 {incident.durationSeconds} 秒
                        {incident.resolution ? ` · ${incident.resolution}` : ""}
                      </p>
                    </div>
                    <Badge
                      variant={
                        incident.status === "ongoing"
                          ? "destructive"
                          : "secondary"
                      }
                    >
                      {incident.status === "ongoing" ? "进行中" : "已解决"}
                    </Badge>
                  </article>
                )}
              />
            )}
          </CardContent>
        </Card>
      )}
    </main>
  )
}
