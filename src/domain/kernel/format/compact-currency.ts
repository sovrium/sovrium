/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { formatCurrencyValue, type CurrencyDisplayOptions } from './currency-format'

/**
 * An amount in the page language's COMPACT notation with its currency —
 * `€3.5K` in English, `3,5 k€` in French — at most one decimal, never cents.
 * For a chart's value axis, where a tick names a level rather than an amount.
 * A tag or a code `Intl` rejects falls back to {@link formatCurrencyValue}.
 */
export const formatCompactCurrency = (
  value: number,
  options: CurrencyDisplayOptions = {},
  locale?: string
): string => {
  try {
    return new Intl.NumberFormat(locale ?? 'en-US', {
      style: 'currency',
      currency: options.currency ?? 'USD',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value)
  } catch {
    return formatCurrencyValue(value, options, locale)
  }
}
