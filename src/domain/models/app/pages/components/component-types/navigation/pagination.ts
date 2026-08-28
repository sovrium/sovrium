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
    Schema.Finite.pipe(
      Schema.check(Schema.isInt(), Schema.isGreaterThan(0)),
      Schema.annotate({ description: 'Total number of pages' })
    )
  ),
  currentPage: Schema.optional(
    Schema.Finite.pipe(
      Schema.check(Schema.isInt(), Schema.isGreaterThan(0)),
      Schema.annotate({ description: 'Current active page number (1-indexed)' })
    )
  ),
  siblingCount: Schema.optional(
    Schema.Finite.pipe(
      Schema.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0)),
      Schema.annotate({
        description: 'Number of page links shown on each side of current (default: 1)',
      })
    )
  ),
} as const
