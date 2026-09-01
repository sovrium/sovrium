/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { TemplateStringSchema } from '../../template'

/**
 * The prop shapes the three `link` operators share.
 *
 * ── Why none of these reuse the config-side link schemas ────────────────────
 *
 * `LinkSlugSchema` and `LinkDestinationSchema` validate a LITERAL value written
 * into `app.links[]`. Every one of these props is a TEMPLATE, resolved against
 * the trigger payload at run time — templating is the entire reason the action
 * exists, since a static destination could have been a config-declared link.
 *
 * A template does not satisfy the literal patterns and must not have to:
 *
 *  - `LINK_SLUG_PATTERN` is lowercase-alphanumeric-and-separators, so
 *    `product-{{trigger.record.handle}}` is rejected by the braces alone.
 *  - `LINK_DESTINATION_PATTERN` requires a leading `/` or `http(s)://`, so the
 *    archetypal automation destination — `{{trigger.record.website}}`, a URL
 *    the record already holds — is rejected outright.
 *
 * So decode-time validation here is deliberately shallow, and the real check
 * moves to the RESOLVED value. That is a handler obligation, and it is not
 * optional: the resolved slug and destination must be validated with the same
 * rules the admin boundary applies (`LINK_SLUG_PATTERN`, `RESERVED_LINK_SLUGS`,
 * `LINK_DESTINATION_PATTERN` — all exported from `@/domain/models/app/links/`),
 * and a value that fails must fail the STEP rather than be written. Skipping it
 * would let a workflow mint `MyLink`, or a `javascript:` destination, that the
 * console could never create — a validation bypass through a second door, the
 * same class of hole the config-declared-slug guard closes.
 *
 * ── Why the length bounds look larger than the config ones ──────────────────
 *
 * They bound the TEMPLATE, not the value it produces. A 30-character slug can
 * easily be authored as an 80-character template, so capping the template at
 * the stored field's own limit would refuse config that resolves perfectly
 * legally. The bounds below are authoring sanity limits; the resolved value is
 * bounded by the shared write path, which is where it belongs.
 */

/**
 * The slug a step mints or targets.
 *
 * Bounded well above the stored 64-character limit for the reason above — the
 * template is longer than its result.
 */
export const LinkActionSlugSchema = TemplateStringSchema.pipe(
  Schema.check(Schema.isMinLength(1), Schema.isMaxLength(200)),
  Schema.annotate({
    description:
      "The path segment after /l/, as a template (e.g. 'product-{{trigger.record.handle}}'). The RESOLVED value must be lowercase alphanumeric with single '-' or '_' separators, and must not name a reserved slug.",
  })
)

/**
 * Where the minted link sends the visitor.
 *
 * Unbounded above: destinations legitimately carry long query strings, and the
 * config-side schema does not cap them either.
 */
export const LinkActionDestinationSchema = TemplateStringSchema.pipe(
  Schema.check(Schema.isMinLength(1)),
  Schema.annotate({
    description:
      "Where the link sends the visitor, as a template. The RESOLVED value must be a root-relative path or an absolute http(s) URL (e.g. 'https://example.com/products/{{trigger.record.handle}}').",
  })
)

/** Operator-facing name, shown in the admin console. */
export const LinkActionTitleSchema = TemplateStringSchema.pipe(
  Schema.check(Schema.isMinLength(1), Schema.isMaxLength(500)),
  Schema.annotate({
    description: 'Human-facing name for this link, shown in the admin console. Templated.',
  })
)

/** Free-form operator notes. Never rendered publicly. */
export const LinkActionNotesSchema = TemplateStringSchema.pipe(
  Schema.check(Schema.isMinLength(1), Schema.isMaxLength(4000)),
  Schema.annotate({
    description: 'Free-form operator notes, shown in the admin console only. Templated.',
  })
)

/** Filing tags used to group and filter links in the console. */
export const LinkActionTagsSchema = Schema.Array(
  TemplateStringSchema.pipe(Schema.check(Schema.isMinLength(1), Schema.isMaxLength(200)))
).pipe(
  Schema.check(Schema.isMaxLength(20)),
  Schema.annotate({
    description:
      'Filing tags used to group and filter links in the admin console. Each entry is templated; each RESOLVED entry must be lowercase alphanumeric with single separators.',
  })
)

/** A campaign parameter on a sparse edit: a template, or `null` to clear it. */
const UtmPatchValueSchema = Schema.NullOr(
  TemplateStringSchema.pipe(Schema.check(Schema.isMinLength(1), Schema.isMaxLength(500)))
)

/**
 * A SPARSE edit of the campaign block.
 *
 * Absence and `null` are different instructions and both are load-bearing: an
 * absent key leaves that parameter alone, an explicit `null` removes it. That
 * is the same distinction `LinkUtmPatch` carries in the shared write path, and
 * collapsing the two would make a campaign parameter impossible to clear once
 * set — which is exactly the edit an operator makes when a campaign is
 * re-targeted.
 *
 * Distinct from `LinkUtmSchema` (used by `create`) for that one reason only:
 * a create has nothing to merge against, so it has no use for `null`.
 */
export const LinkActionUtmPatchSchema = Schema.Struct({
  /** `utm_source` — where the traffic came from. `null` clears it. */
  source: Schema.optional(UtmPatchValueSchema),

  /** `utm_medium` — the channel category. `null` clears it. */
  medium: Schema.optional(UtmPatchValueSchema),

  /** `utm_campaign` — the campaign this link belongs to. `null` clears it. */
  campaign: Schema.optional(UtmPatchValueSchema),

  /** `utm_content` — distinguishes variants of one campaign. `null` clears it. */
  content: Schema.optional(UtmPatchValueSchema),

  /** `utm_term` — paid-search keyword. `null` clears it. */
  term: Schema.optional(UtmPatchValueSchema),
}).pipe(
  Schema.annotate({
    identifier: 'LinkActionUtmPatch',
    title: 'Link Action Campaign Parameter Patch',
    description:
      'A sparse edit of a link campaign block. An omitted key leaves that parameter alone; an explicit null removes it.',
    // eslint-disable-next-line unicorn/no-null -- `null` IS the documented instruction being illustrated: it is what clears a parameter, and `undefined` here would mean the opposite (leave it alone), so the example would teach the wrong rule
    examples: [{ campaign: 'relaunch' }, { term: null }],
  }),
  Schema.check(
    Schema.makeFilter((utm) =>
      Object.values(utm).every((value) => value === undefined)
        ? "link action 'utm' declares no parameters — omit the block entirely rather than declaring it empty"
        : true
    )
  )
)

/**
 * TypeScript type inferred from LinkActionUtmPatchSchema
 * @public
 */
export type LinkActionUtmPatch = Schema.Schema.Type<typeof LinkActionUtmPatchSchema>
