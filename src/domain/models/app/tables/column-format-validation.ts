/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Whether a free-form format string names a `ColumnFormat`.
 *
 * Its own module rather than a second export of `cell-value-format.ts`: that
 * module is shared by several islands, and a guard only the list needs would
 * otherwise ride into every chunk that formats a value.
 */

import type { ColumnFormat } from '@/domain/models/app/pages/components/component-types/data/table/schema'

/**
 * Every `ColumnFormat` literal, as a TOTAL record so a literal added to the
 * schema without being listed here is a type error.
 */
const COLUMN_FORMAT_LITERALS: Readonly<Record<ColumnFormat, true>> = {
  truncate: true,
  currency: true,
  percentage: true,
  compact: true,
  bytes: true,
  'relative-date': true,
  'relative-time': true,
  'short-date': true,
  'long-date': true,
  datetime: true,
  'yes-no': true,
  'check-cross': true,
}

/**
 * Whether a free-form format string (a list item's metadata `format`, which the
 * schema leaves open for presentation words such as `badge` or `text`) names a
 * value format this module knows how to apply.
 */
export function isColumnFormat(format: string | undefined): format is ColumnFormat {
  return format !== undefined && Object.hasOwn(COLUMN_FORMAT_LITERALS, format)
}
