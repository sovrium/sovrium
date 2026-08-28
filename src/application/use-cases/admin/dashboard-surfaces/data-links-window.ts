/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The analytics window the Links console reads at, and the URL-derived selector
 * that changes it ([internal ref]..-018).
 *
 * ─── WHY THE WINDOW IS URL-DERIVED ──────────────────────────────────────────
 *
 * `dataSource.system.query` is STATIC — it is resolved once, server-side, when
 * the surface is synthesized — so a window that changed without a navigation
 * would need client state the console does not have. `/_admin/pages` hit that
 * first and baked 30 days; Links is the second surface to hit it, and a second
 * baked window is where a platform gap stops being an oversight and becomes a
 * pattern.
 *
 * Deriving the window from `?period=` closes it without any of that: the three
 * presets render as ordinary links, back and forward move between windows for
 * free, a shared link carries the window it was read at, and a reload survives
 * it. `toDashboardPath()` drops the query string before the surface is resolved,
 * so path matching never sees it.
 *
 * ─── WHY AN UNKNOWN VALUE FALLS BACK RATHER THAN ERRORING ───────────────────
 *
 * A stale bookmark, or a share link truncated in a chat client, should show the
 * operator SOMETHING. A blank page over a query parameter they did not type is a
 * worse answer than the default window.
 *
 * ─── WHY THE WINDOW IS SAID OUT LOUD ────────────────────────────────────────
 *
 * A click count is indistinguishable at any window: 412 over seven days and 412
 * over all time are the same three digits. The surface therefore states its
 * window in visible copy rather than letting an operator assume "all time".
 */

import type { Component } from '@/domain/models/app/pages/components'

/** One selectable look-back window. */
interface PeriodPreset {
  /** The `?period=` value, and the selector's visible label. */
  readonly id: string
  /** Days back from now. */
  readonly days: number
  /**
   * Bucket width for the trend chart. An hourly bucket over 30 days would plot
   * 720 points into a few hundred pixels; a daily bucket over 24 hours would
   * plot one.
   */
  readonly granularity: 'hour' | 'day'
  /** How the window is named in visible copy ("the {copy}"). */
  readonly copy: string
}

/**
 * The three presets, in selector order. 24 hours is too short to read a
 * campaign and 30 days flattens a launch spike, so 7 days sits in the middle and
 * is the default.
 */
const PERIOD_PRESETS: ReadonlyArray<PeriodPreset> = [
  { id: '24h', days: 1, granularity: 'hour', copy: 'last 24 hours' },
  { id: '7d', days: 7, granularity: 'day', copy: 'last 7 days' },
  { id: '30d', days: 30, granularity: 'day', copy: 'last 30 days' },
]

/** The preset an unrecognised (or absent) `?period=` resolves to. */
const DEFAULT_PERIOD_ID = '7d'

const MS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * A resolved window: the exact `from` / `to` / `granularity` every panel on the
 * surface carries in its `dataSource.system.query`, resolved ONCE per render so
 * the page can never report two periods at the same time.
 */
export interface LinksWindow {
  /** The active preset's `?period=` id. */
  readonly id: string
  readonly from: string
  readonly to: string
  readonly granularity: 'hour' | 'day'
  /** How this window is named in visible copy. */
  readonly copy: string
}

/**
 * Resolve `?period=` to a concrete window, defaulting on anything unrecognised.
 *
 * Resolved once and threaded into every panel — the alternative (each panel
 * resolving `now` for itself) would drift the windows apart by however long the
 * render took, and a page reporting two periods invites the operator to compare
 * them.
 */
export function resolveLinksWindow(period: string | undefined): LinksWindow {
  const preset =
    PERIOD_PRESETS.find((candidate) => candidate.id === period) ??
    PERIOD_PRESETS.find((candidate) => candidate.id === DEFAULT_PERIOD_ID)
  // Unreachable — `DEFAULT_PERIOD_ID` is one of the presets — but the fallback
  // keeps the return type honest without a non-null assertion.
  const active: PeriodPreset = preset ?? { id: '7d', days: 7, granularity: 'day', copy: '7 days' }
  const to = new Date()
  const from = new Date(to.getTime() - active.days * MS_PER_DAY)
  return {
    id: active.id,
    from: from.toISOString(),
    to: to.toISOString(),
    granularity: active.granularity,
    copy: active.copy,
  }
}

/**
 * The static query params every analytics read on the surface carries. Kept as
 * one helper so a panel cannot be added with a window of its own.
 *
 * `eventName` narrows to ONE link on the per-link deep-dive; omitting it reads
 * the whole link population.
 */
export function analyticsQuery(
  active: LinksWindow,
  eventName?: string
): Readonly<Record<string, string>> {
  return {
    from: active.from,
    to: active.to,
    granularity: active.granularity,
    // The whole point of binding the analytics readers rather than a
    // links-specific endpoint: one aggregation path over the click store, asked
    // a narrower question ([internal ref] D6).
    event_type: 'link_click',
    ...(eventName === undefined ? {} : { event_name: eventName }),
  }
}

/**
 * The period selector: the three presets as real links, the active one marked
 * `aria-current="page"`.
 *
 * Links rather than buttons because that is what they are — each one addresses a
 * different document. The console's SPA nav intercepts them and swaps the
 * content region, so the whole page does not reload; both that and browser
 * history come for free precisely because they stayed anchors.
 *
 * @param basePath - the surface's own `/_admin/...` path (the directory or one
 *   link's deep-dive), so the selector keeps the operator where they are.
 */
export function periodSelector(basePath: string, active: LinksWindow): Component {
  return {
    type: 'container',
    element: 'nav',
    props: {
      'aria-label': 'Period',
      className: 'border-border flex w-fit items-center gap-1 rounded-md border p-0.5',
    },
    children: PERIOD_PRESETS.map((preset) => ({
      type: 'link',
      content: preset.id,
      props: {
        href: `${basePath}?period=${preset.id}`,
        className:
          preset.id === active.id
            ? 'bg-background-raised text-foreground rounded px-2.5 py-1 text-xs font-medium'
            : 'text-foreground-muted hover:text-foreground rounded px-2.5 py-1 text-xs font-medium',
        ...(preset.id === active.id ? { 'aria-current': 'page' } : {}),
      },
    })),
  } as unknown as Component
}

/**
 * The one-line statement of which window the figures above cover.
 *
 * Rendered as a single leaf paragraph, and the phrase appears exactly once per
 * document, so `getByText(/last 7 days/i)` resolves to one element.
 */
export function windowCopy(active: LinksWindow): Component {
  return {
    type: 'text',
    element: 'p',
    props: { className: 'text-foreground-subtle text-xs' },
    content: `Measured over the ${active.copy}.`,
  } as unknown as Component
}
