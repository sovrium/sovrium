/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { FieldConditionSchema } from '../../../../../shared/condition-operators'
import { BaseFieldSchema } from '../base-field'
import { validateButtonAction } from '../validation-utils'

const ButtonFieldBaseSchema = BaseFieldSchema.pipe(
  Schema.extend(
    Schema.Struct({
      type: Schema.Literal('button'),
      label: Schema.String.pipe(
        Schema.nonEmptyString({ message: () => 'label is required' }),
        Schema.annotations({ description: 'Button text label' })
      ),
      action: Schema.Literal('url', 'automation').pipe(
        Schema.annotations({
          description:
            "What the button does: 'url' opens a link client-side, 'automation' runs a named automation against the record",
        })
      ),
      url: Schema.optional(
        Schema.String.pipe(
          Schema.annotations({ description: "URL to open (when action is 'url')" })
        )
      ),
      automation: Schema.optional(
        Schema.String.pipe(
          Schema.annotations({
            description: "Automation name to trigger (when action is 'automation')",
          })
        )
      ),
      visibleWhen: Schema.optional(
        FieldConditionSchema.annotations({
          description:
            'Render the button only on records whose named field satisfies the condition. Omit to show it on every record.',
        })
      ),
    })
  )
)

export const ButtonFieldSchema = ButtonFieldBaseSchema.pipe(
  Schema.filter(validateButtonAction),
  Schema.annotations({
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

export type ButtonField = Schema.Schema.Type<typeof ButtonFieldSchema>
