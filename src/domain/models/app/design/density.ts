/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Density — how tightly a surface packs its rows, controls and text.
 *
 * ## Why this exists
 *
 * Density is the one design dimension Sovrium already HAD and could not
 * express. Ten recipe sites hard-code it as arbitrary values — `py-[5px]` in
 * the display and data recipes, `text-[11px]` across six cell-affordance
 * sites, `px-[7px]` in the navbar — so a data table is dense because somebody
 * typed `5px`, and the only way to change it is to edit `src/`.
 *
 * Those literals become `py-(--sv-density-row-y)` and friends, reading CSS
 * custom properties this key emits. That is what makes density a config
 * decision rather than a fork.
 *
 * ## Why three named steps and not a number
 *
 * `density: 0.8` is a scale factor, and a scale factor cannot say that a row
 * gets tighter faster than its text does — which is exactly what a real
 * density ladder does. Three named steps, each declaring all five dimensions
 * independently, keep that relationship in the author's hands.
 *
 * The names are the ones the surrounding industry already uses (Material's
 * comfortable/cozy/compact, Airtable's row heights), so a step name is
 * something a reader recognises rather than a coordinate they must decode.
 *
 * ## Why a closed Struct for `steps`, and an open Record for `byZone`
 *
 * The step SET is enumerable, so it is a `Schema.Struct`: a typo'd `cosy` hits
 * `onExcessProperty: 'error'` and is reported BY NAME. That deliberately
 * avoids the measured Effect v4 trap that `Schema.Record` **silently DROPS**
 * an entry whose KEY fails the key schema — no error under any option — which
 * is why `design.colorRoles` and `design.components` need a second validation
 * pass.
 *
 * `byZone` keys cannot be enumerated: they are the author's own zone names.
 * So it is a `Schema.Record` with a plain `Schema.String` key, for exactly the
 * reason `DesignComponentsSchema` documents, and the key is cross-validated
 * against `design.zones[].zone` in `design-validation.ts` — a check strictly
 * stronger than any pattern, since it requires the name to RESOLVE. The VALUE
 * is a `Schema.Literals`, and value failures do still throw, so a `byZone`
 * entry naming a step that does not exist is refused normally.
 *
 * ## Why `floors` can be declared but never changed
 *
 * `floors` is a **publication echo, not a control**. Both members are pinned
 * to a single `Schema.Literal`, so declaring one restates the constant and
 * lowering one is a decode error — the guarantee is inexpressible to break
 * rather than merely discouraged.
 *
 * That is a deliberate, and slightly unusual, choice. The alternative — leave
 * the floors entirely in `src/` — was rejected because these two numbers are
 * accessibility commitments (WCAG 2.2 § 2.5.8 target size) that an author
 * tuning `steps.compact` down needs to SEE, and a floor visible only in the
 * renderer's source is invisible in `sovrium schema`, in the published JSON
 * Schema, and in the design-system export. The opposite alternative — a plain
 * `Schema.Number` — was rejected because it makes the floor author-lowerable,
 * which is not a floor.
 *
 * The consequence, stated plainly so nobody wires it by mistake: **no consumer
 * reads `design.density.floors`.** Omission and declaration are identical, so
 * every renderer reads {@link DENSITY_FLOORS} instead.
 */

/**
 * A density dimension DTCG can carry: a number with `px` or `rem`.
 *
 * Reused verbatim from `type-scale.ts` rather than imported, for the same
 * reason it is spelled out there: these are the two units DTCG's `dimension`
 * type permits, so every value here serialises faithfully into the
 * design-system export. A percentage or a `clamp()` would not, and a density
 * step is a fixed, quotable number by nature.
 */
const DIMENSION_PATTERN = /^-?(?:\d+\.?\d*|\.\d+)(?:px|rem)$/

const dimension = (title: string, description: string, examples: readonly string[]) =>
  Schema.String.pipe(
    Schema.check(
      Schema.isPattern(DIMENSION_PATTERN, {
        message: `A density \`${title}\` must be a number followed by \`px\` or \`rem\` (e.g. \`5px\`, \`0.5rem\`). Relative and fluid values are not a density step — a step is a fixed, quotable number.`,
      })
    ),
    Schema.annotate({ title, description, examples: [...examples] })
  )

/**
 * One step of the density ladder.
 *
 * All five members are required. A step declaring only `rowY` is not a
 * density: the whole point of naming a step is that a surface can switch to it
 * and get a coherent set, and a half-declared step would silently inherit the
 * other four from whichever step happened to be active.
 *
 * ## Why a field height and a button height are two numbers
 *
 * They were one — `controlH`, at 28px — and that conflation made the field
 * height unadjustable. A text field and a small button are both "inline
 * controls" only in the sense that they sit on a line. A field is a place to
 * TYPE: it wants room for a cursor, a descender and a comfortable click
 * target. A small button is a label with a box drawn round it, and wants to
 * disappear into a toolbar. Under one key, no step could move either without
 * moving both, so every attempt to give fields room bloated the toolbars.
 *
 * The ladder therefore carries both, and both ascend across it — fields
 * 36 / 40 / 44, buttons 28 / 32 / 36, the 8px separation the reference
 * drawings put between them. `roomy`'s field lands exactly on the 44px WCAG
 * 2.2 § 2.5.8 enhanced target published as {@link DENSITY_FLOORS}`.hit`,
 * which is what a loose step is for.
 *
 * Both stay REQUIRED for the reason the paragraph above gives: a step
 * declaring a button height and no field height would draw its fields at
 * whichever step was previously active, and the incoherence would be silent.
 */
export const DensityStepSchema = Schema.Struct({
  /** Vertical padding inside a table row or list item. Emits `--sv-density-row-y`. */
  rowY: dimension('rowY', 'Vertical padding inside a row or list item', ['5px', '0.5rem']),

  /** Height of a text-entry control — an input, a select, a picker trigger. Emits `--sv-density-control-h`. */
  controlH: dimension('controlH', 'Height of a text-entry control', ['36px', '2.25rem']),

  /** Height of a small button — a toolbar action, a chip affordance. Emits `--sv-density-button-h`. */
  buttonH: dimension('buttonH', 'Height of a small button', ['28px', '1.75rem']),

  /** Horizontal gap between adjacent affordances. Emits `--sv-density-gap`. */
  gap: dimension('gap', 'Horizontal gap between adjacent affordances', ['7px', '0.75rem']),

  /** Font size of dense secondary text — cell affordances, nav chrome. Emits `--sv-density-text`. */
  text: dimension('text', 'Font size of dense secondary text', ['11px', '0.8125rem']),
}).pipe(
  Schema.annotate({
    identifier: 'DensityStep',
    title: 'Density Step',
    description:
      'One step of the density ladder: row padding, field height, small-button height, affordance gap and dense text size',
    examples: [{ rowY: '5px', controlH: '36px', buttonH: '28px', gap: '7px', text: '11px' }],
  })
)

/**
 * The three steps, in canonical order: tightest first.
 *
 * The order is the reason this is a Struct and not a Record — a surface
 * rendering the ladder (the design-system console does) reads it from here
 * rather than inventing a sort.
 */
export const DensityStepsSchema = Schema.Struct({
  /** Tightest. Data-dense tables, admin chrome. */
  compact: DensityStepSchema,
  /** The default. Ordinary application surfaces. */
  cozy: DensityStepSchema,
  /** Loosest. Marketing and reading surfaces. */
  roomy: DensityStepSchema,
}).pipe(
  Schema.annotate({
    identifier: 'DensitySteps',
    title: 'Density Steps',
    description: 'The three named density steps, tightest first',
  })
)

/** The step names in canonical ladder order. Derived from the Struct so it cannot drift. */
export const DENSITY_STEPS = Object.keys(DensityStepsSchema.fields) as readonly DensityStepName[]

/**
 * Which step a zone runs at.
 *
 * `Schema.Literals` rather than a free string: this is the one place a typo is
 * caught at decode time, because the VALUE side of a `Schema.Record` does
 * throw on failure even though the key side silently drops.
 */
export const DensityStepNameSchema = Schema.Literals(['compact', 'cozy', 'roomy']).pipe(
  Schema.annotate({
    identifier: 'DensityStepName',
    title: 'Density Step Name',
    description: 'One of the three declared density steps',
    examples: ['compact', 'cozy', 'roomy'],
  })
)

/**
 * The accessibility floors, as constants.
 *
 * **This is what every consumer reads.** `design.density.floors` is a
 * publication echo whose only legal values are these — see the module doc.
 *
 * - `controlH: 24` — the smallest an inline control may render, in px.
 * - `hit: 44` — the smallest interactive hit target, in px (WCAG 2.2 § 2.5.8
 *   sets 24 as the minimum and 44 as the enhanced target; Sovrium ships the
 *   enhanced one, because a floor that matches the bare minimum leaves no
 *   margin for a theme that tightens it).
 */
export const DENSITY_FLOORS = { controlH: 24, hit: 44 } as const

/**
 * The floors, declarable and unchangeable. See the module doc for why both
 * members are pinned literals and why nothing reads this field.
 */
export const DensityFloorsSchema = Schema.Struct({
  /** Minimum inline-control height. The only legal value is 24. */
  controlH: Schema.optional(
    Schema.Literal(DENSITY_FLOORS.controlH).pipe(
      Schema.annotate({
        title: 'Control Height Floor',
        description:
          'Minimum inline-control height in px. Fixed at 24 — declaring it restates the guarantee, and no other value decodes.',
      })
    )
  ),

  /** Minimum interactive hit target. The only legal value is 44. */
  hit: Schema.optional(
    Schema.Literal(DENSITY_FLOORS.hit).pipe(
      Schema.annotate({
        title: 'Hit Target Floor',
        description:
          'Minimum interactive hit-target size in px. Fixed at 44 — declaring it restates the guarantee, and no other value decodes.',
      })
    )
  ),
}).pipe(
  Schema.annotate({
    identifier: 'DensityFloors',
    title: 'Density Floors',
    description:
      'The accessibility floors a density step may never cross. Both values are fixed; the field exists so the guarantee is visible in the config document, not so it can be tuned.',
    examples: [{ controlH: 24, hit: 44 }],
  })
)

/**
 * The density ladder, the per-zone assignment, and the floors.
 */
export const DensitySchema = Schema.Struct({
  /** The three steps. Required — a density with no ladder declares nothing. */
  steps: DensityStepsSchema,

  /**
   * Which step each zone runs at. Keys must name a `design.zones[].zone`,
   * cross-validated at decode time in `design-validation.ts`.
   *
   * Optional: an app declaring a ladder and no assignment has said what its
   * steps ARE, which is useful on its own — the design-system export publishes
   * them and a recipe can reference the tokens directly.
   */
  byZone: Schema.optional(
    Schema.Record(
      Schema.String.annotate({
        title: 'Zone Name',
        description:
          'Name of a zone declared in `design.zones[]`. Validated against the declared zones at decode time.',
        examples: ['product', 'marketing'],
      }),
      DensityStepNameSchema
    ).pipe(
      Schema.annotate({
        title: 'Density By Zone',
        description: 'Which density step each declared zone runs at',
        examples: [{ product: 'compact', marketing: 'roomy' }],
      })
    )
  ),

  /** The accessibility floors. Declarable, unchangeable, and read by nothing. */
  floors: Schema.optional(DensityFloorsSchema),
}).pipe(
  Schema.annotate({
    identifier: 'Density',
    title: 'Density',
    description:
      "The app's density ladder: three named steps declaring row padding, field height, small-button height, affordance gap and dense text size, optionally assigned per zone. Each step emits `--sv-density-row-y` / `-control-h` / `-button-h` / `-gap` / `-text`, which is what replaces the ten hard-coded `py-[5px]` / `text-[11px]` / `px-[7px]` literals in the recipes.",
    examples: [
      {
        steps: {
          compact: { rowY: '5px', controlH: '36px', buttonH: '28px', gap: '7px', text: '11px' },
          cozy: { rowY: '8px', controlH: '40px', buttonH: '32px', gap: '10px', text: '0.8125rem' },
          roomy: { rowY: '12px', controlH: '44px', buttonH: '36px', gap: '14px', text: '0.875rem' },
        },
        byZone: { product: 'compact', marketing: 'roomy' },
      },
    ],
  })
)

/** @public */
export type DensityStep = Schema.Schema.Type<typeof DensityStepSchema>
/** @public */
export type DensitySteps = Schema.Schema.Type<typeof DensityStepsSchema>
/** @public */
export type DensityStepName = keyof DensitySteps
/** @public */
export type DensityFloors = Schema.Schema.Type<typeof DensityFloorsSchema>
/** @public */
export type Density = Schema.Schema.Type<typeof DensitySchema>
