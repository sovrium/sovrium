/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { ColorValueSchema } from './colors'

/**
 * Colour RAMPS — ordered lightness ladders, and the values roles point at.
 *
 * ## The gap this closes
 *
 * `theme.colors` is an open `Record<name, value>` with no ordering and no
 * grouping, so `neutral-50 … neutral-950` can be WRITTEN into it and nothing
 * about the result is a ramp: no consumer knows the eleven entries belong
 * together, that they are ordered, or that `neutral-200` is a position another
 * token may refer to. That matters now rather than in the abstract — Sovrium's
 * own default palette is 78 ramp declarations plus 40 role tokens expressed as
 * `var()` chains INTO those ramps, and `DesignSchema` could hold 33 of the 306
 * declarations that make up the default.
 *
 * ## Why a new key rather than widening `theme.colors`
 *
 * Two reasons, and the second is the decisive one.
 *
 * A ramp emits differently. `theme.colors` keys become author colour tokens
 * (`--color-<name>`, reachable as `text-<name>`); a ramp step is a `--sv-*`
 * declaration that ROLES resolve against. Overloading one key with two
 * emissions would leave an author unable to tell which they had written.
 *
 * And a ramp can be ENUMERATED where a palette cannot. The step set is closed,
 * so a typo'd `neutral-250` is reported by name instead of vanishing — the
 * measured Effect v4 `Schema.Record` key-drop, avoided the same way
 * `TypeScaleSchema` avoids it.
 *
 * ## Why a direct key of `design`
 *
 * This was written when the token block was still a nested key carrying a
 * removal date, and anything added inside it was born carrying that date too.
 * The block is gone and every token family is a direct key now, so the reason
 * has outlived the hazard — but the shape it argued for is the shape that
 * shipped, and `typeScale` and `density` sit beside it for the same reason.
 */

/**
 * The eleven ramp positions, in lightness order.
 *
 * Closed, and taken from the default palette's own ladder. A position is a
 * NAME that roles refer to (`neutral-200`), not a Tailwind utility suffix, so
 * an invented `250` would resolve nowhere — which is exactly why closing the
 * set costs nothing and buys a named error.
 */
export const RAMP_STEPS = [
  '50',
  '100',
  '200',
  '300',
  '400',
  '500',
  '600',
  '700',
  '800',
  '900',
  '950',
] as const

/** One ramp position. @public */
export type RampStep = (typeof RAMP_STEPS)[number]

const RAMP_STEP_ALTERNATION = RAMP_STEPS.join('|')

/**
 * A reference to another ramp's step — `neutral-200`.
 *
 * This is the shape that replaces a `var(--sv-neutral-200)` chain. The default
 * palette is full of them: every semantic ramp but `error` is declared as an
 * alias of the neutral ladder, and every role token is a chain into one. The
 * chains stay real in the emitted CSS — they are DERIVED from these references
 * by the generator, never authored — but the config says what it means, and a
 * reader that has to resolve it (the contrast checker, the DTCG export) can.
 *
 * Unambiguous against a literal by construction: `ColorValueSchema` requires a
 * `#`, `rgb(`, `hsl(` or `oklch(` prefix, none of which a reference can carry.
 */
const RAMP_REF_SHAPE = new RegExp(`^[a-z][a-z0-9]*(?:-[a-z0-9]+)*-(?:${RAMP_STEP_ALTERNATION})$`)

export const RampStepRefSchema = Schema.String.pipe(
  // A `makeFilter` rather than `isPattern`, so the message can QUOTE the value
  // back. This schema sits inside a union with `ColorValueSchema`, and a union
  // failure reports the config PATH and each branch's message — without the
  // value in the text, an author reading `["design"]["colorRoles"]["bg"]["value"]`
  // is told where to look and not what was wrong with what they wrote.
  Schema.check(
    Schema.makeFilter(
      (value: string) =>
        RAMP_REF_SHAPE.test(value) ||
        `'${value}' is not a ramp reference. A reference names a ramp and one of its steps, as \`<ramp>-<step>\` (e.g. \`neutral-200\`). Steps: ${RAMP_STEPS.join(', ')}.`
    )
  ),
  Schema.annotate({
    title: 'Ramp Step Reference',
    description: 'A reference to one step of a declared ramp, as `<ramp>-<step>`',
    examples: ['neutral-200', 'error-500'],
  })
)

/**
 * A ramp step's value: a colour LITERAL, or a reference to another ramp's step.
 *
 * The literal comes first in the union so a malformed colour reports as a
 * colour rather than as a malformed reference — the two error messages send an
 * author to different fixes, and the colour one is far more often right.
 */
export const RampValueSchema = Schema.Union([ColorValueSchema, RampStepRefSchema]).pipe(
  Schema.annotate({
    title: 'Ramp Value',
    description: 'A colour literal, or a reference to another ramp step',
    examples: ['oklch(0.985 0 0)', 'neutral-200'],
  })
)

/**
 * One ramp: up to eleven steps, every one optional.
 *
 * Optional because the default palette's own ramps are SUBSETS — `error`
 * declares seven of the eleven, `neutral` all of them. Requiring a full ladder
 * would refuse the very palette this key exists to hold.
 */
export const RampSchema = Schema.Struct(
  Object.fromEntries(RAMP_STEPS.map((step) => [step, Schema.optional(RampValueSchema)])) as Record<
    RampStep,
    Schema.optional<typeof RampValueSchema>
  >
).pipe(
  Schema.annotate({
    identifier: 'Ramp',
    title: 'Colour Ramp',
    description: 'One ordered lightness ladder, keyed by step',
    examples: [{ '50': 'oklch(0.985 0 0)', '500': 'oklch(0.56 0 0)', '950': 'oklch(0.14 0 0)' }],
  })
)

/** A ramp name: kebab-case, no trailing step number to be confused with a reference. */
const RAMP_NAME_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z]+)*$/

/**
 * The declared ramps, keyed by name.
 *
 * The KEY is a plain `Schema.String` — a ramp name is the author's own
 * (`neutral`, `error`, `brand`) and cannot be enumerated, so the shape is
 * checked at the RECORD level where a bad key survives to be named. A key
 * schema would have deleted it silently, which is the failure this whole
 * family of decisions is arranged around.
 */
export const DesignRampsSchema = Schema.Record(
  Schema.String.annotate({
    title: 'Ramp Name',
    description: 'Name of one colour ramp, kebab-case and carrying no step suffix',
    examples: ['neutral', 'error', 'brand'],
  }),
  RampSchema
).pipe(
  // ANNOTATE BEFORE CHECK. A trailing `annotate` after a `check` lands on the
  // CHECK rather than on the node, and the emitted JSON Schema loses its
  // `title` and `description` — measured on the published snapshot, where this
  // came out as a bare `{type, additionalProperties}`. Same ordering trap
  // recorded at `pages/index.ts:55-57`.
  //
  // The trade is real and taken deliberately: with the check last, the
  // `identifier` moves onto it too, so this schema is INLINED at its one
  // reference rather than minted as a `$defs/DesignRamps`. Losing a `$def`
  // that is referenced exactly once costs nothing a reader can see; losing the
  // title and description costs every reader of the published schema.
  Schema.annotate({
    identifier: 'DesignRamps',
    title: 'Colour Ramps',
    description:
      "The app's colour ramps: ordered lightness ladders whose steps roles refer to by name. Distinct from `theme.colors`, which is an unordered palette of author tokens.",
    examples: [
      {
        neutral: { '50': 'oklch(0.985 0 0)', '950': 'oklch(0.14 0 0)' },
        info: { '50': 'neutral-50', '500': 'neutral-500' },
      },
    ],
  }),
  Schema.check(
    Schema.makeFilter((ramps: Readonly<Record<string, unknown>>) => {
      const offender = Object.keys(ramps).find((name) => !RAMP_NAME_PATTERN.test(name))
      if (offender === undefined) return true
      return `\`design.ramps\` declares the ramp '${offender}', which is not a usable ramp name. A ramp name is kebab-case and carries no step suffix — the suffix is what a reference adds (\`${offender}-500\`), so a name ending in one could not be referred to unambiguously.`
    })
  )
)

/** @public */
export type Ramp = Schema.Schema.Type<typeof RampSchema>
/** @public */
export type DesignRamps = Schema.Schema.Type<typeof DesignRampsSchema>
