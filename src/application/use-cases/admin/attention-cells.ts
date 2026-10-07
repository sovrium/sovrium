/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The cell vocabulary of the attention report: the envelope saying whether a
 * figure was measured, the count-plus-sub-line cell, and the formatters the
 * blocks render their sub-lines with.
 */
import { DateTime } from 'effect'

/**
 * A block's result, carrying the name of the source when it could NOT be read.
 *
 * `source` is `undefined` on the healthy path and a short human name
 * (`'connections'`, `'invitations'`) on the degraded one. It is spelled as a
 * required key holding `string | undefined` rather than an optional key so a
 * block cannot forget to answer the question — the whole point of the envelope
 * is that "was this measured?" is never left implicit.
 */
export interface Sourced<A> {
  readonly value: A
  readonly source: string | undefined
}

/** The healthy spelling: a measured value, no source to distrust. */
export const measured = <A>(value: A): Sourced<A> => ({ value, source: undefined })

/** The fallback spelling: the zero value, and the name of what failed. */
export const unread = <A>(value: A, source: string): Sourced<A> => ({ value, source })

/** A cell's count and the rendered sub-line naming the subjects behind it. */
export interface Cell {
  readonly count: number
  readonly detail: string
}

/** The zero cell: no count, and therefore no subjects to name. */
export const EMPTY_CELL: Cell = { count: 0, detail: '' }

/** The separator every rendered detail joins its subjects with. */
export const DETAIL_SEPARATOR = ' · '

/**
 * How many subjects a detail may name before it summarises the remainder.
 *
 * Formatting server-side is what bounds the body (a thousand failed runs still
 * produce one short line), and this is the bound. Four fits the strip's cell
 * width at the console's narrowest supported viewport; beyond that the line
 * would be truncated by CSS, which tells the operator less than `+N more` does.
 */
export const MAX_DETAIL_SUBJECTS = 4

/**
 * Render a subject list into a cell's sub-line, summarising the overflow.
 *
 * An empty list renders the empty string, which is exactly the contract's zero
 * spelling — so a caller never has to special-case the cold path.
 */
export const renderDetail = (subjects: readonly string[]): string => {
  if (subjects.length <= MAX_DETAIL_SUBJECTS) return subjects.join(DETAIL_SEPARATOR)
  const shown = subjects.slice(0, MAX_DETAIL_SUBJECTS)
  return [...shown, `+${subjects.length - MAX_DETAIL_SUBJECTS} more`].join(DETAIL_SEPARATOR)
}

/**
 * Build a cell from the subjects behind it, keeping count and detail paired.
 *
 * The pairing contract (`count 0 ⟺ detail ''`) is a structural property of
 * this function rather than a rule each block has to remember: the count IS
 * the subject count, so a non-zero cell always names at least one subject and
 * a zero cell can never name one.
 */
export const cellOf = (subjects: readonly string[]): Cell => ({
  count: subjects.length,
  detail: renderDetail(subjects),
})

/**
 * Group names into `name ×N` subjects, heaviest first.
 *
 * Used by the two cells whose subjects repeat — a failing automation fails
 * many times, one form receives many submissions — so the operator reads
 * "deal-won-invoice ×7" rather than the same name seven times.
 */
export const tallySubjects = (names: readonly string[]): readonly string[] =>
  [...new Set(names)]
    .map((name) => ({ name, count: names.filter((candidate) => candidate === name).length }))
    .toSorted((a, b) => (a.count === b.count ? a.name.localeCompare(b.name) : b.count - a.count))
    .map(({ name, count }) => `${name} ×${count}`)

/**
 * A tallied cell whose COUNT is the number of events, not of distinct names.
 *
 * `cellOf` cannot serve here: it derives the count from the subject list, and
 * the subject list has been collapsed by {@link tallySubjects}. Two failures
 * of one automation are two failed runs and one subject.
 */
export const tallyCell = (names: readonly string[]): Cell => ({
  count: names.length,
  detail: renderDetail(tallySubjects(names)),
})

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const

/**
 * Render an instant as a compact stamp (`9 Sep 16:20`) on the wall clock of the
 * operator timezone (`SOVRIUM_TIMEZONE`, UTC when unset).
 *
 * Built from the date parts rather than through `toLocaleString`, because the
 * detail is a byte-compared contract value and ICU output varies with the
 * runtime's locale data. The parts come from Effect's `DateTime` in an explicit
 * zone, never from a `Date`'s local getters, which follow the host's POSIX `TZ`.
 */
const pad2 = (n: number): string => String(n).padStart(2, '0')

export const formatStamp = (iso: string, timeZone: string): string => {
  const at = new Date(iso)
  if (Number.isNaN(at.getTime())) return 'an unknown time'
  const parts = DateTime.toParts(DateTime.makeZonedUnsafe(at.getTime(), { timeZone }))
  return `${parts.day} ${MONTHS[parts.month - 1] ?? '???'} ${pad2(parts.hour)}:${pad2(parts.minute)}`
}

const DAY_MS = 24 * 60 * 60 * 1000

/** Render how long the oldest of a set has been waiting, in whole days. */
export const formatWaited = (oldestIso: string, nowMs: number): string => {
  const at = Date.parse(oldestIso)
  if (Number.isNaN(at)) return 'oldest waiting'
  const days = Math.floor(Math.max(0, nowMs - at) / DAY_MS)
  if (days === 0) return 'oldest today'
  return days === 1 ? 'oldest 1 day' : `oldest ${days} days`
}
