/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { parseFilterParameter } from './filter-parser'
import { parseFormulaToFilter } from './formula-parser'
import type { App } from '@/domain/models/app'
import type { Context } from 'hono'

type FilterStructure =
  | {
      readonly and?: readonly {
        readonly field: string
        readonly operator: string
        readonly value: unknown
      }[]
    }
  | undefined

type FilterResult =
  | { readonly error: false; readonly value: FilterStructure }
  | { readonly error: true; readonly response?: Response }

/**
 * Parse filter parameter from request (formula or standard filter)
 */
export function parseFilter(
  c: Context,
  app: App,
  tableName: string,
  userRole: string
): FilterResult {
  const filterByFormula = c.req.query('filterByFormula')

  if (filterByFormula) {
    const parsedFormula = parseFormulaToFilter(filterByFormula)
    return parsedFormula ? { error: false, value: parsedFormula } : { error: true }
  }

  const parsedFilterResult = parseFilterParameter({
    filterParam: c.req.query('filter'),
    app,
    tableName,
    userRole,
    c,
  })

  return parsedFilterResult.success
    ? { error: false, value: parsedFilterResult.filter }
    : { error: true, response: parsedFilterResult.error }
}
