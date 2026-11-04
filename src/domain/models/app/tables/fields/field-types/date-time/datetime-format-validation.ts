/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { tokenizePattern, TOKENS } from '@/domain/kernel/format/date-tokens'
import type { App } from '@/domain/models/app'

/** The tokens an author is told about: the canonical spellings, not the legacy aliases. */
const CANONICAL_TOKENS = TOKENS.filter((token) => token.aliasOf === undefined)
  .map((token) => token.token)
  .join(', ')

/** The run of one letter starting at `index`: `hh` in `hh:mm`, `A` in `mm A`. */
const letterRunAt = (pattern: string, index: number): string => {
  const letter = pattern[index] ?? ''
  const run = pattern.slice(index).match(new RegExp(`^${letter}+`))
  return run?.[0] ?? letter
}

/** Why a `datetime` field's pattern cannot be printed, or `undefined` when it can. */
export const datetimeFormatRefusalOf = (pattern: string): string | undefined => {
  const compiled = tokenizePattern(pattern)
  if (compiled.ok) return undefined
  if (compiled.error.code !== 'unknown-token') return `cannot be printed: ${compiled.error.message}`
  const position = compiled.error.message.match(/at position (\d+)/)?.[1]
  const run = position === undefined ? '' : letterRunAt(pattern, Number(position))
  return `names "${run}", which no date pattern prints. Use ${CANONICAL_TOKENS}, or 'quoted' text; a 12-hour clock is timeFormat: 12-hour`
}

/**
 * A `datetime` field's `format` is printed wherever the value is shown, so a
 * pattern naming a letter outside the date tokens is refused when the app
 * starts, naming the field and the letter, rather than printed as written.
 */
export const validateDateTimeFormats = (app: Pick<App, 'tables'>): true | string => {
  const refused = (app.tables ?? [])
    .flatMap((table) =>
      table.fields.flatMap((field) => {
        const pattern = (field as { readonly format?: unknown }).format
        if (field.type !== 'datetime' || typeof pattern !== 'string') return []
        const reason = datetimeFormatRefusalOf(pattern)
        return reason === undefined
          ? []
          : [{ table: table.name, field: field.name, pattern, reason }]
      })
    )
    .at(0)
  if (refused === undefined) return true
  return `Table '${refused.table}' field '${refused.field}': format "${refused.pattern}" ${refused.reason}`
}
