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

export const SearchInputTypeLiteral = Schema.Literal('searchInput')

export const searchInputFields = {
  ...coreFields,
  ...visibilityFields,
  ...i18nFields,
  debounceMs: Schema.optional(
    Schema.Number.pipe(
      Schema.int(),
      Schema.greaterThanOrEqualTo(0),
      Schema.annotations({
        description:
          'Delay in milliseconds after the last keystroke before a bound subscriber applies the query. Default 0 (apply immediately).',
        examples: [300, 500],
      })
    )
  ),
  minQueryLength: Schema.optional(
    Schema.Number.pipe(
      Schema.int(),
      Schema.greaterThanOrEqualTo(0),
      Schema.annotations({
        description:
          'Minimum number of characters before the query is applied. Below it the subscriber shows its unfiltered baseline. Default 0 (no minimum).',
        examples: [2, 3],
      })
    )
  ),
} as const
