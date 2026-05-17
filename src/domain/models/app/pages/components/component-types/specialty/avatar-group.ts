/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { AvatarItemSchema } from '../../shared-schemas'
import { coreFields } from '../modules/core'
import { visibilityFields } from '../modules/visibility'

export const AvatarGroupTypeLiteral = Schema.Literal('avatar-group')

export const avatarGroupFields = {
  ...coreFields,
  ...visibilityFields,
  avatars: Schema.optional(
    Schema.Array(AvatarItemSchema).pipe(
      Schema.minItems(1),
      Schema.annotations({
        description: 'Avatar items to display in the group',
      })
    )
  ),
  maxVisible: Schema.optional(
    Schema.Number.pipe(
      Schema.int(),
      Schema.greaterThan(0),
      Schema.annotations({
        description: 'Maximum visible avatars before showing "+N" overflow indicator',
      })
    )
  ),
} as const
