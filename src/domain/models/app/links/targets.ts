/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { LinkDestinationSchema } from './destination'

/**
 * One candidate destination for a link.
 *
 * WHY A LIST EXISTS ON DAY ONE, when almost every link has exactly one target:
 * this is a resolver CONTROL-FLOW decision, not a schema-shape preference.
 *
 * With a target list, resolution is always the same shape — filter the
 * candidates, pick one, build the URL — and adding geo/device predicates later
 * touches only the filter step. With a bare `to`, adding predicates rewrites
 * every consumer that assumed a single destination: the `/l/:token` handler, the
 * `.svg` handler, the admin preview, the `qr-code` page component, and the
 * automation writer. The single-target case is the degenerate case of the
 * general one; the reverse is not true.
 *
 * It also means `targetIndex` is recorded on every click event from the first
 * click. An attribution key added later leaves the earliest months of data
 * unattributable, which is exactly the window an A/B dashboard would most want.
 *
 * `when` (geo / device / language predicates) landed HERE, changing no call
 * site — and it was authored in the SAME change as the resolver's filter step,
 * because a predicate the schema accepts and the resolver ignores is worse than
 * no predicate: it validates, ships, and silently does nothing while the
 * operator believes their targeting is live.
 */

/** A non-empty list of case-insensitive predicate values. */
const PredicateValues = (title: string, description: string) =>
  Schema.optional(
    Schema.Array(Schema.String.pipe(Schema.check(Schema.isMinLength(1)))).pipe(
      Schema.annotate({ title, description }),
      Schema.check(
        Schema.isMinLength(1, {
          message: `link target 'when' predicate '${title}' must list at least one value when present`,
        })
      )
    )
  )

/**
 * Which visitors a target is for.
 *
 * A target carrying `when` is a CANDIDATE only for visitors it matches; every
 * declared key must match, so `{ device: ['mobile'], os: ['ios'] }` reads as
 * "mobile AND iOS". Values are matched case-insensitively, so `ios` in a config
 * meets the `iOS` the user-agent parser reports without the author having to
 * know which spelling won.
 *
 * `country` HAS NO DATA SOURCE in a self-hosted deployment and pretending
 * otherwise would be the worst outcome available. There is no IP database and
 * adding one breaks the zero-dependency rule, so the only source is a header a
 * reverse proxy in front of the app sets. With no such header the predicate does
 * NOT match and the visitor falls through to the predicate-free default — fail
 * open, never closed. A geo rule that silently matched everything would send
 * every visitor to a regional page; one that failed closed would 404 an audience
 * the operator never meant to exclude. Falling through is the only failure that
 * is wrong VISIBLY: the operator sees everyone landing on the default and goes
 * looking.
 */
export const LinkTargetWhenSchema = Schema.Struct({
  /**
   * ISO 3166-1 alpha-2 country codes, read from a reverse-proxy header only
   * (`cf-ipcountry`, `x-vercel-ip-country`, `x-country-code`).
   */
  country: PredicateValues(
    'Country',
    "ISO 3166-1 alpha-2 country codes. Read ONLY from a reverse-proxy header (cf-ipcountry, x-vercel-ip-country, x-country-code) — a self-hosted app has no IP database. With no header present this predicate does not match and the visitor falls through to the target that declares no 'when'."
  ),

  /** Device class, as the shared user-agent parser reports it. */
  device: Schema.optional(
    Schema.Array(Schema.Literals(['mobile', 'tablet', 'desktop'])).pipe(
      Schema.annotate({
        title: 'Device',
        description: 'Device classes this target serves, read from the visitor User-Agent.',
      }),
      Schema.check(
        Schema.isMinLength(1, {
          message: "link target 'when.device' must list at least one device class when present",
        })
      )
    )
  ),

  /** Operating-system names, matched case-insensitively (`ios`, `android`, …). */
  os: PredicateValues(
    'Operating System',
    "Operating systems this target serves (e.g. 'ios', 'android', 'windows'), read from the visitor User-Agent and matched case-insensitively."
  ),

  /** Primary language subtags, matched against `Accept-Language`. */
  language: PredicateValues(
    'Language',
    "Primary language subtags this target serves (e.g. 'fr'), matched against the visitor's Accept-Language header."
  ),
}).pipe(
  Schema.annotate({
    identifier: 'LinkTargetWhen',
    title: 'Targeting Predicate',
    description:
      'Which visitors this target is for. Every declared key must match. A target with no `when` is the fallback every visitor can reach.',
    examples: [{ device: ['mobile'], os: ['ios'] }],
  }),
  Schema.check(
    Schema.makeFilter((when) =>
      when.country === undefined &&
      when.device === undefined &&
      when.os === undefined &&
      when.language === undefined
        ? "link target 'when' declares no predicate — an empty 'when' matches nobody more narrowly than omitting it, so drop it or name a country, device, os or language"
        : true
    )
  )
)

export const LinkTargetSchema = Schema.Struct({
  /** Where this target sends the visitor. */
  to: LinkDestinationSchema,

  /**
   * Which visitors this target is for. Omit it to make the target the fallback
   * every visitor can reach — at least one target must, or a visitor matching
   * nothing would have nowhere to go.
   */
  when: Schema.optional(LinkTargetWhenSchema),

  /**
   * Relative share in a weighted rotation. Defaults to 1, so an unweighted list
   * splits evenly. Ignored when the link declares a single target.
   */
  weight: Schema.optional(
    Schema.Finite.pipe(
      Schema.annotate({
        title: 'Target Weight',
        description:
          'Relative share of traffic this target receives in a weighted rotation (default 1). A target with weight 3 receives three times the traffic of one with weight 1.',
      }),
      Schema.check(Schema.isInt(), Schema.isGreaterThan(0))
    )
  ),
}).pipe(
  Schema.annotate({
    identifier: 'LinkTarget',
    title: 'Link Target',
    description:
      'One candidate destination for a link. A link with several targets rotates between them by weight, and a target may narrow itself to a slice of visitors with `when`.',
    examples: [{ to: 'https://example.com/variant-a', weight: 1 }],
  })
)

/**
 * TypeScript type inferred from LinkTargetSchema
 * @public
 */
export type LinkTarget = Schema.Schema.Type<typeof LinkTargetSchema>

/**
 * TypeScript type inferred from LinkTargetWhenSchema
 * @public
 */
export type LinkTargetWhen = Schema.Schema.Type<typeof LinkTargetWhenSchema>
