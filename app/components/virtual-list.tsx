import { useVirtualizer } from "@tanstack/react-virtual"
import { useRef } from "react"

export function VirtualList<T>({
  items,
  estimateSize,
  height = 420,
  getKey,
  renderItem,
}: {
  items: T[]
  estimateSize: number
  height?: number
  getKey(item: T, index: number): string | number
  renderItem(item: T, index: number): React.ReactNode
}) {
  const viewportHeight = Math.min(height, items.length * estimateSize)
  const scrollRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => estimateSize,
    overscan: 8,
  })
  return (
    <div
      ref={scrollRef}
      className="overflow-auto"
      style={{
        height: viewportHeight,
        contain: "strict",
        overflowAnchor: "none",
      }}
    >
      <div
        className="relative w-full"
        style={{ height: virtualizer.getTotalSize() }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => (
          <div
            key={getKey(items[virtualItem.index], virtualItem.index)}
            className="absolute top-0 left-0 w-full"
            style={{
              height: virtualItem.size,
              transform: `translateY(${virtualItem.start}px)`,
            }}
          >
            {renderItem(items[virtualItem.index], virtualItem.index)}
          </div>
        ))}
      </div>
    </div>
  )
}
