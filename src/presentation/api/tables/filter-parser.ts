/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { Context } from 'hono'

/**
 * Filter parameter type matching the expected shape
 */
export type FilterParameter =
  | {
      readonly and?: readonly {
        readonly field: string
        readonly operator: string
        readonly value: unknown
      }[]
    }
  | undefined

/**
 * Result of parsing filter parameter
 */
export type ParseFilterResult =
  { success: true; filter: FilterParameter } | { success: false; error: Response }

/**
 * Parse the `?filter=` query parameter into a filter structure.
 *
 * SHAPE ONLY — this parser deliberately performs no field-permission check.
 * Both of its output shapes (parsed JSON, and the `field:value` shorthand) flow
 * into `parseFilter`, which runs the single recursive check for every filter
 * entry point. Re-checking here duplicated the rule, and the duplicate was the
 * weaker of the two: it read only flat leaves, so a nested group escaped it.
 *
 * @param config - Configuration object with filter details
 * @returns ParseFilterResult indicating success with filter or failure with error response
 */
/** The boolean a checkbox shorthand value names, or the value itself otherwise. */
const CHECKBOX_SHORTHAND: Readonly<Record<string, boolean>> = {
  true: true,
  false: false,
  '1': true,
  '0': false,
}

const shorthandValue = (fieldType: string | undefined, value: string): unknown =>
  fieldType === 'checkbox' && value.toLowerCase() in CHECKBOX_SHORTHAND
    ? CHECKBOX_SHORTHAND[value.toLowerCase()]
    : value

export function parseFilterParameter(config: {
  filterParam: string | undefined
  c: Context
  /**
   * The declared type of a field, so the `field:value` shorthand can read a
   * checkbox's `true` / `false` as the boolean it names — compared as text, it
   * matched no row on SQLite.
   */
  fieldTypeOf?: (field: string) => string | undefined
}): ParseFilterResult {
  const { filterParam, c, fieldTypeOf } = config

  if (!filterParam) {
    return { success: true, filter: undefined }
  }

  try {
    return { success: true, filter: JSON.parse(filterParam) }
  } catch {
    // Try field:value simple equality format (e.g., "priority:high")
    const colonIdx = filterParam.indexOf(':')
    if (colonIdx > 0) {
      const field = filterParam.substring(0, colonIdx)
      const value = shorthandValue(fieldTypeOf?.(field), filterParam.substring(colonIdx + 1))
      return { success: true, filter: { and: [{ field, operator: 'equals', value }] } }
    }

    return {
      success: false,
      error: c.json(
        { success: false, message: 'Invalid filter parameter', code: 'BAD_REQUEST' },
        400
      ),
    }
  }
}
