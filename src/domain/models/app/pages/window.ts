/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Accepted spelling of a look-back preset id: a positive integer followed by a
 * unit. A single STATIC literal — never built from input
 * (`sovrium/no-dynamic-regexp`).
 *
 * `h` / `d` / `w` and nothing else. Months and years are deliberately absent:
 * neither has a fixed length, so `1m` back from March 31st has no single
 * defensible answer, and a window whose span depends on which month it is
 * asked in cannot be reasoned about from the config alone. A 90-day window is
 * spelled `90d`.
 */
export const PAGE_WINDOW_PRESET_ID = /^[1-9][0-9]*[hdw]$/

/**
 * Time-series bucket width, spelled exactly as the analytics readers accept it
 * (`analyticsQuerySchema.granularity`, `src/domain/models/api/analytics/analytics.ts`).
 *
 * Kept identical on purpose: `$window.granularity` is substituted straight into
 * a `dataSource.system.query`, so a value this schema admitted and the reader
 * rejected would be a 400 no config author could have predicted from the
 * config.
 */
export const PageWindowGranularitySchema = Schema.Literals([
  'hour',
  'day',
  'week',
  'month',
]).annotate({
  identifier: 'PageWindowGranularity',
  title: 'Page Window Granularity',
  description: 'Time-series bucket width requested alongside the resolved window',
})

/** @public */
export type PageWindowGranularity = Schema.Schema.Type<typeof PageWindowGranularitySchema>

/**
 * One selectable look-back window.
 *
 * The `id` IS the duration — `7d` names the window AND says how long it is —
 * so there is no second field to keep in step with the first, and no way to
 * declare `id: 30d` with a seven-day span.
 *
 * `granularity` and `label` are optional because both have a defensible
 * derivation from the span (a 24-hour window buckets hourly and reads "last 24
 * hours"), and a required field with a correct default is a field every author
 * has to restate. Declaring one overrides the derivation — a 30-day window
 * bucketed weekly is a legitimate choice the platform should not refuse.
 *
 * @example
 * ```yaml
 * - id: 24h
 *   granularity: hour
 *   label: last 24 hours
 * ```
 */
export const PageWindowPresetSchema = Schema.Struct({
  /**
   * The `?<param>=` value AND the window's span, e.g. `24h`, `7d`, `30d`.
   *
   * The grammar is enforced by `collectPageBindingViolations` rather than by a
   * `Schema.check` here, for the reason that file records: a check WRAPS the
   * node it guards, and the docs property walker names a node by the identifier
   * on its OUTERMOST node — so a wrapped struct stops being addressed by its own
   * name and silently re-keys the published property universe.
   */
  id: Schema.String.pipe(
    Schema.annotate({
      description:
        'Look-back span and URL value: a positive integer plus h, d or w (e.g. 24h, 7d, 30d)',
      examples: ['24h', '7d', '30d'],
    }),
    Schema.check(Schema.isMinLength(1))
  ),
  /**
   * Bucket width for a time series read at this window.
   *
   * Derived from the span when omitted: an hourly bucket over 30 days plots 720
   * points into a few hundred pixels, and a daily bucket over 24 hours plots
   * one, so the derivation is `≤ 48h → hour`, `≤ 90d → day`, otherwise `week`.
   */
  granularity: Schema.optional(PageWindowGranularitySchema),
  /**
   * How this window is named in visible copy — the phrase a surface prints so
   * an operator is never left to assume "all time".
   *
   * A figure is indistinguishable at any window: 412 over seven days and 412
   * over all time are the same three digits. Derived from the span when omitted
   * (`7d` → `last 7 days`); accepts a `$t:` token like any other string, so a
   * localized phrase is expressible.
   */
  label: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        description: 'Phrase naming this window in visible copy (default: derived from the span)',
        examples: ['last 7 days', '$t:analytics.window.7d'],
      }),
      Schema.check(Schema.isMinLength(1))
    )
  ),
}).annotate({
  identifier: 'PageWindowPreset',
  title: 'Page Window Preset',
  description: 'One selectable look-back window: its span, its bucket width, and how it is named',
})

/** @public */
export type PageWindowPreset = Schema.Schema.Type<typeof PageWindowPresetSchema>

/**
 * `page.window` — a RELATIVE look-back window, resolved to absolute instants at
 * render and selectable from the URL.
 *
 * ─── WHAT WAS MISSING ──────────────────────────────────────────────────────
 *
 * A `dataSource.system.query` value is a STATIC literal, and the analytics
 * readers require ABSOLUTE ISO `from` / `to`
 * (`analyticsQuerySchema`). `page.query` gets a surface a period SELECTOR and
 * no period: `$query.period` substitutes the preset id `7d`, which is not a
 * timestamp. So "the last seven days, ending now" was not expressible in config
 * at all — which is why Sovrium's own Analytics and Links consoles compute the
 * window in TypeScript and bake it into every panel.
 *
 * ─── WHY A CLOSED PRESET LIST, NOT AN EXPRESSION ───────────────────────────
 *
 * The obvious alternative is an expression — `from: $now-7d`. It was rejected
 * on two counts, and both are fatal rather than stylistic.
 *
 *  1. **It is the first line of a language.** Once `$now-7d` parses, `$now-7d+1h`
 *     and `$startOfMonth` are the next two requests, and a config file has
 *     acquired arithmetic that nothing can typecheck, no `sovrium validate` can
 *     bound, and no test can enumerate.
 *  2. **It is uncacheable by construction.** `$now` moves continuously, so every
 *     request resolves a distinct `from`/`to` pair and every render is a distinct
 *     cache entry. A closed preset list keeps the reachable set at
 *     `presets.length` — the same bound `page.query` buys, for the same reason —
 *     so the resolved window NAME is a safe cache dimension where a resolved
 *     timestamp never could be.
 *
 * ─── WHAT IT RESOLVES TO ───────────────────────────────────────────────────
 *
 * Five references, and no more. Each is a fact about the ACTIVE preset, and the
 * set is closed for the same reason `page.requires` is: an open `$window.<x>`
 * would leave a typo permanently unresolved with nothing anywhere saying why.
 *
 * | Reference             | Value                                                  |
 * | --------------------- | ------------------------------------------------------ |
 * | `$window.start`       | ISO 8601 instant `span` before `$window.end`           |
 * | `$window.end`         | ISO 8601 instant the window ends at (render time)      |
 * | `$window.granularity` | `hour` / `day` / `week` / `month`                      |
 * | `$window.label`       | The visible phrase, e.g. `last 7 days`                 |
 * | `$window.id`          | The active preset id, e.g. `7d` — for marking a selector |
 *
 * They resolve ONCE per render. A page whose panels each resolved `now` for
 * themselves would drift its windows apart by however long the render took, and
 * a surface reporting two periods at once invites the operator to compare them.
 *
 * ─── THE URL, AND WHY AN UNKNOWN VALUE IS NOT AN ERROR ─────────────────────
 *
 * `param` names the query key (default `period`), so the presets render as
 * ordinary links: back and forward move between windows for free, a shared link
 * carries the window it was read at, and a reload survives it.
 *
 * A value outside the declared presets resolves to `default` and the page
 * answers 200 — identical to `page.query`, and for the identical reason: a
 * stale bookmark or a link truncated in a chat client should show the operator
 * SOMETHING, and a blank page over a parameter they never typed is the worse
 * answer.
 *
 * ─── CACHING ───────────────────────────────────────────────────────────────
 *
 * A page declaring `window` renders a function of the clock, so its cache key
 * carries the resolved preset id AND a coarsened `end` instant. Both halves are
 * load-bearing: without the id, `?period=30d` would be served `7d`'s bytes;
 * without the clock term, an entry written at 09:00 would still claim to end
 * "now" at 17:00. Coarsening is what keeps the second term bounded — a raw
 * instant would mint one entry per request and turn the cache into a leak.
 *
 * @example
 * ```yaml
 * pages:
 *   - name: analytics
 *     path: /analytics
 *     window:
 *       param: period
 *       default: 7d
 *       presets:
 *         - { id: 24h, granularity: hour, label: last 24 hours }
 *         - { id: 7d }
 *         - { id: 30d }
 *     components:
 *       - type: chart
 *         dataSource:
 *           system:
 *             endpoint: /api/analytics/overview
 *             query:
 *               from: $window.start
 *               to: $window.end
 *               granularity: $window.granularity
 *       - type: text
 *         element: p
 *         content: Measured over the $window.label.
 * ```
 */
export const PageWindowSchema = Schema.Struct({
  /**
   * URL query key the window is selected with. Defaults to `period`.
   *
   * Declared rather than fixed so a page may carry a window ALONGSIDE
   * `page.query` properties without the two fighting over one key — and so a
   * surface reading two independent windows is at least spellable.
   */
  param: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        description: "URL query key selecting the window (default: 'period')",
        examples: ['period', 'range'],
      }),
      Schema.check(Schema.isMinLength(1))
    )
  ),
  /** Preset id used when the URL omits the parameter or supplies an undeclared one */
  default: Schema.String.pipe(
    Schema.annotate({
      description: 'Preset id used when the URL omits the parameter or names an undeclared preset',
      examples: ['7d'],
    }),
    Schema.check(Schema.isMinLength(1))
  ),
  /** The selectable windows, in selector order */
  presets: Schema.Array(PageWindowPresetSchema).pipe(
    Schema.annotate({
      description: 'Selectable look-back windows, in selector order; at least one required',
    }),
    Schema.check(Schema.isMinLength(1))
  ),
}).annotate({
  identifier: 'PageWindow',
  title: 'Page Window',
  description:
    'A relative look-back window selected from the URL and resolved to absolute instants at render, referenceable as $window.start / $window.end / $window.granularity / $window.label / $window.id',
})

/** @public */
export type PageWindow = Schema.Schema.Type<typeof PageWindowSchema>

/** The `?param=` key a `page.window` declaring none is selected with. */
export const PAGE_WINDOW_DEFAULT_PARAM = 'period'
