/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

const UtmValueSchema = Schema.String.pipe(
  Schema.check(Schema.isMinLength(1), Schema.isMaxLength(200))
)

/**
 * Campaign parameters appended to the destination as `utm_*` at redirect time.
 *
 * Declaring them on the link rather than baking them into the destination is
 * what makes one short link readable in the existing campaign report: the same
 * `utm_campaign` a page view carries is the one a click carries, so
 * `/api/analytics/campaigns` groups both without a mapping layer.
 *
 * MERGE PRECEDENCE, decided once and implemented once in the resolver:
 *
 *   1. **Destination-authored wins.** `to: 'https://x.com/?utm_source=partner'`
 *      is the most explicit statement of intent an author can make.
 *   2. **Incoming request query next.** `/l/deck?utm_source=linkedin` is a
 *      deliberate per-share override, and the redirect matcher already
 *      establishes that an incoming query is carried onto the target.
 *   3. **This block last** — it is the default for shares that say nothing.
 *
 * The `qr` marker parameter is stripped before forwarding, so it never reaches
 * the destination.
 */
export const LinkUtmSchema = Schema.Struct({
  /** `utm_source` — where the traffic came from (e.g. 'linkedin'). */
  source: Schema.optional(
    UtmValueSchema.pipe(
      Schema.annotate({ description: "Campaign source, appended as utm_source (e.g. 'linkedin')" })
    )
  ),

  /** `utm_medium` — the channel category (e.g. 'social', 'email'). */
  medium: Schema.optional(
    UtmValueSchema.pipe(
      Schema.annotate({ description: "Campaign medium, appended as utm_medium (e.g. 'social')" })
    )
  ),

  /** `utm_campaign` — the campaign name this link belongs to. */
  campaign: Schema.optional(
    UtmValueSchema.pipe(
      Schema.annotate({
        description: "Campaign name, appended as utm_campaign (e.g. 'spring-launch')",
      })
    )
  ),

  /** `utm_content` — distinguishes variants of the same campaign. */
  content: Schema.optional(
    UtmValueSchema.pipe(
      Schema.annotate({ description: 'Campaign content, appended as utm_content' })
    )
  ),

  /** `utm_term` — paid-search keyword. */
  term: Schema.optional(
    UtmValueSchema.pipe(Schema.annotate({ description: 'Campaign term, appended as utm_term' }))
  ),
}).pipe(
  Schema.annotate({
    identifier: 'LinkUtm',
    title: 'Link Campaign Parameters',
    description:
      'Campaign parameters appended to the destination as utm_* at redirect time, so clicks land in the same campaign report as page views.',
    examples: [{ source: 'linkedin', medium: 'social', campaign: 'spring-launch' }],
  }),
  Schema.check(
    Schema.makeFilter((utm) =>
      Object.values(utm).every((value) => value === undefined)
        ? "link 'utm' declares no parameters — omit the block entirely rather than declaring it empty"
        : true
    )
  )
)

/**
 * TypeScript type inferred from LinkUtmSchema
 * @public
 */
export type LinkUtm = Schema.Schema.Type<typeof LinkUtmSchema>
