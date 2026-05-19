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

export const PaginationTypeLiteral = Schema.Literal('pagination')

export const paginationFields = {
  ...coreFields,
  ...visibilityFields,
  ...i18nFields,
  totalPages: Schema.optional(
    Schema.Number.pipe(
      Schema.int(),
      Schema.greaterThan(0),
      Schema.annotations({ description: 'Total number of pages' })
    )
  ),
  currentPage: Schema.optional(
    Schema.Number.pipe(
      Schema.int(),
      Schema.greaterThan(0),
      Schema.annotations({ description: 'Current active page number (1-indexed)' })
    )
  ),
  siblingCount: Schema.optional(
    Schema.Number.pipe(
      Schema.int(),
      Schema.greaterThanOrEqualTo(0),
      Schema.annotations({
        description: 'Number of page links shown on each side of current (default: 1)',
      })
    )
  ),
} as const
