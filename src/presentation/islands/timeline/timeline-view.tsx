/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { resolveRecordColor } from '@/domain/kernel/color/record-color'
import {
  TIMELINE_MARKER_WRAPPER_CLASSES,
  computeTimelineBarClasses,
  computeTimelineBarLabelClasses,
  computeTimelineLaneClasses,
  computeTimelineLaneTitleClasses,
  computeTimelineMarkerClasses,
  computeTimelineMarkerLabelClasses,
  computeTimelineRowClasses,
  computeTimelineScaleAxisClasses,
  computeTimelineShellClasses,
} from '@/presentation/design/timeline-default-classes'
import {
  DEFAULT_TIMELINE_ZOOM,
  buildDependencyLinks,
  buildTimelineLanes,
  computeTimelineBounds,
  computeTimelineTicks,
  toPercent,
  type TimelineBounds,
  type TimelineItem,
  type TimelineLane,
  type TimelineLink,
  type TimelineZoom,
} from './timeline-compute'
import { TimelineDependencyLinks, TimelineTodayMarker } from './timeline-overlays'
import type { OptionChipColors } from '@/domain/kernel/color/option-chip-color'
import type { ReactElement } from 'react'

/** Nothing to look up when the view draws no connectors at all. */
const NO_DEPENDENCY_LINKS: ReadonlyMap<string, readonly TimelineLink[]> = new Map()

/**
 * Fallback palette for a `colorField` whose options declare no colour of their
 * own — the platform chart series, so a timeline and a chart of the same data
 * categorise it in the same hues instead of two unrelated sets.
 *
 * These are LITERAL hexes rather than `var(--sv-chart-N)`, and that is forced
 * rather than chosen: every entry is fed to `deriveOptionChipColors`, which
 * computes a WCAG-AA foreground and a border by parsing the value as
 * `#RRGGBB`. It returns `undefined` for anything it cannot parse, so a `var()`
 * here would not fall back to the token — it would silently drop the colour
 * from every bar. Keep these in step with `--sv-chart-1..5`.
 */
const COLOR_PALETTE = ['#398ad6', '#cd5f62', '#479c4d', '#b67700', '#9470cd'] as const

/**
 * The fill every bar paints when no `colorField` is declared. Unlike the
 * palette above this one never reaches the contrast derivation — it goes
 * straight to an inline `background-color` — so it can name the token and
 * follow an app's theme. The literal is the var's fallback, for the case where
 * the design layer is switched off.
 */
const DEFAULT_BAR_FILL = 'var(--sv-chart-1, #398ad6)'

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
    <div
      data-testid="timeline-bar"
      data-timeline-item={item.id}
      {...(item.colorValue !== undefined ? { 'data-color-status': item.colorValue } : {})}
      className={computeTimelineBarClasses()}
      // eslint-disable-next-line react-perf/jsx-no-new-object-as-prop -- per-bar time-axis position + color are genuinely dynamic; React Compiler not yet enabled in Bun
      style={{
        left: `${String(left)}%`,
        width: `${String(width)}%`,
        backgroundColor: colors?.fill ?? DEFAULT_BAR_FILL,
        ...(colors ? { color: colors.foreground } : {}),
      }}
      title={item.label}
    >
      <span className={computeTimelineBarLabelClasses()}>{item.label}</span>
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
    <div
      data-testid="timeline-point"
      data-timeline-item={item.id}
      {...(item.colorValue !== undefined ? { 'data-color-status': item.colorValue } : {})}
      className={TIMELINE_MARKER_WRAPPER_CLASSES}
      // eslint-disable-next-line react-perf/jsx-no-new-object-as-prop -- per-point time-axis position is genuinely dynamic; React Compiler not yet enabled in Bun
      style={{ left: `${String(left)}%` }}
      title={item.label}
    >
      <span
        className={computeTimelineMarkerClasses()}
        // eslint-disable-next-line react-perf/jsx-no-new-object-as-prop -- per-point diamond colour is genuinely dynamic; React Compiler not yet enabled in Bun
        style={{ backgroundColor: colors?.fill ?? DEFAULT_BAR_FILL }}
        aria-hidden="true"
      />
      <span className={computeTimelineMarkerLabelClasses()}>{item.label}</span>
    </div>
  )
}

/**
 * Renders the ordered rows (bars + points) for one swimlane.
 *
 * The row element is owned HERE rather than by the bar and the marker, because
 * a row now holds two kinds of thing: the record itself, and any dependency
 * connectors that END at it. The row is the positioning context both are
 * placed into, so exactly one of them cannot also be the thing that creates it.
 */
function TimelineRows({
  items,
  bounds,
  colorMap,
  dependencyLinks,
}: {
  readonly items: readonly TimelineItem[]
  readonly bounds: TimelineBounds
  readonly colorMap: ReadonlyMap<string, OptionChipColors>
  /** Connectors to draw, keyed by the id of the record they point AT. */
  readonly dependencyLinks: ReadonlyMap<string, readonly TimelineLink[]>
}): ReactElement {
  // No `space-y-*`: the rows are contiguous and separated by the hairline each
  // one draws under itself (`computeTimelineRowClasses`). Air between floating
  // bars is what stopped the view scanning horizontally as a Gantt.
  return (
    <div>
      {items.map((item) => {
        const colors = item.colorValue !== undefined ? colorMap.get(item.colorValue) : undefined
        const links = dependencyLinks.get(item.id)
        return (
          <div
            key={item.id}
            className={computeTimelineRowClasses()}
          >
            {links ? <TimelineDependencyLinks links={links} /> : undefined}
            {item.kind === 'point' ? (
              <TimelinePoint
                item={item}
                bounds={bounds}
                colors={colors}
              />
            ) : (
              <TimelineBar
                item={item}
                bounds={bounds}
                colors={colors}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

const ONE_DAY_MS = 86_400_000
const ONE_YEAR_MS = 365 * ONE_DAY_MS

/**
 * Formats an axis tick at the precision its own STEP earns.
 *
 * The label follows the gap between ticks rather than the zoom that produced
 * it, because those two come apart: a fine zoom over a three-year span still
 * steps in months, and printing a clock time on it would claim a precision the
 * axis does not have. Ticks closer together than a day are timed, ticks inside
 * a year are dated, and anything coarser carries the year — otherwise a
 * multi-year axis reads as the same few months repeating.
 */
function formatAxisTick(ms: number, stepMs: number): string {
  const date = new Date(ms)
  if (stepMs < ONE_DAY_MS) {
    return date.toLocaleTimeString('en-US', { hour: 'numeric' })
  }
  if (stepMs < ONE_YEAR_MS) {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

/**
 * The ruler under the plot, divided at the resolution the declared zoom asks
 * for.
 *
 * Each tick carries `data-timeline-tick` holding its own instant. The axis is
 * the part of the view whose shape IS the zoom, so that attribute is what
 * makes a declared zoom observable rather than merely accepted.
 */
function TimeAxis({
  bounds,
  zoom,
}: {
  readonly bounds: TimelineBounds
  readonly zoom: TimelineZoom | undefined
}): ReactElement {
  const ticks = computeTimelineTicks(bounds, zoom ?? DEFAULT_TIMELINE_ZOOM)
  const step = ticks.length > 1 ? (bounds.max - bounds.min) / (ticks.length - 1) : 0

  return (
    <div
      data-testid="time-axis"
      data-timeline-zoom={zoom ?? DEFAULT_TIMELINE_ZOOM}
      className={computeTimelineScaleAxisClasses()}
    >
      {ticks.map((tick) => (
        <span
          key={tick}
          data-timeline-tick={String(tick)}
        >
          {formatAxisTick(tick, step)}
        </span>
      ))}
    </div>
  )
}

/**
 * The stack of swimlanes, each optionally under its own title band.
 *
 * Its own component so `TimelineView` stays readable as what it is: a frame
 * holding three things — the lanes, the axis, and the today rule laid over both.
 */
function TimelineLanes({
  lanes,
  bounds,
  colorMap,
  dependencyLinks,
  showLaneHeaders,
}: {
  readonly lanes: readonly TimelineLane[]
  readonly bounds: TimelineBounds
  readonly colorMap: ReadonlyMap<string, OptionChipColors>
  readonly dependencyLinks: ReadonlyMap<string, readonly TimelineLink[]>
  readonly showLaneHeaders: boolean
}): ReactElement {
  return (
    <div className="space-y-3">
      {lanes.map((lane) => {
        const rows = (
          <TimelineRows
            items={lane.items}
            bounds={bounds}
            colorMap={colorMap}
            dependencyLinks={dependencyLinks}
          />
        )
        return showLaneHeaders ? (
          <div
            key={`lane-${lane.key}`}
            data-testid="timeline-swimlane"
            data-timeline-lane={lane.key}
            className={computeTimelineLaneClasses()}
          >
            <div className={computeTimelineLaneTitleClasses()}>{lane.key}</div>
            {rows}
          </div>
        ) : (
          <div key={`lane-${lane.key}`}>{rows}</div>
        )
      })}
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
  zoom,
  showToday = true,
  showDependencies = false,
}: {
  readonly items: readonly TimelineItem[]
  readonly groupBy: string | undefined
  /** `optionValue → #RRGGBB` declared on the `colorField`; absent when it declares none. */
  readonly colorFieldColors?: Readonly<Record<string, string>>
  /** How finely the time axis is ruled. Absent takes the schema's default. */
  readonly zoom?: TimelineZoom
  /** Draw the rule at the current date. Defaults ON, matching the schema. */
  readonly showToday?: boolean
  /** Draw the connectors declared through `dependencyField`. Defaults OFF. */
  readonly showDependencies?: boolean
}): ReactElement {
  const bounds = computeTimelineBounds(items)
  const lanes = buildTimelineLanes(items, groupBy)
  const colorMap = buildColorMap(items, colorFieldColors)
  const showLaneHeaders = Boolean(groupBy)
  const dependencyLinks = showDependencies
    ? buildDependencyLinks(items, bounds)
    : NO_DEPENDENCY_LINKS

  return (
    <div
      data-component="data-timeline"
      className={computeTimelineShellClasses()}
    >
      {/* The positioning context for the today rule. It spans the rows AND the
       * axis, so the marker runs the full height of the plot and meets the
       * ruler it is a position on — which is why the wrapper is here rather
       * than around the rows alone. */}
      <div className="relative">
        <TimelineLanes
          lanes={lanes}
          bounds={bounds}
          colorMap={colorMap}
          dependencyLinks={dependencyLinks}
          showLaneHeaders={showLaneHeaders}
        />
        <TimeAxis
          bounds={bounds}
          zoom={zoom}
        />
        {showToday ? (
          <TimelineTodayMarker
            bounds={bounds}
            now={Date.now()}
          />
        ) : undefined}
      </div>
    </div>
  )
}
