/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { formatFieldForDisplay } from '@/domain/models/app/tables/display-formatter-service'
import { parseSovriumTimezone } from '@/domain/models/process-env/timezone'
import type { ProcessEnvShape } from '@/application/ports/services/process-env'
import type { App } from '@/domain/models/app'
import type { TransformedRecord } from '@/domain/models/app/tables/record-transformer-service'

/**
 * The operator timezone a `format=display` read renders its dates in, read off
 * the environment the caller took from the `ProcessEnv` port — present only on
 * a display read, the one shape that formats a date. Spread into the
 * transform options (and handed to {@link toDisplayFields}).
 */
export const displayZoneOf = (
  format: 'display' | undefined,
  env: ProcessEnvShape
): { readonly operatorTimezone?: string } =>
  format === 'display' ? { operatorTimezone: parseSovriumTimezone(env).zoneId } : {}

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
const toDisplayFields = (
  fields: Readonly<TransformedRecord['fields']>,
  config: {
    readonly app: App
    readonly tableName: string
    readonly timezone?: string | undefined
    /** The operator timezone (`SOVRIUM_TIMEZONE`), read by the caller. */
    readonly operatorTimezone: string
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
          operatorTimezone: config.operatorTimezone,
        })
        return [key, formatted ? formatted.displayValue : value]
      }
    )
  )

/**
 * The single-record read's fields as its reader receives them: flattened to
 * display strings ({@link toDisplayFields}) on a `format=display` read, in the
 * operator timezone read off `env`; untouched otherwise.
 */
export const displayedFieldsOf = (
  fields: Readonly<TransformedRecord['fields']>,
  config: {
    readonly app: App
    readonly tableName: string
    readonly format?: 'display' | undefined
    readonly timezone?: string | undefined
    readonly env: ProcessEnvShape
  }
): Readonly<TransformedRecord['fields']> =>
  config.format === 'display'
    ? toDisplayFields(fields, {
        ...config,
        operatorTimezone: parseSovriumTimezone(config.env).zoneId,
      })
    : fields
