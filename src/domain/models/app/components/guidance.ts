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
 *
 * ## Why it lives ON the template rather than in `design.components`
 *
 * It used to be a `Schema.Record` under `design.components`, keyed by
 * `components[].name` and cross-validated against the declared templates by
 * rule 3 of `design-validation.ts`. That arrangement had two costs and one
 * blocker.
 *
 * The costs: a rename had to be applied in two places, and the check that
 * caught a half-applied rename could only run because the key was left as a
 * plain `Schema.String` — an Effect v4 `Schema.Record` silently DELETES an
 * entry whose key fails the key schema, so the pattern could not be enforced
 * where it was written. Co-locating removes both: guidance moves with the
 * template it describes, a rename cannot half-apply, and there is no key to
 * mistype.
 *
 * The blocker: `design.components` is now the home for per-engine-type STYLE
 * classes (`design.components.button.parts.root`), which is a different subject
 * addressed to a different reader — the operator restyling an app, not the
 * author documenting their own templates. Two unrelated meanings under one key
 * is the ambiguity this move ends.
 */
export const ComponentGuidanceSchema = Schema.Struct({
  /** What this component is. */
  usage: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        description: 'What this component is',
        examples: ['A titled band introducing a page section.'],
      }),
      Schema.check(Schema.isMinLength(1, { message: 'Component usage must not be empty' }))
    )
  ),

  /** The situation that selects this component over its neighbours. */
  when: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        description: 'The situation that selects this component over its neighbours',
        examples: ['Use above any section carrying more than three children.'],
      }),
      Schema.check(Schema.isMinLength(1, { message: 'Component `when` must not be empty' }))
    )
  ),

  /** The misuse to refuse. */
  dont: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        description: 'The misuse to refuse',
        examples: ['Never nest one inside another — the heading levels collide.'],
      }),
      Schema.check(Schema.isMinLength(1, { message: 'Component `dont` must not be empty' }))
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

/** @public */
export type ComponentGuidance = Schema.Schema.Type<typeof ComponentGuidanceSchema>
