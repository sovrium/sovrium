/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { resolveRecordColor } from '@/domain/utils/record-color'
import {
  buildTimelineLanes,
  computeTimelineBounds,
  toPercent,
  type TimelineBounds,
  type TimelineItem,
} from './timeline-compute'
import type { OptionChipColors } from '@/domain/utils/option-chip-color'
import type { ReactElement } from 'react'

/**
 * Fallback palette for a `colorField` whose options declare no colour of their
 * own. Unchanged from the ordinal version it replaces, so an app that never
 * declared colours keeps the same seven hues — only their ASSIGNMENT changed.
 */
const COLOR_PALETTE = [
  '#3b82f6',
  '#22c55e',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#14b8a6',
  '#ec4899',
] as const

/** The fill every bar painted before `colorField` existed; still the no-colorField default. */
const DEFAULT_BAR_FILL = '#3b82f6'

/**
 * Resolve each distinct `colorField` value to its painted fill/foreground/border.
 *
 * Previously this assigned palette entries by FIRST-APPEARANCE ORDER over the
 * items actually rendered, which made a bar's colour a function of the record
 * SET: deleting an unrelated row shifted every value after it by one hue. Each
 * value is now resolved independently — the author's declared option colour
 * when there is one, otherwise a hash of the value — so nothing on screen can
 * move a colour that is not its own.
 */
function buildColorMap(
  items: readonly TimelineItem[],
  optionColors: Readonly<Record<string, string>> | undefined
): ReadonlyMap<string, OptionChipColors> {
  const distinct = new Set(
    items.flatMap((item) => (item.colorValue === undefined ? [] : [item.colorValue]))
  )
  return new Map(
    Array.from(distinct).flatMap((value) => {
      const colors = resolveRecordColor(value, optionColors, COLOR_PALETTE)
      return colors ? [[value, colors] as const] : []
    })
  )
}

/** Renders a single horizontal bar positioned on the time axis. */
function TimelineBar({
  item,
  bounds,
  colors,
}: {
  readonly item: TimelineItem
  readonly bounds: TimelineBounds
  readonly colors: OptionChipColors | undefined
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
        // eslint-disable-next-line no-restricted-syntax -- text-white is the label tone for the no-colorField default fill only; a bar carrying a resolved colour overrides it with an inline foreground derived to meet AA against THAT fill ([internal ref] A7 ruling 3), because a fixed tone cannot be legible over both a pale and a dark declared hue
        className="absolute flex h-7 items-center overflow-hidden rounded px-2 text-xs font-medium text-white"
        // eslint-disable-next-line react-perf/jsx-no-new-object-as-prop -- per-bar time-axis position + color are genuinely dynamic; React Compiler not yet enabled in Bun
        style={{
          left: `${String(left)}%`,
          width: `${String(width)}%`,
          backgroundColor: colors?.fill ?? DEFAULT_BAR_FILL,
          ...(colors ? { color: colors.foreground } : {}),
        }}
        title={item.label}
      >
        <span className="truncate">{item.label}</span>
      </div>
    </div>
  )
}

/** Renders a single point/diamond marker positioned on the time axis. */
function TimelinePoint({
  item,
  bounds,
  colors,
}: {
  readonly item: TimelineItem
  readonly bounds: TimelineBounds
  readonly colors: OptionChipColors | undefined
}): ReactElement {
  const left = toPercent(item.start, bounds)

  return (
    <div className="relative h-8">
      <div
        data-testid="timeline-point"
        data-timeline-item={item.id}
        {...(item.colorValue !== undefined ? { 'data-color-status': item.colorValue } : {})}
        className="absolute top-1 flex items-center gap-2"
        // eslint-disable-next-line react-perf/jsx-no-new-object-as-prop -- per-point time-axis position is genuinely dynamic; React Compiler not yet enabled in Bun
        style={{ left: `${String(left)}%` }}
        title={item.label}
      >
        <span
          className="inline-block h-4 w-4 rotate-45"
          // eslint-disable-next-line react-perf/jsx-no-new-object-as-prop -- per-point diamond colour is genuinely dynamic; React Compiler not yet enabled in Bun
          style={{ backgroundColor: colors?.fill ?? DEFAULT_BAR_FILL }}
          aria-hidden="true"
        />
        <span className="text-foreground text-xs font-medium">{item.label}</span>
      </div>
    </div>
  )
}

/** Renders the ordered rows (bars + points) for one swimlane. */
function TimelineRows({
  items,
  bounds,
  colorMap,
}: {
  readonly items: readonly TimelineItem[]
  readonly bounds: TimelineBounds
  readonly colorMap: ReadonlyMap<string, OptionChipColors>
}): ReactElement {
  return (
    <div className="space-y-1">
      {items.map((item) => {
        const colors = item.colorValue !== undefined ? colorMap.get(item.colorValue) : undefined
        return item.kind === 'point' ? (
          <TimelinePoint
            key={item.id}
            item={item}
            bounds={bounds}
            colors={colors}
          />
        ) : (
          <TimelineBar
            key={item.id}
            item={item}
            bounds={bounds}
            colors={colors}
          />
        )
      })}
    </div>
  )
}

/** Formats an epoch-ms timestamp as a short axis tick label (e.g. "Apr 1"). */
function formatAxisTick(ms: number): string {
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/** Builds the time-axis tick labels (start, mid, end of the bounds window). */
function TimeAxis({ bounds }: { readonly bounds: TimelineBounds }): ReactElement {
  const mid = bounds.min + (bounds.max - bounds.min) / 2

  return (
    <div
      data-testid="time-axis"
      className="border-border text-foreground-muted mt-2 flex justify-between border-t pt-1 text-xs"
    >
      <span>{formatAxisTick(bounds.min)}</span>
      <span>{formatAxisTick(mid)}</span>
      <span>{formatAxisTick(bounds.max)}</span>
    </div>
  )
}

/**
 * Renders the populated data-timeline: a time axis plus one or more
 * swimlanes of horizontal bars / point markers.
 */
export function TimelineView({
  items,
  groupBy,
  colorFieldColors,
}: {
  readonly items: readonly TimelineItem[]
  readonly groupBy: string | undefined
  /** `optionValue → #RRGGBB` declared on the `colorField`; absent when it declares none. */
  readonly colorFieldColors?: Readonly<Record<string, string>>
}): ReactElement {
  const bounds = computeTimelineBounds(items)
  const lanes = buildTimelineLanes(items, groupBy)
  const colorMap = buildColorMap(items, colorFieldColors)
  const showLaneHeaders = Boolean(groupBy)

  return (
    <div
      data-component="data-timeline"
      className="border-border bg-background-raised w-full rounded-lg border p-4"
    >
      <div className="space-y-3">
        {lanes.map((lane) =>
          showLaneHeaders ? (
            <div
              key={`lane-${lane.key}`}
              data-testid="timeline-swimlane"
              data-timeline-lane={lane.key}
              className="border-border bg-background-subtle rounded border p-2"
            >
              <div className="text-foreground mb-1 text-xs font-semibold">{lane.key}</div>
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
