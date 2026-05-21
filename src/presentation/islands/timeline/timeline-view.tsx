/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  buildTimelineLanes,
  computeTimelineBounds,
  toPercent,
  type TimelineBounds,
  type TimelineItem,
} from './timeline-compute'
import type { ReactElement } from 'react'

const COLOR_PALETTE = [
  '#3b82f6',
  '#22c55e',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#14b8a6',
  '#ec4899',
] as const

function buildColorMap(items: readonly TimelineItem[]): ReadonlyMap<string, string> {
  const distinct = items.reduce<readonly string[]>((acc, item) => {
    if (item.colorValue === undefined || acc.includes(item.colorValue)) return acc
    return [...acc, item.colorValue]
  }, [])
  return new Map(
    distinct.map((value, index) => [value, COLOR_PALETTE[index % COLOR_PALETTE.length] as string])
  )
}

function TimelineBar({
  item,
  bounds,
  color,
}: {
  readonly item: TimelineItem
  readonly bounds: TimelineBounds
  readonly color: string | undefined
}): ReactElement {
  const left = toPercent(item.start, bounds)
  const right = toPercent(item.end ?? item.start, bounds)
  const width = Math.max(right - left, 2)

  return (
    <div className="relative h-8">
      <div
        data-testid="timeline-bar"
        data-timeline-item={item.id}
        {...(item.colorValue !== undefined ? { 'data-color-status': item.colorValue } : {})}
        className="absolute flex h-7 items-center overflow-hidden rounded px-2 text-xs font-medium text-white"
        style={{
          left: `${String(left)}%`,
          width: `${String(width)}%`,
          backgroundColor: color ?? '#3b82f6',
        }}
        title={item.label}
      >
        <span className="truncate">{item.label}</span>
      </div>
    </div>
  )
}

function TimelinePoint({
  item,
  bounds,
  color,
}: {
  readonly item: TimelineItem
  readonly bounds: TimelineBounds
  readonly color: string | undefined
}): ReactElement {
  const left = toPercent(item.start, bounds)

  return (
    <div className="relative h-8">
      <div
        data-testid="timeline-point"
        data-timeline-item={item.id}
        {...(item.colorValue !== undefined ? { 'data-color-status': item.colorValue } : {})}
        className="absolute top-1 flex items-center gap-2"
        style={{ left: `${String(left)}%` }}
        title={item.label}
      >
        <span
          className="inline-block h-4 w-4 rotate-45"
          style={{ backgroundColor: color ?? '#3b82f6' }}
          aria-hidden="true"
        />
        <span className="text-xs font-medium text-gray-700">{item.label}</span>
      </div>
    </div>
  )
}

function TimelineRows({
  items,
  bounds,
  colorMap,
}: {
  readonly items: readonly TimelineItem[]
  readonly bounds: TimelineBounds
  readonly colorMap: ReadonlyMap<string, string>
}): ReactElement {
  return (
    <div className="space-y-1">
      {items.map((item) => {
        const color = item.colorValue !== undefined ? colorMap.get(item.colorValue) : undefined
        return item.kind === 'point' ? (
          <TimelinePoint
            key={item.id}
            item={item}
            bounds={bounds}
            color={color}
          />
        ) : (
          <TimelineBar
            key={item.id}
            item={item}
            bounds={bounds}
            color={color}
          />
        )
      })}
    </div>
  )
}

function formatAxisTick(ms: number): string {
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function TimeAxis({ bounds }: { readonly bounds: TimelineBounds }): ReactElement {
  const mid = bounds.min + (bounds.max - bounds.min) / 2

  return (
    <div
      data-testid="time-axis"
      className="mt-2 flex justify-between border-t border-gray-300 pt-1 text-xs text-gray-500"
    >
      <span>{formatAxisTick(bounds.min)}</span>
      <span>{formatAxisTick(mid)}</span>
      <span>{formatAxisTick(bounds.max)}</span>
    </div>
  )
}

export function TimelineView({
  items,
  groupBy,
}: {
  readonly items: readonly TimelineItem[]
  readonly groupBy: string | undefined
}): ReactElement {
  const bounds = computeTimelineBounds(items)
  const lanes = buildTimelineLanes(items, groupBy)
  const colorMap = buildColorMap(items)
  const showLaneHeaders = Boolean(groupBy)

  return (
    <div
      data-component="data-timeline"
      className="w-full rounded-lg border border-gray-200 bg-white p-4"
    >
      <div className="space-y-3">
        {lanes.map((lane) =>
          showLaneHeaders ? (
            <div
              key={`lane-${lane.key}`}
              data-testid="timeline-swimlane"
              data-timeline-lane={lane.key}
              className="rounded border border-gray-100 bg-gray-50/50 p-2"
            >
              <div className="mb-1 text-xs font-semibold text-gray-700">{lane.key}</div>
              <TimelineRows
                items={lane.items}
                bounds={bounds}
                colorMap={colorMap}
              />
            </div>
          ) : (
            <TimelineRows
              key={`lane-${lane.key}`}
              items={lane.items}
              bounds={bounds}
              colorMap={colorMap}
            />
          )
        )}
      </div>
      <TimeAxis bounds={bounds} />
    </div>
  )
}
