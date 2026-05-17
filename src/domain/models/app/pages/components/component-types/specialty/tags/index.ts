/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { TagItemSchema } from '../../../shared-schemas'
import { coreFields } from '../../modules/core'
import { i18nFields } from '../../modules/i18n'
import { visibilityFields } from '../../modules/visibility'

export const TagsTypeLiteral = Schema.Literal('tags')

export const tagsFields = {
  ...coreFields,
  ...visibilityFields,
  ...i18nFields,
  tags: Schema.optional(
    Schema.Array(TagItemSchema).pipe(
      Schema.annotations({ description: 'Tag/chip items to display' })
    )
  ),
  maxTags: Schema.optional(
    Schema.Number.pipe(
      Schema.int(),
      Schema.greaterThan(0),
      Schema.annotations({ description: 'Maximum number of tags allowed' })
    )
  ),
  allowAdd: Schema.optional(
    Schema.Boolean.annotations({
      description: 'Allow users to add new tags via input',
    })
  ),
} as const

// Re-export TagItemSchema for consumers
export { TagItemSchema } from '../../../shared-schemas'
