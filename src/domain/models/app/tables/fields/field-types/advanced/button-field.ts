/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { FieldConditionSchema } from '../../../condition-operators'
import { BaseFieldWithoutLabelSchema } from '../base-field'
import { validateButtonAction } from '../validation-utils'

/**
 * Built on the `label`-LESS base (`BaseFieldWithoutLabelSchema`), unlike every
 * other field type. `button` spends the top-level `label` key on its own
 * required button TEXT, and `Schema.extend` throws at module-import time on a
 * duplicated key — so it cannot also inherit the field-level display `label`.
 * See `BaseFieldWithoutLabelSchema` for the full rationale. `description` is
 * inherited normally.
 */
const ButtonFieldBaseSchema = BaseFieldWithoutLabelSchema.pipe(
  Schema.fieldsAssign({
    type: Schema.Literal('button'),
    /** The text printed INSIDE the button — NOT the field's display name. */
    label: Schema.String.pipe(
      Schema.check(Schema.isNonEmpty({ message: 'label is required' })),
      Schema.annotate({ description: 'Button text label' })
    ),
    /**
     * What pressing the button does. A closed vocabulary because it is a
     * DISPATCH key, not a label: the renderer and the invoke endpoint both
     * switch on it, and a value neither recognises produces a button that
     * renders and does nothing. Leaving it open let `action: 'markComplete'`
     * validate and silently no-op.
     */
    action: Schema.Literals(['url', 'automation']).pipe(
      Schema.annotate({
        description:
          "What the button does: 'url' opens a link client-side, 'automation' runs a named automation against the record",
      })
    ),
    url: Schema.optional(
      Schema.String.pipe(Schema.annotate({ description: "URL to open (when action is 'url')" }))
    ),
    automation: Schema.optional(
      Schema.String.pipe(
        Schema.annotate({
          description: "Automation name to trigger (when action is 'automation')",
        })
      )
    ),
    /**
     * Per-record visibility predicate. Omitted, the button renders on every
     * record; supplied, only on records whose named field satisfies the
     * operator(s). Reuses the shared condition vocabulary the `table`
     * action column already spends, so "show this control on some rows" has
     * one grammar across the config surface.
     */
    visibleWhen: Schema.optional(
      FieldConditionSchema.annotate({
        description:
          'Render the button only on records whose named field satisfies the condition. Omit to show it on every record.',
      })
    ),
  })
)

export const ButtonFieldSchema = ButtonFieldBaseSchema.pipe(
  Schema.check(Schema.makeFilter(validateButtonAction)),
  Schema.annotate({
    title: 'Button Field',
    description:
      'Interactive button that triggers actions like opening URLs or running automations.',
    examples: [
      {
        id: 1,
        name: 'approve',
        type: 'button',
        label: 'Approve',
        action: 'automation',
        automation: 'approve_request',
      },
    ],
  })
)

/** @public */
export type ButtonField = Schema.Schema.Type<typeof ButtonFieldSchema>
