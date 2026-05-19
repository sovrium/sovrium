/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { ActionBaseFields } from './base'

export const ActionRefSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.optionalWith(Schema.Literal('ref'), { default: () => 'ref' as const }),

  $ref: Schema.String.pipe(
    Schema.pattern(/^[a-z][a-z0-9-]*$/),
    Schema.minLength(1),
    Schema.maxLength(100),
    Schema.annotations({
      description: 'Name of the action template to invoke (must match a template in app.actions[])',
    })
  ),

  $vars: Schema.optional(
    Schema.Record({ key: Schema.String, value: Schema.Unknown }).pipe(
      Schema.annotations({
        description:
          'Variables to substitute in the referenced template (overrides template defaults)',
      })
    )
  ),
}).pipe(
  Schema.annotations({
    identifier: 'ActionRef',
    title: 'Action Template Reference',
    description:
      'Reference to a reusable action template defined in app.actions[], with optional variable overrides',
  })
)

export type ActionRef = Schema.Schema.Type<typeof ActionRefSchema>
