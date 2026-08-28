/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { VoicePronounSchema, VoiceToneSchema } from './voice'

/**
 * A non-empty guidance line — the same constraint `voice.ts` applies, for the
 * same reason: every string here is a sentence a human or an agent READS, and a
 * blank one reaches the generated charter looking like guidance that was lost.
 *
 * Deliberately re-stated rather than exported from `voice.ts` and imported: the
 * message names the field family it belongs to, and a shared
 * `'A voice guidance line must not be empty'` fired from a `zones[]` entry
 * would send the author to `design.voice`.
 */
const zoneGuidanceLine = (subject: string) =>
  Schema.String.pipe(
    Schema.check(Schema.isMinLength(1, { message: `${subject} must not be empty` }))
  )

/**
 * The accent budget vocabulary — deliberately BINARY.
 *
 * The distinction the platform actually enforces is one question: *may this
 * surface spend warmth, accent and persuasion?* `[internal ref]`
 * assertion (c) asks exactly that and nothing finer — it refuses a gated route
 * governed by a zone carrying the PUBLIC budget, and treats every other budget
 * identically. A three- or five-value vocabulary would be a distinction the
 * lock cannot read, which is how a config key becomes prose.
 *
 * The per-zone prose in `BRAND.md` §5 stays richer on purpose (`demonstrative
 * marketing`, `quiet`, `demonstrative`) — that column describes *how* to spend
 * the budget. This field declares *which* budget, so the gate can hold it.
 */
export const AccentBudgetSchema = Schema.Literals(['public', 'product']).pipe(
  Schema.annotate({
    identifier: 'AccentBudget',
    title: 'Accent Budget',
    description:
      'Which accent budget the zone carries. `public` is the persuasion budget — warmth, accent, marketing weight — and may only govern ungated routes. `product` is the working budget for everything a signed-in operator sees.',
    examples: ['public', 'product'],
  })
)

/**
 * Zone names that carry the PUBLIC accent budget by convention.
 *
 * THIS IS THE ONE DEFINITION. It was briefly written twice — here and as
 * `PUBLIC_BUDGET_ZONES` in `[internal ref]` — while
 * `design.zones[]` existed and nothing read it. That duplication is now closed
 * in the direction the boundary allows: `scripts/` imports from `src/` (it
 * already imports `@/infrastructure/schema`), never the reverse, because `src/`
 * ships in the binary and `scripts/` does not. The name over there survives as a
 * re-export of this constant.
 *
 * So the value lives here, and rule 4 below refuses a config whose `zone` name
 * and `accentBudget` would contradict it.
 *
 * Note what this list is NOT: it does not answer *"what budget does this zone
 * carry?"* — `accentBudget` answers that, and is authoritative. This list only
 * answers *"which zone names are conventionally public?"*, which is what makes
 * `{ zone: 'marketing', accentBudget: 'product' }` a contradiction worth
 * refusing rather than an exotic-but-legal declaration.
 */
export const PUBLIC_BUDGET_ZONE_NAMES: readonly string[] = ['marketing']

/**
 * A per-zone voice override.
 *
 * ## Per-FIELD, not whole-object
 *
 * A field declared here REPLACES the same field of `design.voice` for every
 * route the zone governs; a field left undeclared INHERITS. This is not a
 * stylistic preference — whole-object replacement would silently drop the
 * overriding zone's `avoid` rules, and `avoid` is where the destructive
 * guidance lives ("no unverifiable percentages", "never accuse"). A zone that
 * only needed a different pronoun would lose every refusal the app had written,
 * and nothing anywhere would say so.
 *
 * ## `personality` is deliberately absent
 *
 * The four fields below are the whole override surface. `personality` is app
 * IDENTITY, not situational register: a zone that is a different personality is
 * a different app, and `personality` is what the `BRAND.md` inheritance
 * contract is built on. Making it overridable would let one config declare two
 * brands and call it a zone map.
 *
 * The real case this exists for is `apps/partner`, whose public marketing zone
 * addresses the reader as `vous` while the portal behind auth uses the product
 * register — one app, one personality, two pronouns.
 */
export const ZoneVoiceOverrideSchema = Schema.Struct({
  /** Replaces `design.voice.pronoun` for routes this zone governs. */
  pronoun: Schema.optional(VoicePronounSchema),

  /** Replaces `design.voice.prefer` for routes this zone governs. */
  prefer: Schema.optional(
    Schema.Array(zoneGuidanceLine('A zone `prefer` line')).annotate({
      title: 'Zone Preferred Patterns',
      description: 'Copy patterns to reach for in this zone, replacing `design.voice.prefer`',
      examples: [['Lead with the outcome, not the mechanism.']],
    })
  ),

  /** Replaces `design.voice.avoid` for routes this zone governs. */
  avoid: Schema.optional(
    Schema.Array(zoneGuidanceLine('A zone `avoid` line')).annotate({
      title: 'Zone Refused Patterns',
      description: 'Copy patterns to refuse in this zone, replacing `design.voice.avoid`',
      examples: [['No marketing superlatives behind auth.']],
    })
  ),

  /** Replaces `design.voice.tone` for routes this zone governs. */
  tone: Schema.optional(VoiceToneSchema),
}).pipe(
  Schema.annotate({
    identifier: 'ZoneVoiceOverride',
    title: 'Zone Voice Override',
    description:
      'How this zone departs from `design.voice`. Per-FIELD: a declared field replaces the same field of `design.voice` for routes this zone governs; an undeclared field inherits. `personality` is not overridable — it is app identity, not situational register.',
    examples: [{ pronoun: 'vous', avoid: ['No marketing superlatives behind auth.'] }],
  })
)

/**
 * One zone: a route pattern, the zone it belongs to, and what that zone is
 * allowed to spend and say.
 */
export const DesignZoneSchema = Schema.Struct({
  /**
   * The route pattern this entry governs, written as DECLARED rather than as
   * served — `/docs/*`, not `/{lang}/docs/*`. Page configs declare
   * locale-agnostic paths and the engine prefixes the active locale, so writing
   * the served form makes a zone impossible to check against a `path:` value
   * without translating every row by hand.
   *
   * The literal phrase `everything else` is the catch-all, matched
   * case-insensitively and ranked last.
   */
  pattern: Schema.String.pipe(
    Schema.check(Schema.isMinLength(1, { message: 'A zone pattern must not be empty' })),
    Schema.annotate({
      title: 'Route Pattern',
      description:
        "The declared route pattern this zone governs (e.g. '/docs/*'), or the literal catch-all 'everything else'.",
      examples: ['/docs/*', '/admin/*', 'everything else'],
    })
  ),

  /**
   * The zone name. Free-form, because the zone vocabulary is the app's own:
   * `marketing` / `documentation` / `gallery` for a public site, `product` for
   * everything behind auth, and an app nobody has written yet will need a name
   * nobody has enumerated.
   */
  zone: Schema.String.pipe(
    Schema.check(Schema.isMinLength(1, { message: 'A zone name must not be empty' })),
    Schema.annotate({
      title: 'Zone Name',
      description:
        "The zone this pattern belongs to (e.g. 'marketing', 'documentation', 'product').",
      examples: ['marketing', 'documentation', 'product'],
    })
  ),

  /** Which accent budget this zone carries. See {@link AccentBudgetSchema}. */
  accentBudget: Schema.optional(AccentBudgetSchema),

  /** How this zone's voice departs from `design.voice`. Per-field override. */
  voice: Schema.optional(ZoneVoiceOverrideSchema),
}).pipe(
  Schema.annotate({
    identifier: 'DesignZone',
    title: 'Design Zone',
    description:
      'One route pattern, the zone it belongs to, the accent budget that zone carries, and how its voice departs from the app default.',
    examples: [
      { pattern: '/docs/*', zone: 'documentation', accentBudget: 'product' },
      { pattern: 'everything else', zone: 'marketing', accentBudget: 'public' },
    ],
  })
)

/**
 * The app's zone map — which surface is which, and what each is allowed to
 * spend and say.
 *
 * ## Why this is a config key and not prose
 *
 * Every Sovrium app that has more than one register has a zone map, and THIS
 * key is it. An unskippable drift check
 * evaluates the entries below to enforce three things — that every declared
 * route belongs to a zone, that every zone still governs a live route, and that
 * a zone carrying the public accent budget never governs a gated one.
 *
 * The map lived in prose first: a `**Zones**:` line in each app's `BRAND.md`,
 * which the same check parsed out of Markdown. Parsing a sentence to hold an
 * access-adjacent invariant is the weakest possible foundation for it, and the
 * line describes the APP — so it belongs here, typed, decoded, and readable by
 * the running instance rather than only by a script that reads the repository.
 * That line now reads `**Zones**: see `config/design.ts``, a POINTER the brand
 * identity check refuses unless the path it names resolves on disk. A pointer
 * cannot drift from the map, which is the whole reason it is one.
 *
 * ## Two semantics the gate reads off these entries
 *
 * `zone: 'none'` is a RESERVED WORD meaning "belongs to no zone". A route it
 * governs counts as COVERED — the coverage assertion does not flag it — and the
 * zone carries no budget and no voice, so the budget lock never applies to it.
 * It is how an app declares that `/404` is a real route with no zone posture,
 * rather than a route someone forgot to place.
 *
 * The budget fallback is FAIL-CLOSED. `accentBudget` is authoritative when
 * declared; when OMITTED, a zone whose name is in
 * {@link PUBLIC_BUDGET_ZONE_NAMES} still carries the public budget and stays
 * locked. The field is `Schema.optional`, so silent opt-out is the type
 * system's default — and a config that could leave an unskippable gate by
 * deleting one optional field would take the gate's green with it.
 *
 * ## Order is significance
 *
 * Entries rank most-specific-first when a route matches more than one: an exact
 * path beats a prefix wildcard, which beats `everything else`. Declaration
 * order does not decide the winner — specificity does — which is why duplicate
 * patterns are refused rather than resolved by position (see
 * `design-validation.ts`, rule 3): a duplicate makes the winner arbitrary.
 *
 * ## Optional in the schema, not optional in practice
 *
 * `Schema.optional` means a config that omits this key still decodes, and
 * nothing about the key ALONE makes that a finding — a schema cannot know
 * whether the app has routes to place.
 *
 * The gate can, and does. An app that declares routes and no readable
 * `design.zones` is reported as `zones-unreadable`, naming how many routes went
 * unchecked, exactly as an unreadable `**Zones**:` line was. That is what keeps
 * the whole gate from being opt-out: deleting this key would otherwise be the
 * cheapest way to make coverage, liveness and the budget lock all vacuous at
 * once.
 */
export const DesignZonesSchema = Schema.Array(DesignZoneSchema).annotate({
  identifier: 'DesignZones',
  title: 'Design Zones',
  description:
    "The app's zone map: which route patterns belong to which zone, what accent budget each zone carries, and how each zone's voice departs from `design.voice`.",
  examples: [
    [
      { pattern: '/admin/*', zone: 'product', accentBudget: 'product' },
      { pattern: 'everything else', zone: 'marketing', accentBudget: 'public' },
    ],
  ],
})

/** @public */
export type AccentBudget = Schema.Schema.Type<typeof AccentBudgetSchema>
/** @public */
export type ZoneVoiceOverride = Schema.Schema.Type<typeof ZoneVoiceOverrideSchema>
/** @public */
export type DesignZone = Schema.Schema.Type<typeof DesignZoneSchema>
/** @public */
export type DesignZones = Schema.Schema.Type<typeof DesignZonesSchema>
