/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { coreFields } from '../modules/core'
import { i18nFields } from '../modules/i18n'
import { responsiveFields } from '../modules/responsive'
import { visibilityFields } from '../modules/visibility'

export const StaticTableTypeLiteral = Schema.Literal('static-table')

export const staticTableFields = {
  ...coreFields,
  ...responsiveFields,
  ...visibilityFields,
  ...i18nFields,
  tableHeaders: Schema.optional(
    Schema.Array(Schema.String).pipe(
      Schema.minItems(1),
      Schema.annotations({ description: 'Column header labels for static table' })
    )
  ),
  tableRows: Schema.optional(
    Schema.Array(Schema.Array(Schema.String)).pipe(
      Schema.minItems(1),
      Schema.annotations({ description: 'Row data as array of string arrays for static table' })
    )
  ),
  caption: Schema.optional(
    Schema.String.annotations({ description: 'Caption text displayed above or below the table' })
  ),
} as const
