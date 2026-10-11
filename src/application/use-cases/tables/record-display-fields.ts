/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { formatFieldForDisplay } from './display-formatter'
import type { TransformedRecord } from './record-transformer'
import type { App } from '@/domain/models/app'

/**
 * Collapse the single-record read's fields to FLAT display strings.
 *
 * The list route keeps the `{ value, displayValue, timezone }` object; this
 * route deliberately does not, and nine sibling `format=display` specs read
 * `fields.X` as a string. Changing that here would silently re-spec a contract
 * they pin, so the collapse stays.
 *
 * Two paths reach a display string, and BOTH need the caller's zone.
 * `transformRecord` has already formatted every field it recognised, leaving an
 * object to unwrap; anything it passed through unformatted is formatted here
 * instead. Passing the override to only one of them made the rendered clock
 * depend on which branch a field happened to take.
 */
export const toDisplayFields = (
  fields: Readonly<TransformedRecord['fields']>,
  config: {
    readonly app: App
    readonly tableName: string
    readonly timezone?: string | undefined
  }
): Readonly<TransformedRecord['fields']> =>
  Object.fromEntries(
    Object.entries(fields).map(
      ([key, value]): readonly [string, TransformedRecord['fields'][string]] => {
        const isObj = typeof value === 'object' && value !== null && !Array.isArray(value)
        if (isObj && 'displayValue' in (value as object)) {
          return [key, (value as { displayValue: string }).displayValue]
        }
        const formatted = formatFieldForDisplay({
          fieldName: key,
          value,
          app: config.app,
          tableName: config.tableName,
          timezoneOverride: config.timezone,
        })
        return [key, formatted ? formatted.displayValue : value]
      }
    )
  )
