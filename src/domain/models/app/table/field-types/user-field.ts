/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { BaseFieldSchema } from './base-field'

/**
 * User Field
 *
 * Reference field that links to users from the authentication system.
 * Stores user IDs and can be used for assignments, ownership, or collaboration.
 * Supports single or multiple user selection via allowMultiple flag.
 *
 * @example
 * ```typescript
 * const field = {
 *   id: 1,
 *   name: 'assigned_to',
 *   type: 'user',
 *   required: true,
 *   allowMultiple: false
 * }
 * ```
 */
export const UserFieldSchema = BaseFieldSchema.pipe(
  Schema.extend(
    Schema.Struct({
      type: Schema.Literal('user'),
      allowMultiple: Schema.optional(Schema.Boolean),
    })
  ),
  Schema.annotations({
    title: 'User Field',
    description:
      'Reference field linking to users from authentication system. Supports single or multiple user selection.',
    examples: [
      {
        id: 1,
        name: 'assigned_to',
        type: 'user',
        required: true,
        allowMultiple: false,
      },
    ],
  })
)

export type UserField = Schema.Schema.Type<typeof UserFieldSchema>
