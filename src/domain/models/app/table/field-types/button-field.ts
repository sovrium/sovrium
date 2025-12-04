/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { BaseFieldSchema } from './base-field'

export const ButtonFieldSchema = BaseFieldSchema.pipe(
  Schema.extend(
    Schema.Struct({
      type: Schema.Literal('button'),
      label: Schema.String.pipe(
        Schema.minLength(1, { message: () => 'This field is required' }),
        Schema.annotations({ description: 'Button text label' })
      ),
      action: Schema.String.pipe(Schema.annotations({ description: 'Type of action to trigger' })),
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
    })
  ),
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
