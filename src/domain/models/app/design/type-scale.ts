/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { FontsConfigSchema, FontWeightSchema } from './fonts'

/**
 * The app's type scale — the ordered ladder of named text roles, and the ONE
 * typography surface in the schema that reaches CSS.
 *
 * ## Why this exists, and what it replaces
 *
 * A brand charter's type section is a ladder: display, then the heading levels,
 * then body, then the small print — each step a bound triple of size, leading
 * and weight. `families` is keyed by FACE (`body`, `title`, `mono`) and carries
 * at most ONE size per face, so the question a charter answers — "how big is an
 * h2, and what leading does it take?" — is not expressible there at all.
 *
 * Worse, the three face fields that LOOK like they answer it are inert
 *, and `steps` is their replacement:
 *
 * - **a face's `size`** becomes no CSS variable.
 * - **a face's `lineHeight`** reaches nothing whatsoever.
 * - **a face's `weights`** loads no `@font-face`, so the extra entries render
 *   as synthetic bolding or not at all.
 *
 * `steps` emits real CSS custom properties for every declared rung (see
 * `generateThemeTypeScale`), which is what makes it a supersession rather than
 * a fourth spelling of the same silence.
 *
 * ## Why a Struct with named steps, and NOT a Record
 *
 * This is the deliberate avoidance of a measured Effect v4 trap. `Schema.Record`
 * **silently DROPS** an entry whose KEY fails the key schema — no error under
 * any option, including `onExcessProperty: 'error'` and `errors: 'all'` (value
 * failures still throw; only key failures vanish). `design.colorRoles` has to
 * work around that with a second validation pass, because its keys are the
 * author's own colour names and cannot be enumerated.
 *
 * A type scale CAN be enumerated, so it is a `Schema.Struct`: a typo'd `h7`
 * hits `onExcessProperty: 'error'` at the decode boundary and is reported BY
 * NAME, with no second pass and nothing to keep in sync. The trap is not worked
 * around here; it is made inexpressible.
 *
 * ## Why the step set is closed
 *
 * An open record is what `design.colors` is, and `design.colorRoles` exists
 * precisely because an open record carries no semantics. Two things a closed
 * set buys that an open one cannot:
 *
 * - **Order.** A charter's type scale is a LADDER, rendered largest-first. An
 *   open record has no order, so a surface rendering it would have to invent
 *   one — and would invent a different one than the next surface.
 * - **A known vocabulary.** `h1`–`h6` are the elements the `text` component
 *   already emits (`element: 'h2'`), so a step name is something a renderer can
 *   bind to rather than a string it must guess at.
 *
 * ## Why the units are what they are
 *
 * Each constraint below tracks the W3C DTCG type it serialises to, because the
 * design-system export publishes these as a `typography` composite token and a
 * value the export cannot carry faithfully is a value the charter cannot
 * publish. That is a deliberate tightening relative to a free CSS string, whose
 * unrestricted values are the reason an `unmappable` bucket had to exist at
 * all. Repeating that in a new field, on purpose, with the chance to close it,
 * would be the wrong trade.
 *
 * @see https://www.designtokens.org/tr/drafts/format/ (§ Typography composite type)
 */

/**
 * A font size or tracking value DTCG can carry: a number with `px` or `rem`.
 *
 * DTCG's `dimension` type permits exactly these two units. A fluid
 * `clamp(1rem, 2vw, 3rem)` is deliberately refused rather than routed to the
 * `unmappable` bucket: fluid type is a layout technique best expressed as a
 * utility class on the element that needs it, whereas a type SCALE is a ladder
 * of fixed, quotable steps — "our h1 is 3rem" is the kind of sentence a charter
 * exists to make true.
 */
const DIMENSION_PATTERN = /^-?(?:\d+\.?\d*|\.\d+)(?:px|rem)$/

/**
 * Tracking additionally permits `em`, which DTCG does NOT.
 *
 * `-0.02em` is the idiomatic tracking value in essentially every type scale
 * ever written, and refusing it to satisfy a serialization format would be the
 * format dictating the design. It is accepted here, emitted to CSS verbatim,
 * and reported at its exact config path in the export's `unmappable` bucket —
 * so the author sees that Sovrium honoured it in the browser and could not
 * carry it in the token document, which is the truth.
 */
const TRACKING_PATTERN = /^-?(?:\d+\.?\d*|\.\d+)(?:px|rem|em)$/

/**
 * One step of the type scale.
 *
 * `size` is the only required member: a step declaring nothing but a size is a
 * real and common state (the leading and weight inherit), whereas a step
 * declaring leading and no size names no size at all and cannot render.
 */
export const TypeScaleStepSchema = Schema.Struct({
  /**
   * The rendered font size. `'3rem'`, `'14px'`.
   *
   * Required, and restricted to the two units DTCG's `dimension` type permits.
   */
  size: Schema.String.pipe(
    Schema.check(
      Schema.isPattern(DIMENSION_PATTERN, {
        message:
          'A type-scale `size` must be a number followed by `px` or `rem` (e.g. `3rem`, `14px`). Fluid values such as `clamp(…)` are not a scale step — apply them as a utility class on the element that needs them.',
      })
    ),
    Schema.annotate({
      title: 'Font Size',
      description: 'Rendered size of this step, in `px` or `rem`',
      examples: ['3rem', '1.125rem', '14px'],
    })
  ),

  /**
   * Leading, as a UNITLESS RATIO — `1.2`, not `'1.2'` and not `'48px'`.
   *
   * DTCG types `lineHeight` as a `number`, not a `dimension`, and that matches
   * the better practice independently: a ratio survives a size change, whereas
   * a fixed `48px` leading silently becomes wrong the moment the step is
   * retuned. This is the one member whose type differs from its inert
   * predecessor on the FACE, which was a free string.
   */
  lineHeight: Schema.optional(
    Schema.Finite.pipe(
      Schema.check(
        Schema.isGreaterThan(0, { message: 'A type-scale `lineHeight` must be greater than 0' })
      ),
      Schema.annotate({
        title: 'Line Height',
        description: 'Leading as a unitless ratio of the font size',
        examples: [1.1, 1.5],
      })
    )
  ),

  /**
   * Weight, reusing the faces' own 100–900 ladder rather than restating it.
   *
   * A hand-copied duplicate of that literal set would be a second definition to
   * keep in sync, which is the exact drift the whole `design` key exists to
   * remove. DTCG permits 1–1000; 100–900 is a subset, so every value here
   * serialises faithfully.
   */
  weight: Schema.optional(
    FontWeightSchema.pipe(
      Schema.annotate({
        title: 'Font Weight',
        description: 'Weight of this step (100–900)',
      })
    )
  ),

  /**
   * Tracking. `'-0.02em'`, `'0.08em'`, `'0.5px'`.
   *
   * See {@link TRACKING_PATTERN} for why `em` is permitted here and nowhere
   * else in this module.
   */
  letterSpacing: Schema.optional(
    Schema.String.pipe(
      Schema.check(
        Schema.isPattern(TRACKING_PATTERN, {
          message:
            'A type-scale `letterSpacing` must be a number followed by `px`, `rem` or `em` (e.g. `-0.02em`).',
        })
      ),
      Schema.annotate({
        title: 'Letter Spacing',
        description: 'Tracking for this step',
        examples: ['-0.02em', '0.08em'],
      })
    )
  ),

  /**
   * Which declared font FACE this step is set in — a key of
   * `design.typeScale.families`, not a family name.
   *
   * A NAME rather than a value, for the same reason `colorRoles.pairsWith` is:
   * the binding is what carries the intent. A step reading `font: 'title'`
   * follows the title face wherever the author retunes it, whereas an inlined
   * `'Inter'` is a copy that goes stale silently.
   *
   * Cross-validated against the declared faces at decode time — see
   * `design-validation.ts`. Unlike `pairsWith`, a strict check is right here:
   * there is no platform-inherited font category to accommodate, so an
   * unresolvable name is always a typo.
   */
  font: Schema.optional(
    Schema.String.pipe(
      Schema.check(
        Schema.isMinLength(1, { message: 'A type-scale `font` must name a declared font category' })
      ),
      Schema.annotate({
        title: 'Font Category',
        description: 'Name of a face declared in `design.typeScale.families`',
        examples: ['title', 'body'],
      })
    )
  ),
}).pipe(
  Schema.annotate({
    identifier: 'TypeScaleStep',
    title: 'Type Scale Step',
    description:
      'One named step of the type scale: its size, and optionally its leading, weight, tracking and face',
    examples: [
      { size: '3rem', lineHeight: 1.1, weight: 700, letterSpacing: '-0.02em', font: 'title' },
    ],
  })
)

/** The twelve named rungs, in canonical order. Extracted so both shapes share one definition. */
const TYPE_SCALE_STEP_FIELDS = {
  /** The one-off page-opening size, above `h1`. */
  display: Schema.optional(TypeScaleStepSchema),
  /** Page title. One per page. */
  h1: Schema.optional(TypeScaleStepSchema),
  /** Section heading. */
  h2: Schema.optional(TypeScaleStepSchema),
  /** Sub-section heading. */
  h3: Schema.optional(TypeScaleStepSchema),
  /** Fourth-level heading. */
  h4: Schema.optional(TypeScaleStepSchema),
  /** Fifth-level heading. */
  h5: Schema.optional(TypeScaleStepSchema),
  /** Sixth-level heading. */
  h6: Schema.optional(TypeScaleStepSchema),
  /** The standfirst paragraph that opens a page, set larger than body. */
  lead: Schema.optional(TypeScaleStepSchema),
  /** Running text. The step every other one is measured against. */
  body: Schema.optional(TypeScaleStepSchema),
  /** Secondary running text: help text, dense tables. */
  bodySmall: Schema.optional(TypeScaleStepSchema),
  /** Labels, timestamps, footnotes. */
  caption: Schema.optional(TypeScaleStepSchema),
  /** The small tracked-out eyebrow above a heading. */
  overline: Schema.optional(TypeScaleStepSchema),
} as const

/**
 * The type ladder: an ordered set of named text roles.
 *
 * Every step is optional — an app declaring only `h1` and `body` has a real,
 * if short, scale, and requiring the full ladder would make the key unusable
 * for the incremental adoption it is meant to invite.
 *
 * The declaration ORDER above is the canonical rendering order, largest to
 * smallest. It is the reason this is a Struct and not a Record: a surface
 * rendering the ladder reads it from here rather than inventing a sort.
 */
export const TypeScaleStepsSchema = Schema.Struct(TYPE_SCALE_STEP_FIELDS).pipe(
  Schema.annotate({
    identifier: 'TypeScaleSteps',
    title: 'Type Scale Steps',
    description:
      "The app's ordered type ladder. Each declared step emits CSS custom properties (`--text-{step}` and its `--line-height` / `--font-weight` / `--letter-spacing` modifiers).",
    examples: [
      {
        h1: { size: '3rem', lineHeight: 1.1, weight: 700, letterSpacing: '-0.02em' },
        body: { size: '1rem', lineHeight: 1.6 },
      },
    ],
  })
)

/**
 * The TYPE foundation: the faces the app is set in, and the ladder of steps.
 *
 * ## Why the key grew two members
 *
 * Typography used to be declared in three places: one key held the FACES,
 * another held the STEPS, and a third held four loose ladders — `fontSizes`,
 * `fontWeights`, `lineHeights`, `letterSpacings` — of the same four quantities
 * a step already binds together. Choosing an h2 meant touching two keys and
 * hoping a third did not disagree.
 *
 * `typeScale` is now the one key for type: `families` names the faces,
 * `steps` binds size, leading, weight, tracking and face into each rung. A
 * charter's type section is exactly those two things and nothing else.
 *
 * ## There is exactly ONE position for a step
 *
 * A rung is declared at `typeScale.steps.<name>` and nowhere else. The flat
 * form the key once shipped — `typeScale: { h1: … }` — is gone; a config
 * still using it is refused by name, pointing at `steps`. A second position for
 * the same value has no way to stay in agreement with the first, and the whole
 * purpose of this key is that a type decision has one home.
 *
 * ## Why `families` re-mounts the faces record unchanged
 *
 * It inherits `size`, `lineHeight` and `weights` on each FACE, which [internal ref]
 * records as superseded: none of them reaches the CSS variable layer, and the
 * step is where those three quantities take effect. They are kept on the face
 * because a face legitimately carries its own metrics for a renderer that has
 * not been written yet, and deleting them in the same change-set that moves the
 * key would make one migration two.
 */
export const TypeScaleSchema = Schema.Struct({
  /**
   * The faces the app is set in, keyed by category (`title`, `body`, `mono`).
   *
   * A step's `font` member names a key of this record.
   */
  families: Schema.optional(FontsConfigSchema),

  /** The ordered ladder — the one position a rung is declared at. */
  steps: Schema.optional(TypeScaleStepsSchema),
}).pipe(
  Schema.annotate({
    identifier: 'TypeScale',
    title: 'Type Scale',
    description:
      "The app's type foundation: `families` (the faces) and `steps` (the ordered ladder).",
    examples: [
      {
        families: { title: { family: 'Inter' }, body: { family: 'Inter' } },
        steps: {
          h1: {
            size: '3rem',
            lineHeight: 1.1,
            weight: 700,
            letterSpacing: '-0.02em',
            font: 'title',
          },
          body: { size: '1rem', lineHeight: 1.6 },
          caption: { size: '0.8125rem', lineHeight: 1.4 },
        },
      },
    ],
  })
)

/**
 * The step names in canonical ladder order.
 *
 * Exported because three consumers need to iterate the scale in the same order
 * — the CSS generator, the DTCG projection and the markdown projection — and
 * three hand-written orderings would be three things to keep in sync. Derived
 * from the step Struct's own field order so it cannot drift from it, and
 * deliberately NOT from `TypeScaleSchema.fields`, which holds `families` and
 * `steps` rather than the rungs.
 */
export const TYPE_SCALE_STEPS = Object.keys(
  TypeScaleStepsSchema.fields
) as readonly TypeScaleStepName[]

/** @public */
export type TypeScaleStep = Schema.Schema.Type<typeof TypeScaleStepSchema>
/** @public */
export type TypeScaleSteps = Schema.Schema.Type<typeof TypeScaleStepsSchema>
/** @public */
export type TypeScale = Schema.Schema.Type<typeof TypeScaleSchema>
/** @public */
export type TypeScaleStepName = keyof TypeScaleSteps
