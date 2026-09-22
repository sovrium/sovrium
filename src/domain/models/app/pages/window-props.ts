/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { PAGE_WINDOW_DEFAULT_PARAM } from '@/domain/models/app/pages/window'
import type {
  PageWindow,
  PageWindowGranularity,
  PageWindowPreset,
} from '@/domain/models/app/pages/window'

/** Milliseconds in each accepted preset unit. */
const UNIT_MS: Readonly<Record<string, number>> = {
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
  w: 7 * 24 * 60 * 60 * 1000,
}

/** Singular/plural noun each unit is named with in a derived label. */
const UNIT_NOUN: Readonly<Record<string, readonly [string, string]>> = {
  h: ['hour', 'hours'],
  d: ['day', 'days'],
  w: ['week', 'weeks'],
}

/**
 * The width of one cache-key bucket for a window's `end` instant.
 *
 * A page declaring `window` renders a function of the clock, so its cache entry
 * has to carry one — but a RAW instant would mint a distinct entry per request
 * and turn the cache into an unbounded leak. Coarsening to the minute bounds it
 * to one live entry per preset, and caps how stale a served figure can be at 60
 * seconds — below the resolution any of these windows reports at (the finest
 * declared bucket is an hour).
 */
export const PAGE_WINDOW_CACHE_BUCKET_MS = 60 * 1000

/**
 * A window resolved against a concrete instant: the five facts every
 * `$window.*` reference on the page reads, plus the preset id the cache keys on.
 */
export interface ResolvedPageWindow {
  /** The active preset id, e.g. `7d` — what a selector marks `aria-current` on */
  readonly id: string
  /** ISO 8601 instant the window starts at */
  readonly start: string
  /** ISO 8601 instant the window ends at */
  readonly end: string
  /** Bucket width for a time series read at this window */
  readonly granularity: PageWindowGranularity
  /** The phrase naming this window in visible copy */
  readonly label: string
}

/**
 * Parse a preset id into its span in milliseconds.
 *
 * Returns `undefined` for anything outside the `<positive int><h|d|w>` grammar.
 * `collectPageBindingViolations` refuses such an id at DECODE time, so an
 * unparseable id is unreachable from a booted app — it is still handled rather
 * than thrown on, because this function is also the grammar's single definition
 * and the validator calls it to decide.
 */
export function parsePresetSpanMs(id: string): number | undefined {
  const match = /^([1-9][0-9]*)([hdw])$/.exec(id)
  if (!match) return undefined
  const [, amount, unit] = match
  if (amount === undefined || unit === undefined) return undefined
  const unitMs = UNIT_MS[unit]
  if (unitMs === undefined) return undefined
  return Number(amount) * unitMs
}

/**
 * Bucket width derived from a span when the preset declares none.
 *
 * An hourly bucket over 30 days plots 720 points into a few hundred pixels; a
 * daily bucket over 24 hours plots one. The two thresholds are where each
 * becomes the wrong answer, and either can be overridden per preset.
 */
export function deriveGranularity(spanMs: number): PageWindowGranularity {
  if (spanMs <= 48 * UNIT_MS.h!) return 'hour'
  if (spanMs <= 90 * UNIT_MS.d!) return 'day'
  return 'week'
}

/**
 * Visible phrase derived from a preset id when it declares none — `7d` becomes
 * `last 7 days`, `1h` becomes `last hour`.
 *
 * Singular drops the numeral (`last hour`, not `last 1 hour`) because that is
 * how the phrase is said; a config wanting otherwise declares `label`.
 */
export function deriveLabel(id: string): string {
  const match = /^([1-9][0-9]*)([hdw])$/.exec(id)
  if (!match) return id
  const [, amount, unit] = match
  const nouns = unit === undefined ? undefined : UNIT_NOUN[unit]
  if (amount === undefined || nouns === undefined) return id
  const [singular, plural] = nouns
  return amount === '1' ? `last ${singular}` : `last ${amount} ${plural}`
}

/**
 * Resolve a page's declared window against the request URL and a concrete
 * instant.
 *
 * The rule is a CLOSED preset list with a fallback, exactly as
 * `resolvePageQueryValues` clamps a `$query` value into its `enum`: an
 * unrecognised `?period=` resolves to `default` and the page answers 200,
 * because a stale bookmark is not an error condition and a blank page over a
 * parameter the visitor never typed is the worse answer.
 *
 * `default` naming a declared preset is guaranteed by
 * `collectPageBindingViolations`, so the fallback is always itself selectable.
 *
 * `nowMs` is a parameter rather than a `Date.now()` call so the whole
 * resolution is pure and one render resolves ONE instant: panels each reading
 * the clock for themselves would drift their windows apart by however long the
 * render took, and a surface reporting two periods at once invites the operator
 * to compare them. It is epoch milliseconds rather than a `Date` because a
 * `Date` is mutable and this layer takes no mutable parameters.
 *
 * Returns `undefined` when the page declares no window, which keeps every
 * existing page's substitution and cache key byte-identical.
 */
export function resolvePageWindow(
  window: PageWindow | undefined,
  requestQuery: Readonly<Record<string, string>> | undefined,
  nowMs: number
): ResolvedPageWindow | undefined {
  if (window === undefined) return undefined

  const supplied = requestQuery?.[window.param ?? PAGE_WINDOW_DEFAULT_PARAM]
  const active = selectPreset(window, supplied)
  const spanMs = parsePresetSpanMs(active.id) ?? 0

  return {
    id: active.id,
    start: new Date(nowMs - spanMs).toISOString(),
    end: new Date(nowMs).toISOString(),
    granularity: active.granularity ?? deriveGranularity(spanMs),
    label: active.label ?? deriveLabel(active.id),
  }
}

/**
 * The declared preset a `?param=` value selects, falling back to `default`.
 *
 * The final fallback to the first preset is unreachable — `default` is
 * validated to name one — but keeps the return type honest without an
 * assertion, the same way `resolveLinksWindow` does.
 */
function selectPreset(window: PageWindow, supplied: string | undefined): PageWindowPreset {
  const byId = (id: string | undefined): PageWindowPreset | undefined =>
    id === undefined ? undefined : window.presets.find((preset) => preset.id === id)
  return byId(supplied) ?? byId(window.default) ?? window.presets[0]!
}

/**
 * The page-cache key dimension for a resolved window.
 *
 * TWO terms, and both are load-bearing. Without the preset id, `?period=30d`
 * would be served the bytes rendered for `7d`. Without the clock term, an entry
 * written at 09:00 would still claim to end "now" at 17:00 — the figures on the
 * page are timestamped, so an uncoarsened cache is a page that lies about when
 * it was measured.
 *
 * The clock term is the `end` instant floored to {@link PAGE_WINDOW_CACHE_BUCKET_MS},
 * which is what keeps it BOUNDED: one live entry per preset at any moment,
 * where a raw instant would mint one per request.
 *
 * Returns `undefined` for a page with no window, so every existing page's key
 * stays byte-identical.
 */
export function pageWindowVariantKey(resolved: ResolvedPageWindow | undefined): string | undefined {
  if (resolved === undefined) return undefined
  const bucket = Math.floor(Date.parse(resolved.end) / PAGE_WINDOW_CACHE_BUCKET_MS)
  return `${resolved.id}@${bucket}`
}
