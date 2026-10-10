/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { fieldLiteralOf } from '@/domain/models/app/tables/checkbox-literal-service'
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
 * A parsed filter whose every condition's `value` is read through the type of
 * the field it names (`fieldLiteralOf`, the one coercion every filter shares),
 * through `and` / `or` groups at any depth: a checkbox compared with `1`,
 * `"true"` or `"f"` binds the boolean it names, on both engines. Anything that
 * is no condition is returned as it is, for the shape checks downstream.
 */
const withFieldLiterals = (
  node: unknown,
  fieldTypeOf: ((field: string) => string | undefined) | undefined
): unknown => {
  if (fieldTypeOf === undefined || typeof node !== 'object' || node === null) return node
  if (Array.isArray(node)) return node.map((child) => withFieldLiterals(child, fieldTypeOf))
  const record = node as Readonly<Record<string, unknown>>
  if (typeof record['field'] === 'string' && 'value' in record) {
    const value = fieldLiteralOf(fieldTypeOf(record['field']), record['value'])
    return value === record['value'] ? record : { ...record, value }
  }
  return Object.fromEntries(
    Object.entries(record).map(([key, child]) =>
      key === 'and' || key === 'or' ? [key, withFieldLiterals(child, fieldTypeOf)] : [key, child]
    )
  )
}

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
export function parseFilterParameter(config: {
  filterParam: string | undefined
  c: Context
  /**
   * The declared type of a field, so a literal compared with a checkbox — in
   * the JSON filter or the `field:value` shorthand — reads as the boolean it
   * names: compared as text it matched no row on SQLite, and as a number it
   * failed the query on PostgreSQL.
   */
  fieldTypeOf?: (field: string) => string | undefined
}): ParseFilterResult {
  const { filterParam, c, fieldTypeOf } = config

  if (!filterParam) {
    return { success: true, filter: undefined }
  }

  try {
    return {
      success: true,
      filter: withFieldLiterals(JSON.parse(filterParam), fieldTypeOf) as FilterParameter,
    }
  } catch {
    // Try field:value simple equality format (e.g., "priority:high")
    const colonIdx = filterParam.indexOf(':')
    if (colonIdx > 0) {
      const field = filterParam.substring(0, colonIdx)
      const value = fieldLiteralOf(fieldTypeOf?.(field), filterParam.substring(colonIdx + 1))
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
