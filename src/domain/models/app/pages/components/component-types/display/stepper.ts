/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `stepper` — one task split into ordered steps, each step any content.
 *
 * ─── THE BODY IS THE INDEX-ALIGNED CHILD, AS IN `tabs` ────────────────────
 *
 * `steps[i]` names the step that shows `children[i]`, exactly as
 * `tabs.panels[i]` names the panel that shows `children[i]`. A step therefore
 * holds any component — a `form`, a `record-picker`, a block — without this
 * file building a component union of its own, which is the import cycle
 * `component-type-union.ts` documents. Two composite types that hold content
 * one way each is one rule to learn rather than two.
 *
 * ─── WHAT A STEP GATES ON ─────────────────────────────────────────────────
 *
 * `linear` (the default) makes Continue the only way forward: a step is left
 * only once its body is valid, which for a step whose child is a `form` means
 * that form's own validation passes. `optional` adds a Skip. The current step
 * is mirrored in the address (`?step=<id>`), so a reload lands where the
 * reader was and the back button walks the steps.
 */

import { Schema } from 'effect'
import { actionWithoutFill } from '../../action'
import { coreFields } from '../modules/core'
import { i18nFields } from '../modules/i18n'
import { responsiveFields } from '../modules/responsive'
import { visibilityFields } from '../modules/visibility'

export const StepperTypeLiteral = Schema.Literal('stepper')

export const StepperStepSchema = Schema.Struct({
  id: Schema.String.pipe(
    Schema.annotate({
      description: 'Stable id of the step: its value in the `?step=` address and its anchor',
      examples: ['details', 'billing', 'review'],
    }),
    Schema.check(Schema.isMinLength(1), Schema.isPattern(/^[a-z0-9][a-z0-9-]*$/))
  ),
  label: Schema.String.annotate({
    description: 'Name of the step on the rail and in its heading. Supports $t: references.',
  }),
  description: Schema.optional(
    Schema.String.annotate({
      description: 'One line under the label saying what the step asks for',
    })
  ),
  optional: Schema.optional(
    Schema.Boolean.annotate({
      description: 'Offer a Skip for this step, so the reader can move on without completing it',
    })
  ),
}).annotate({
  identifier: 'StepperStep',
  title: 'Stepper Step',
  description:
    'One step: its id, label, optional description and whether it may be skipped. Its body is the index-aligned entry of the stepper’s `children`.',
})

export const stepperFields = {
  ...coreFields,
  ...responsiveFields,
  ...visibilityFields,
  ...i18nFields,
  steps: Schema.Array(StepperStepSchema).pipe(
    Schema.annotate({
      description:
        'The steps, in order. `steps[i]` is shown with `children[i]` as its body. At least two.',
    }),
    Schema.check(Schema.isMinLength(2))
  ),
  orientation: Schema.optional(
    Schema.Literals(['horizontal', 'vertical']).annotate({
      description:
        'Whether the rail runs across the top (horizontal, default) or down the side (vertical). Past five steps, or on a phone, it compacts to "Step 2 of 4" and a progress bar.',
    })
  ),
  linear: Schema.optional(
    Schema.Boolean.annotate({
      description:
        'Steps are taken in order and a step is left only once its body is valid (default: true). Set false to let the reader jump to any step from the rail.',
    })
  ),
  finishLabel: Schema.optional(
    Schema.String.annotate({
      description:
        'Label of the button on the last step (default: "Finish"). Supports $t: references.',
      examples: ['Create project', 'Submit request'],
    })
  ),
  onFinish: Schema.optional(
    actionWithoutFill(
      'A stepper onFinish',
      'StepperFinishAction',
      'Stepper Finish Action',
      'The action the last step runs. Every action type except `fill`, which runs only from a button on the page, a list item click or a board drop hook.'
    )
  ),
} as const
