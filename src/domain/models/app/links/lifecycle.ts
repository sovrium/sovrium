/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { LinkDestinationSchema } from './destination'

/**
 * When a link is live, and when it stops being live.
 *
 * A campaign link that outlives its campaign is a small but real liability: it
 * keeps sending people to a sold-out offer, an expired price, or a page that has
 * since been repurposed. Every field is optional — by default a link is live
 * forever and uncapped.
 *
 * WHAT A DEAD LINK ANSWERS — `410 Gone`, not `404`. The URL genuinely did exist,
 * and 410 is the answer that tells a crawler to drop it and a human that it
 * expired rather than that they mistyped it. `expiredTo` opts into a redirect
 * instead, which is the important case for print: a flyer cannot be recalled, so
 * sending the scan to a "this campaign has ended" page beats a dead end.
 *
 * `maxClicks` — TWO PROPERTIES THAT MUST BE DOCUMENTED, NOT DISCOVERED:
 *
 *  1. **It counts clicks within the analytics retention window** (365 days by
 *     default). Clicks are recorded in one place only — `system.analytics_events`
 *     — and that table is purged on the retention schedule, so a link that
 *     outlives retention receives a fresh budget. This is the deliberate price of
 *     a single tracking store; the alternative is a counter column that drifts
 *     from the event log it duplicates. In practice a capped link is a campaign
 *     link that expires well inside a year.
 *  2. **Enforcement is best-effort under burst.** Counting and then deciding is
 *     not atomic, so a simultaneous burst may overshoot the cap by a small
 *     number. For a marketing click cap, "stops at about N" is the correct
 *     product semantic.
 */
export const LinkLifecycleSchema = Schema.Struct({
  /**
   * Whether the link resolves at all. Defaults to `true`.
   *
   * A link declared `enabled: false` in config cannot be re-enabled from the
   * admin console — the operational overlay may only ever be MORE restrictive
   * than the config file, never less.
   */
  enabled: Schema.optional(
    Schema.Boolean.pipe(
      Schema.annotate({
        title: 'Enabled',
        description:
          'Whether the link resolves (default true). A config-disabled link cannot be re-enabled from the admin console.',
      })
    )
  ),

  /** ISO 8601 timestamp before which the link does not yet resolve. */
  validFrom: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        title: 'Valid From',
        description: 'ISO 8601 timestamp before which the link is not yet live',
      })
    )
  ),

  /** ISO 8601 timestamp after which the link stops resolving. */
  validUntil: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        title: 'Valid Until',
        description: 'ISO 8601 timestamp after which the link stops resolving',
      })
    )
  ),

  /** Cap on clicks accepted before the link stops resolving. */
  maxClicks: Schema.optional(
    Schema.Finite.pipe(
      Schema.annotate({
        title: 'Maximum Clicks',
        description:
          'Clicks accepted before the link stops resolving. Counted within the analytics retention window, and enforced best-effort under burst.',
      }),
      Schema.check(Schema.isInt(), Schema.isGreaterThan(0))
    )
  ),

  /**
   * Where to send a visitor who arrives at a link that is disabled, outside its
   * window, or past its cap. When omitted the link answers 410 Gone.
   */
  expiredTo: Schema.optional(
    LinkDestinationSchema.pipe(
      Schema.annotate({
        title: 'Expired Destination',
        description:
          'Where to send a visitor arriving at a dead link. Omit to answer 410 Gone instead — set it when the link is printed and cannot be recalled.',
      })
    )
  ),
}).pipe(
  Schema.annotate({
    identifier: 'LinkLifecycle',
    title: 'Link Lifecycle',
    description:
      'When a link is live: an optional activation window, an optional click cap, and what a dead link answers.',
    examples: [{ validUntil: '2026-08-31T23:59:59Z', maxClicks: 5000 }],
  }),
  Schema.check(
    Schema.makeFilter((lifecycle) => {
      const { validFrom, validUntil } = lifecycle
      if (validFrom === undefined && validUntil === undefined) return true

      if (validFrom !== undefined && Number.isNaN(Date.parse(validFrom))) {
        return `link lifecycle 'validFrom' must be a valid ISO 8601 timestamp (received '${validFrom}')`
      }
      if (validUntil !== undefined && Number.isNaN(Date.parse(validUntil))) {
        return `link lifecycle 'validUntil' must be a valid ISO 8601 timestamp (received '${validUntil}')`
      }
      if (
        validFrom !== undefined &&
        validUntil !== undefined &&
        Date.parse(validFrom) >= Date.parse(validUntil)
      ) {
        return `link lifecycle 'validFrom' (${validFrom}) must be strictly before 'validUntil' (${validUntil}) — as written the link is never live`
      }
      return true
    })
  )
)

/**
 * TypeScript type inferred from LinkLifecycleSchema
 * @public
 */
export type LinkLifecycle = Schema.Schema.Type<typeof LinkLifecycleSchema>
