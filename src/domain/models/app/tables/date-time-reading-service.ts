/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { usableLocale } from '../../../kernel/format/usable-locale'
import { formatDateTimeColumn, formatDateTimeJoined } from './cell-value-format'

/**
 * The reading of a `datetime` a grid cell shares with a record field and a
 * description list: its date, `glue` and time when the server handed the glue
 * (`formatDateTimeJoined`, the spelling the record text prints), else the column
 * format's own spelling, at the wall clock of `timeZone`. `local` (a field asking
 * for the reader's own clock) and no zone read at the runtime's own zone, which
 * in a browser is the reader's.
 *
 * Kept apart from `cell-value-format` so the islands that never draw a grid cell
 * do not carry it.
 */
export function formatDateTimeReading(
  value: unknown,
  locale: string,
  options: { readonly glue?: string | undefined; readonly timeZone?: string | undefined }
): string {
  const zone =
    options.timeZone === 'local' || options.timeZone === '' ? undefined : options.timeZone
  return options.glue === undefined
    ? formatDateTimeColumn(value, locale, zone)
    : formatDateTimeJoined(value, usableLocale(locale), options.glue, zone)
}
