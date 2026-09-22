/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Display formatting for a single bound value, keyed by the declared
 * `ColumnFormat` literal.
 *
 * Shared by every surface that renders one record value through an author's
 * declared format:
 *
 *  - the data-table grid cell (`format` on a field column),
 *  - the data-table summary footer (a `sum` under a formatted column has to
 *    print the same units as the cells above it),
 *  - the `record-field` display component, server-rendered and in its
 *    `record-field-system` island form.
 *
 * It lives in the `tables` slug, beside the field `format` option it reads,
 * rather than beside the grid — for the reason `currency-format.ts` (which it
 * calls) already gives: the grid was not the
 * only consumer, and a second copy of the arithmetic is a second rounding
 * rule. `record-field` was the third consumer and could not import the grid's
 * module without dragging the island's React cell renderers into the SSR
 * graph.
 *
 * Effect-free and DOM-free by construction — the data-table island imports
 * this, and the `locale` the two date formats need is passed IN
 * (`resolvePageLocale()` reads `<html lang>` and stays on the island side).
 */

import { formatByteCount } from '../../../kernel/format/byte-format'
import {
  formatCurrencyValue,
  type CurrencyDisplayOptions,
} from '../../../kernel/format/currency-format'
import type { ColumnFormat } from '@/domain/models/app/pages/components/component-types/data/table/schema'

// ---------------------------------------------------------------------------
// Date formatting helpers
// ---------------------------------------------------------------------------

function formatDate(value: unknown, options: Readonly<Intl.DateTimeFormatOptions>): string {
  const date = value instanceof Date ? value : new Date(String(value))
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString('en-US', options)
}

function formatRelativeDate(value: unknown): string {
  const date = value instanceof Date ? value : new Date(String(value))
  if (Number.isNaN(date.getTime())) return String(value)
  const diffDays = Math.floor((Date.now() - date.getTime()) / 86_400_000)
  if (diffDays === 0) return 'today'
  if (diffDays === 1) return 'yesterday'
  if (diffDays < 30) return `${diffDays} days ago`
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`
  return `${Math.floor(diffDays / 365)} years ago`
}

/**
 * Signed, locale-aware relative-time format — the bidirectional counterpart to
 * the past-only English `relative-date`. A FUTURE date renders forward
 * ("dans 5 j" in fr), a PAST date backward ("il y a 5 j"), via
 * `Intl.RelativeTimeFormat(locale, { style: 'short' }).format(diffDays, 'day')`.
 * `diffDays` is positive for the future (so a grace-window "scheduled erasure"
 * date reads as a countdown) and negative for the past.
 */
function formatRelativeTime(value: unknown, locale: string): string {
  const date = value instanceof Date ? value : new Date(String(value))
  if (Number.isNaN(date.getTime())) return String(value)
  const diffDays = Math.round((date.getTime() - Date.now()) / 86_400_000)
  return new Intl.RelativeTimeFormat(locale, { style: 'short' }).format(diffDays, 'day')
}

// ---------------------------------------------------------------------------
// Value formatting
// ---------------------------------------------------------------------------

/**
 * Formats a bound value according to its declared display format.
 *
 * `locale` is the active page locale, consumed by the locale-aware
 * `relative-time` format; every other format is locale-independent.
 *
 * `currencyOptions` carries the bound field's declared currency treatment. It
 * used to be unreachable: this formatter hard-coded `$` and `en-US` while the
 * field's own `currency` never crossed into the browser, so a field declaring
 * `currency: 'EUR'` rendered `$0.35`. The arithmetic now lives in
 * `./currency-format`, shared with the records API's `?format=display` path,
 * so a grid cell and the formatted API value agree. With no declared
 * properties it falls back to the USD / 2-decimal / comma defaults this
 * formatter always emitted.
 *
 * The dispatch is a TOTAL `Record<ColumnFormat, …>` on purpose: adding a
 * literal to `ColumnFormatSchema` without teaching this function what it means
 * is a type error rather than a value that decodes and then renders verbatim.
 */
export function formatCellValue(
  value: unknown,
  format: ColumnFormat,
  locale: string,
  currencyOptions?: CurrencyDisplayOptions
): string {
  if (value === undefined || value === null) return ''
  const str = String(value)

  const formatters: Readonly<Record<ColumnFormat, () => string>> = {
    truncate: () => (str.length > 50 ? `${str.slice(0, 50)}…` : str),
    currency: () => {
      const num = Number(value)
      return Number.isNaN(num) ? str : formatCurrencyValue(num, currencyOptions)
    },
    percentage: () => {
      const num = Number(value)
      return Number.isNaN(num) ? str : `${num}%`
    },
    compact: () => {
      const num = Number(value)
      return Number.isNaN(num) ? str : Intl.NumberFormat('en', { notation: 'compact' }).format(num)
    },
    // A byte count is NOT `compact`: SI decimal `11.5K` and binary `11 KB` are
    // different units, and a size printed in the wrong base beside a real file
    // is worse than no figure at all.
    bytes: () => {
      const num = Number(value)
      return Number.isNaN(num) ? str : formatByteCount(num)
    },
    'relative-date': () => formatRelativeDate(value),
    // Signed, locale-aware counterpart to the past-only English `relative-date`:
    // a future date renders "dans 5 j" (fr) and a past one "il y a 5 j" via
    // `Intl.RelativeTimeFormat(<page locale>, { style: 'short' })`.
    'relative-time': () => formatRelativeTime(value, locale),
    'short-date': () => formatDate(value, { month: 'short', day: 'numeric', year: 'numeric' }),
    'long-date': () => formatDate(value, { month: 'long', day: 'numeric', year: 'numeric' }),
    datetime: () =>
      formatDate(value, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
    'yes-no': () => (value ? 'Yes' : 'No'),
    'check-cross': () => (value ? '✓' : '✗'),
  }

  return formatters[format]()
}
