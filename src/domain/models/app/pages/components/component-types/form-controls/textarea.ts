/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { coreFields } from '../modules/core'
import { i18nFields } from '../modules/i18n'
import { visibilityFields } from '../modules/visibility'

export const TextareaTypeLiteral = Schema.Literal('textarea')

export const textareaFields = {
  ...coreFields,
  ...visibilityFields,
  ...i18nFields,
  rows: Schema.optional(
    Schema.Number.pipe(
      Schema.int(),
      Schema.greaterThan(0),
      Schema.annotations({ description: 'Number of visible text rows for textarea' })
    )
  ),
  maxLength: Schema.optional(
    Schema.Number.pipe(
      Schema.int(),
      Schema.greaterThan(0),
      Schema.annotations({ description: 'Maximum character count for textarea' })
    )
  ),
  autoResize: Schema.optional(
    Schema.Boolean.annotations({
      description: 'Auto-resize textarea height to fit content',
    })
  ),
} as const
