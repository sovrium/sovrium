/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { TableRecord } from '../runtime/types'

/**
 * Timeline item config — the per-component display bindings supplied through
 * the page-component `props` object.
 */
export interface TimelineConfig {
  readonly startField: string
  readonly endField?: string
  readonly labelField?: string
  readonly groupBy?: string
  readonly colorField?: string
  readonly defaultZoom?: 'day' | 'week' | 'month' | 'quarter' | 'year'
  /** Field holding the record ids this record follows. */
  readonly dependencyField?: string
}

/**
 * A single resolved timeline entry. `kind: 'bar'` spans `start`→`end`;
 * `kind: 'point'` has only a `start` (renders as a diamond marker).
 */
export interface TimelineItem {
  readonly id: string
  readonly label: string
  readonly start: number
  readonly end?: number
  readonly kind: 'bar' | 'point'
  readonly colorValue?: string
  readonly group?: string
  /** Ids of the records this one follows. Empty when it follows nothing. */
  readonly dependsOn: readonly string[]
}

/** A swimlane groups timeline items under a shared header label. */
export interface TimelineLane {
  readonly key: string
  readonly items: readonly TimelineItem[]
}

/** Parses a record date value to an epoch-millisecond number, or undefined. */
function parseDate(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined
  const ms = new Date(String(value)).getTime()
  return Number.isFinite(ms) ? ms : undefined
}

/** Reads an optional string-valued binding off a record, or returns undefined. */
function readOptionalField(record: TableRecord, field: string | undefined): string | undefined {
  if (!field) return undefined
  const value = record[field]
  return value === undefined || value === null ? undefined : String(value)
}

/**
 * Reads the predecessor ids off a record.
 *
 * The schema documents `dependencyField` as naming "an array of predecessor
 * record IDs", but a SCALAR is accepted too, and deliberately: the
 * single-predecessor case is what an author reaches for first, and a plain
 * text or a link field holding one id is the shape they get. Reading only the
 * array form would silently draw nothing for the commonest configuration.
 *
 * Blank entries are dropped rather than kept as an id no record can match.
 */
function readDependencyIds(record: TableRecord, field: string | undefined): readonly string[] {
  if (!field) return []
  const value = record[field]
  if (value === undefined || value === null || value === '') return []
  const raw = Array.isArray(value) ? value : [value]
  return raw.flatMap((entry: unknown) => {
    if (entry === undefined || entry === null) return []
    const id = String(entry).trim()
    return id === '' ? [] : [id]
  })
}

/**
 * Resolves a single record into a timeline item, or `undefined` when the
 * record has no parseable start date.
 */
function recordToTimelineItem(
  record: TableRecord,
  index: number,
  config: TimelineConfig
): TimelineItem | undefined {
  const start = parseDate(record[config.startField])
  if (start === undefined) return undefined

  const end = config.endField ? parseDate(record[config.endField]) : undefined
  const label =
    readOptionalField(record, config.labelField) ??
    String(record['id'] ?? `Item ${String(index + 1)}`)

  return {
    id: String(record['id'] ?? `timeline-item-${String(index)}`),
    label,
    start,
    end,
    kind: end !== undefined ? 'bar' : 'point',
    colorValue: readOptionalField(record, config.colorField),
    group: readOptionalField(record, config.groupBy),
    dependsOn: readDependencyIds(record, config.dependencyField),
  }
}

/**
 * Resolves table records into timeline items. Records with both a start and
 * end date become `bar` items; records with only a start become `point`
 * markers. Records with no parseable start date are dropped.
 */
export function buildTimelineItems(
  records: readonly TableRecord[],
  config: TimelineConfig
): readonly TimelineItem[] {
  return records.flatMap((record, index) => {
    const item = recordToTimelineItem(record, index, config)
    return item ? [item] : []
  })
}

/**
 * Groups timeline items into swimlanes by their `group` value. Lane order
 * follows first-appearance order in the item list. Returns a single lane
 * with key `''` when `groupBy` is not configured.
 */
export function buildTimelineLanes(
  items: readonly TimelineItem[],
  groupBy: string | undefined
): readonly TimelineLane[] {
  if (!groupBy) return [{ key: '', items }]

  const order = items.reduce<readonly string[]>((acc, item) => {
    const key = item.group ?? ''
    return acc.includes(key) ? acc : [...acc, key]
  }, [])

  return order.map((key) => ({
    key,
    items: items.filter((item) => (item.group ?? '') === key),
  }))
}

/** Inclusive [min, max] epoch-ms bounds covering every item's span. */
export interface TimelineBounds {
  readonly min: number
  readonly max: number
}

/**
 * Computes the time-axis bounds spanning all items. Falls back to a
 * single-day window when the data has zero extent (or no items).
 */
export function computeTimelineBounds(items: readonly TimelineItem[]): TimelineBounds {
  if (items.length === 0) {
    const now = Date.now()
    return { min: now, max: now + 86_400_000 }
  }
  const starts = items.map((i) => i.start)
  const ends = items.map((i) => i.end ?? i.start)
  const min = Math.min(...starts)
  const max = Math.max(...ends)
  return min === max ? { min, max: max + 86_400_000 } : { min, max }
}

/** The zoom levels the time axis can be ruled at, coarsest last. */
export type TimelineZoom = NonNullable<TimelineConfig['defaultZoom']>

/** The zoom applied when a component declares none, matching the schema. */
export const DEFAULT_TIMELINE_ZOOM: TimelineZoom = 'month'

/**
 * How many intervals the axis is divided into at each zoom.
 *
 * Zoom is the axis's RESOLUTION, not its window: the plotted span is always
 * the data's own extent, and the zoom says how finely that span is ruled.
 * Reading it as a window instead would mean a `year` zoom padding a two-day
 * project out to twelve months of empty chart, which is not what an author
 * asking for a yearly view of two days wants to see.
 *
 * The counts are deliberately small. Every division is a dated label in a
 * `justify-between` row, so a ruler fine enough to be exact is also one too
 * crowded to read — and an axis is read at a glance or not at all.
 */
const ZOOM_DIVISIONS: Record<TimelineZoom, number> = {
  day: 12,
  week: 8,
  month: 5,
  quarter: 3,
  year: 2,
}

/**
 * The instants the time axis draws a tick at, first and last inclusive.
 *
 * Always at least two — the two ends of the plotted window — so an axis never
 * degenerates into a single undated mark.
 */
export function computeTimelineTicks(
  bounds: TimelineBounds,
  zoom: TimelineZoom = DEFAULT_TIMELINE_ZOOM
): readonly number[] {
  const divisions = ZOOM_DIVISIONS[zoom]
  const step = (bounds.max - bounds.min) / divisions
  return Array.from({ length: divisions + 1 }, (_, index) => bounds.min + step * index)
}

/**
 * Maps an epoch-ms timestamp to a 0–100 percentage offset within the bounds.
 * Used to position bars/points along the time axis.
 */
export function toPercent(value: number, bounds: TimelineBounds): number {
  const span = bounds.max - bounds.min
  if (span <= 0) return 0
  return ((value - bounds.min) / span) * 100
}

/**
 * Is an instant inside the plotted window?
 *
 * The today marker asks this before drawing. A rule for a date the axis does
 * not cover would have to be clamped to an edge, and an edge-pinned rule is a
 * false statement about where today falls — so outside the window nothing is
 * drawn at all.
 */
export function isWithinBounds(value: number, bounds: TimelineBounds): boolean {
  return value >= bounds.min && value <= bounds.max
}

/**
 * One drawn dependency: the record it comes from, the record it points at, and
 * the horizontal band between the two anchor points, as percentages of the axis.
 */
export interface TimelineLink {
  readonly fromId: string
  readonly toId: string
  readonly left: number
  readonly width: number
}

/**
 * Resolves each record's declared predecessors into drawable links, keyed by
 * the SUCCESSOR's id — the row the connector is drawn in.
 *
 * A predecessor id naming no plotted record yields no link: a record can be
 * filtered out, dropped for an unparseable start date, or simply deleted, and a
 * connector to nothing would be a line pointing off the chart.
 *
 * The band runs between the predecessor's FINISH and the successor's START, and
 * is stored as `left`/`width` rather than as a signed pair because the two are
 * not ordered: a successor may legitimately begin before its predecessor ends
 * (an overlap), and the connector then spans the same interval backwards.
 */
export function buildDependencyLinks(
  items: readonly TimelineItem[],
  bounds: TimelineBounds
): ReadonlyMap<string, readonly TimelineLink[]> {
  const byId = new Map(items.map((item) => [item.id, item] as const))
  return new Map(
    items.flatMap((item) => {
      const links = item.dependsOn.flatMap((fromId) => {
        const from = byId.get(fromId)
        if (!from || from.id === item.id) return []
        const fromX = toPercent(from.end ?? from.start, bounds)
        const toX = toPercent(item.start, bounds)
        return [
          {
            fromId,
            toId: item.id,
            left: Math.min(fromX, toX),
            width: Math.abs(toX - fromX),
          },
        ]
      })
      return links.length === 0 ? [] : [[item.id, links] as const]
    })
  )
}
