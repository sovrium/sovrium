/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { resolveCurrencyOptions } from '@/domain/kernel/format/currency-format'
import { formatRecordText } from '@/domain/models/app/tables/record-text-service'
import { resolvePageLocale } from '../../runtime/page-locale'
import type { CellFieldOptions } from '../cell-renderers'

/**
 * An amount in its declared currency, symbol position and separators, in the
 * page language. A `currency` field reads through here, and so does a formula
 * declaring `format: currency`, so the two print one amount one way.
 */
export const currencyText = (value: unknown, fieldOptions?: CellFieldOptions): string => {
  const currency = resolveCurrencyOptions({
    type: 'currency',
    display: fieldOptions?.display,
  })
  return formatRecordText(
    value,
    { format: 'currency', ...(currency === undefined ? {} : { currency }) },
    fieldOptions?.locale ?? resolvePageLocale()
  )
}
