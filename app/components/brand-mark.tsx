import { ActivityIcon } from "lucide-react"
import { Link } from "react-router"

import { cn } from "~/lib/utils"

export function BrandMark({
  compact = false,
  className,
}: {
  compact?: boolean
  className?: string
}) {
  return (
    <Link
      to="/"
      aria-label="Monomi 公开状态页"
      className={cn("flex min-w-0 items-center gap-3", className)}
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
        <ActivityIcon className="size-5" aria-hidden="true" />
      </span>
      {!compact && (
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-serif text-base font-semibold tracking-tight">
            Monomi
          </span>
          <span className="truncate text-xs text-muted-foreground">
            服务状态
          </span>
        </span>
      )}
    </Link>
  )
}
