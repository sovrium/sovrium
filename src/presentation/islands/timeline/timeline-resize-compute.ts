/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The arithmetic of a timeline resize: a released handle moves its date by a
 * WHOLE number of days, the nearest to where it was dropped, and never past
 * the bar's other end.
 *
 * A day is the precision the plan's `date` fields hold, so the snap does not
 * depend on the zoom the reader happened to pick. A `datetime` value keeps its
 * time of day and moves by whole days; a `date` value stays a calendar day.
 */

/** Which end of a bar a handle moves. */
export type ResizeEdge = 'start' | 'end'

const ONE_DAY_MS = 86_400_000
const CALENDAR_DAY = /^\d{4}-\d{2}-\d{2}$/

/** The whole number of days nearest a drag of `deltaPx` on an axis of `pxPerDay`. */
export function snappedDays(deltaPx: number, pxPerDay: number): number {
  if (!Number.isFinite(pxPerDay) || pxPerDay <= 0) return 0
  const days = Math.round(deltaPx / pxPerDay)
  return Object.is(days, -0) ? 0 : days
}

/** A stored date value, as epoch milliseconds — `undefined` when unreadable. */
const instantOf = (value: unknown): number | undefined => {
  if (value === undefined || value === null || value === '') return undefined
  const ms = new Date(String(value)).getTime()
  return Number.isFinite(ms) ? ms : undefined
}

/** `ms` written in the same shape as `like`: a calendar day, or a full instant. */
const writtenLike = (ms: number, like: unknown): string => {
  const iso = new Date(ms).toISOString()
  return typeof like === 'string' && CALENDAR_DAY.test(like) ? iso.slice(0, 10) : iso
}

/**
 * The value a handle saves when it moves `edge` by `days`: the moved date,
 * clamped so an end never crosses its start (nor a start its end) — the
 * shortest bar is one day. `undefined` when nothing would change, or when a
 * date cannot be read.
 */
export function resizedValue(args: {
  readonly edge: ResizeEdge
  readonly days: number
  readonly start: unknown
  readonly end: unknown
}): string | undefined {
  const { edge, days } = args
  const moved = edge === 'end' ? args.end : args.start
  const start = instantOf(args.start)
  const end = instantOf(args.end)
  if (days === 0 || start === undefined || end === undefined) return undefined
  const target = (edge === 'end' ? end : start) + days * ONE_DAY_MS
  const clamped = edge === 'end' ? Math.max(target, start) : Math.min(target, end)
  const original = edge === 'end' ? end : start
  return clamped === original ? undefined : writtenLike(clamped, moved)
}
