/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Usage guidance for ONE reusable component template.
 *
 * A top-level `components[]` entry carries a `name`, a `type`, props and
 * children — everything a renderer needs and nothing a reader does. So a
 * gallery of an app's own components has no text to put beside a specimen, and
 * an agent asked to "add a section" has no basis for choosing between
 * `section-header` and `feature-card` other than their names.
 *
 * The three fields answer three different questions, which is why they are not
 * collapsed into one free-form blob:
 *
 * - `usage` — what it IS. Read first, in a gallery, under the specimen.
 * - `when`  — the situation that selects it OVER its neighbours.
 * - `dont`  — the misuse to refuse. The most load-bearing of the three,
 *   because it is the only one that can stop a plausible-looking mistake.
 *
 * All three optional: a component with a one-line `usage` and nothing else is a
 * genuine and common state, and forcing three sentences per component would
 * produce filler.
 */
export const ComponentGuidanceSchema = Schema.Struct({
  /** What this component is. */
  usage: Schema.optional(
    Schema.String.pipe(
      Schema.check(Schema.isMinLength(1, { message: 'Component usage must not be empty' })),
      Schema.annotate({
        description: 'What this component is',
        examples: ['A titled band introducing a page section.'],
      })
    )
  ),

  /** The situation that selects this component over its neighbours. */
  when: Schema.optional(
    Schema.String.pipe(
      Schema.check(Schema.isMinLength(1, { message: 'Component `when` must not be empty' })),
      Schema.annotate({
        description: 'The situation that selects this component over its neighbours',
        examples: ['Use above any section carrying more than three children.'],
      })
    )
  ),

  /** The misuse to refuse. */
  dont: Schema.optional(
    Schema.String.pipe(
      Schema.check(Schema.isMinLength(1, { message: 'Component `dont` must not be empty' })),
      Schema.annotate({
        description: 'The misuse to refuse',
        examples: ['Never nest one inside another — the heading levels collide.'],
      })
    )
  ),
}).pipe(
  Schema.annotate({
    identifier: 'ComponentGuidance',
    title: 'Component Guidance',
    description:
      'Usage guidance for one reusable component: what it is, when to reach for it, and the misuse to refuse',
    examples: [
      {
        usage: 'A titled band introducing a page section.',
        when: 'Use above any section carrying more than three children.',
        dont: 'Never nest one inside another — the heading levels collide.',
      },
    ],
  })
)

/**
 * The record KEY is plain `Schema.String`, for the same measured reason as
 * `ColorRolesSchema`: Effect v4's `Schema.Record` silently DROPS an entry whose
 * key fails the key schema — no error under any option, including
 * `onExcessProperty: 'error'`. A `SectionHeader:` key would vanish and the
 * author would be told the config is valid.
 *
 * The shape is enforced in `design-validation.ts` instead, where a bad key
 * survives to be named. That rule is strictly stronger anyway: it requires the
 * key to resolve to a declared `components[].name`, not merely to look like one.
 */
const ComponentGuidanceKeySchema = Schema.String.annotate({
  title: 'Component Reference Name',
  description:
    'Name of a component declared in `components[]` (kebab-case). Validated against the declared templates at decode time.',
  examples: ['section-header', 'call-to-action'],
})

/**
 * Component guidance keyed by the `name` of a top-level `components[]` entry.
 *
 * Keys are cross-validated against `components[].name` at decode time (see
 * `src/domain/models/app/design-validation.ts`). Guidance keyed to a component
 * that does not exist renders nowhere and is invisible until somebody goes
 * looking for it — which is exactly the class of mistake a config-time check
 * should catch.
 */
export const DesignComponentsSchema = Schema.Record(
  ComponentGuidanceKeySchema,
  ComponentGuidanceSchema
).pipe(
  Schema.annotate({
    identifier: 'DesignComponents',
    title: 'Component Guidance',
    description:
      "Per-component usage guidance keyed by `components[].name`. Gives an app's own component gallery something to say beside each specimen. Every key must name a declared component template.",
    examples: [
      {
        'section-header': {
          usage: 'A titled band introducing a page section.',
          dont: 'Never nest one inside another.',
        },
      },
    ],
  })
)

/** @public */
export type ComponentGuidance = Schema.Schema.Type<typeof ComponentGuidanceSchema>
/** @public */
export type DesignComponents = Schema.Schema.Type<typeof DesignComponentsSchema>
