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
      Schema.annotate({ description: 'Total number of pages' }),
      Schema.check(Schema.isInt(), Schema.isGreaterThan(0))
    )
  ),
  currentPage: Schema.optional(
    Schema.Finite.pipe(
      Schema.annotate({ description: 'Current active page number (1-indexed)' }),
      Schema.check(Schema.isInt(), Schema.isGreaterThan(0))
    )
  ),
  siblingCount: Schema.optional(
    Schema.Finite.pipe(
      Schema.annotate({
        description: 'Number of page links shown on each side of current (default: 1)',
      }),
      Schema.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0))
    )
  ),
  paginationVariant: Schema.optional(
    Schema.Literals(['default', 'simple', 'icons']).annotate({
      description:
        "The pager's shape: 'default' draws the page numbers between Previous and Next; 'simple' draws only Previous and Next; 'icons' draws the page numbers between two icon-only controls that keep their names. shadcn/ui's Pagination examples.",
    })
  ),
  previousLabel: Schema.optional(
    Schema.String.annotate({
      description:
        'Name of the control to the previous page (default: "Previous"); accepts a $t: key',
      examples: ['Newer articles'],
    })
  ),
  nextLabel: Schema.optional(
    Schema.String.annotate({
      description: 'Name of the control to the next page (default: "Next"); accepts a $t: key',
      examples: ['Older articles'],
    })
  ),
} as const
