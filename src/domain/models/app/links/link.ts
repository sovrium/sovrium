/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { LinkDestinationSchema } from './destination'
import { LinkLifecycleSchema } from './lifecycle'
import { LinkSlugSchema } from './slug'
import { LinkTargetSchema } from './targets'
import { LinkUtmSchema } from './utm'

/**
 * A filing tag. Lowercase and separator-joined like a slug, so tag filtering in
 * the console never has to case-fold.
 */
const LinkTagSchema = Schema.String.pipe(
  Schema.check(
    Schema.isMinLength(1),
    Schema.isMaxLength(40),
    Schema.isPattern(/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/, {
      message:
        "link 'tags' entries must be lowercase alphanumeric with single '-' or '_' separators (e.g. 'q3-launch')",
    })
  )
)

/**
 * A single tracked short link.
 *
 * `to` is single-destination sugar for a one-element `targets` list; the two are
 * mutually exclusive. Every consumer reads the list through `linkTargets()`
 * below, so the sugar is unwrapped in exactly one place.
 */
export const LinkSchema = Schema.Struct({
  /** The path segment after `/l/`. */
  slug: LinkSlugSchema,

  /** Single-destination sugar. Mutually exclusive with `targets`. */
  to: Schema.optional(LinkDestinationSchema),

  /** Explicit candidate list — required for a weighted rotation. */
  targets: Schema.optional(
    Schema.Array(LinkTargetSchema).pipe(
      Schema.annotate({
        title: 'Link Targets',
        description:
          'Candidate destinations. Several targets rotate by weight; use `to` instead for the single-destination case.',
      }),
      Schema.check(
        Schema.isMinLength(1, {
          message: "link 'targets' must declare at least one destination when present",
        })
      )
    )
  ),

  /** Human-facing name shown in the admin console. */
  title: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        title: 'Title',
        description: 'Human-facing name for this link, shown in the admin console',
      }),
      Schema.check(Schema.isMinLength(1), Schema.isMaxLength(200))
    )
  ),

  /** Filing tags used to group and filter links in the console. */
  tags: Schema.optional(
    Schema.Array(LinkTagSchema).pipe(
      Schema.annotate({
        title: 'Tags',
        description: 'Filing tags used to group and filter links in the admin console',
      }),
      Schema.check(Schema.isMaxLength(20))
    )
  ),

  /** Free-form operator notes. Never rendered publicly. */
  notes: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        title: 'Notes',
        description: 'Free-form operator notes. Shown in the admin console only, never publicly.',
      }),
      Schema.check(Schema.isMaxLength(2000))
    )
  ),

  /**
   * Put an interstitial between the click and the destination.
   *
   * For the case where the ADDRESS is shareable but the contents are not: a
   * board deck, a pre-release page, a client handover.
   *
   * **It must be `$env.`-prefixed, and that is a refusal rather than a
   * convention.** A literal password written into `app.links[]` would be
   * committed to git, reviewed in a pull request, and mirrored to any public
   * remote — three places a secret can never be recalled from. `$env.` is
   * already the codebase's runtime-resolved marker, so this reuses an existing
   * convention rather than inventing a rule. Links minted at runtime store a
   * hash, never plaintext, and no admin endpoint emits either.
   *
   * A gated link still records its click: the gate sits between the visitor and
   * the DESTINATION, not between the visitor and the measurement.
   */
  password: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        title: 'Password',
        description:
          'Gate this link behind a password prompt. Must be an $env. reference (e.g. $env.DECK_PASSWORD) — a literal would be committed to git.',
      }),
      Schema.check(
        Schema.isPattern(/^\$env\.[A-Z][A-Z0-9_]*$/, {
          message:
            "link 'password' must be an $env. reference (e.g. '$env.DECK_PASSWORD'), never a literal — a literal password in config is committed to git, reviewed in a pull request, and mirrored to any public remote",
        })
      )
    )
  ),

  /** Activation window, click cap, and what a dead link answers. */
  lifecycle: Schema.optional(LinkLifecycleSchema),

  /** Campaign parameters appended to the destination at redirect time. */
  utm: Schema.optional(LinkUtmSchema),
}).pipe(
  Schema.annotate({
    identifier: 'Link',
    title: 'Tracked Link',
    description:
      'A short link served at /l/{slug}: where it points, when it is live, and which campaign it belongs to. Every resolution is recorded as a click event.',
    examples: [
      {
        slug: 'spring-promo',
        to: 'https://example.com/pricing',
        title: 'Spring promo — pricing page',
      },
    ],
  }),
  Schema.check(
    Schema.makeFilter((link) => {
      const hasTo = link.to !== undefined
      const hasTargets = link.targets !== undefined
      if (hasTo && hasTargets) {
        return `Link '${link.slug}' declares both 'to' and 'targets' — 'to' is single-destination sugar for a one-element 'targets' list, so declaring both is ambiguous. Keep one.`
      }
      if (!hasTo && !hasTargets) {
        return `Link '${link.slug}' declares no destination — set 'to' for a single destination, or 'targets' for a weighted rotation.`
      }
      return true
    })
  )
)

/**
 * The canonical target list for a link.
 *
 * `to` is sugar for a one-element list, and this is the ONLY place that sugar is
 * unwrapped — the resolver, the QR route, the admin preview and the automation
 * writer all read links through here. A second unwrapping site is how the sugar
 * and the general form start disagreeing.
 *
 * Deliberately a runtime helper rather than a `Schema.transform`: a transform
 * would rewrite `to` into `targets` during decode, and `AppEncoded` would stop
 * being structurally identical to the config the operator wrote — the same
 * invariant the redirect matcher protects by applying its default status at
 * runtime instead of in the schema.
 */
export const linkTargets = (link: {
  readonly to?: string | undefined
  readonly targets?: ReadonlyArray<ResolvableLinkTarget>
}): ReadonlyArray<ResolvableLinkTarget> => {
  if (link.targets !== undefined) return link.targets
  return link.to === undefined ? [] : [{ to: link.to }]
}

/**
 * A targeting predicate as the RESOLVER sees it — structurally, so a stored row
 * decoded out of `system.links` and a config literal are the same shape.
 *
 * Deliberately looser than `LinkTargetWhen`: `device` widens to `string[]` here
 * because a database row is not re-validated against the literal union, and a
 * resolver that only accepted the narrow form would need a cast at exactly the
 * boundary where the data is least trustworthy.
 */
export interface LinkTargetPredicate {
  readonly country?: readonly string[] | undefined
  readonly device?: readonly string[] | undefined
  readonly os?: readonly string[] | undefined
  readonly language?: readonly string[] | undefined
}

/** One candidate destination, as every consumer of `linkTargets()` sees it. */
export interface ResolvableLinkTarget {
  readonly to: string
  readonly weight?: number | undefined
  readonly when?: LinkTargetPredicate | undefined
}

/**
 * Tracked short links served at `/l/{slug}`.
 *
 * WHY THIS IS NOT `redirects` — both answer a URL before page resolution, so the
 * boundary has to be explicit or the two drift into each other:
 *
 *  - `redirects` is a permanent URL migration. It answers 301, which a browser
 *    may cache forever, and it inherits the request's language prefix so a
 *    French visitor lands on the French replacement.
 *  - `links` is a shareable, measurable address. It answers 302 with
 *    `Cache-Control: no-store` — a cached redirect would silently defeat both
 *    the click cap and the expiry window — and it is deliberately
 *    locale-agnostic, because a link printed on a poster must have exactly one
 *    canonical address for its click data to be readable.
 *
 * Neither absorbs the other. Adding lifecycle and analytics to `redirects` would
 * burden every SEO migration rule with machinery it never uses.
 *
 * PRECEDENCE — links are evaluated AFTER static assets (a real shipped file
 * always wins) and BEFORE both redirects and page resolution. `/l` is a reserved
 * namespace: no page, form or redirect may claim a path under it.
 *
 * @example
 * ```typescript
 * links: [
 *   { slug: 'spring-promo',
 *     to: 'https://example.com/pricing',
 *     title: 'Spring promo — pricing page',
 *     tags: ['q3-launch'],
 *     utm: { source: 'linkedin', medium: 'social', campaign: 'spring' },
 *     lifecycle: { validUntil: '2026-08-31T23:59:59Z', maxClicks: 5000 } },
 * ]
 * ```
 */
export const LinksSchema = Schema.Array(LinkSchema).pipe(
  Schema.check(
    Schema.isMinLength(1, {
      message: 'links must declare at least one link when present',
    })
  ),
  // Annotations sit BEFORE the cross-rule filters, mirroring `RedirectsSchema`:
  // a trailing `Schema.annotate` after a refinement chain loses its
  // `title`/`description` in the generated JSON Schema, leaving `minItems`'
  // auto-description in their place.
  Schema.annotate({
    identifier: 'Links',
    title: 'Tracked Links',
    description:
      'Short links served at /l/{slug}. Each resolution is recorded as a click event in the built-in analytics store, so campaign performance is readable without a third-party redirector.',
    examples: [
      [
        { slug: 'spring-promo', to: 'https://example.com/pricing' },
        { slug: 'deck', to: 'https://example.com/deck.pdf', title: 'Investor deck' },
      ],
    ],
  }),
  Schema.check(
    Schema.makeFilter((links) => {
      const duplicate = links.find(
        (link, index) => links.findIndex((other) => other.slug === link.slug) !== index
      )
      return duplicate === undefined
        ? true
        : `Duplicate link slug '${duplicate.slug}' — each slug may be declared at most once, or /l/${duplicate.slug} would have two destinations`
    })
  )
)

/**
 * TypeScript type inferred from LinkSchema
 * @public
 */
export type Link = Schema.Schema.Type<typeof LinkSchema>

/**
 * TypeScript type inferred from LinksSchema
 * @public
 */
export type Links = Schema.Schema.Type<typeof LinksSchema>

/**
 * Encoded type of LinksSchema (what goes in before validation)
 * @public
 */
export type LinksEncoded = Schema.Codec.Encoded<typeof LinksSchema>
