/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { validateFilterParam } from './field-permission-validation'
import { parseFilterParameter } from './filter-parser'
import { parseFormulaToFilter } from './formula-parser'
import type { FilterStructure } from './row-level-read-helpers'
import type { App } from '@/domain/models/app'
import type { Context } from 'hono'

type FilterResult =
  | { readonly error: false; readonly value: FilterStructure }
  | { readonly error: true; readonly response?: Response }

/**
 * Parse the caller-supplied filter (formula or standard filter) and check every
 * field it names against the caller's field-read permissions.
 *
 * The permission check belongs HERE, at the single point where a request
 * becomes a filter, for two reasons:
 *
 *  - It is the last place the filter is still purely the CALLER's. Downstream,
 *    `buildListFilter` merges the saved view's filter, the `?q=` search group
 *    and the row-level read predicate into the same tree; validating after that
 *    checks server-authored clauses against the caller (see the warning on
 *    `validateFilterParam`).
 *  - It covers every shape at once. `?filterByFormula=`, `?filter=` as JSON and
 *    `?filter=field:value` all converge on one value here, so the rule is
 *    stated once instead of once per parser — which is how `?filterByFormula=`
 *    came to have no parse-time check at all.
 */
export function parseFilter(
  c: Context,
  app: App,
  tableName: string,
  userRole: string
): FilterResult {
  const parsed = parseFilterInput(c)
  if (parsed.error) return parsed

  const denied = validateFilterParam(parsed.value, { app, tableName, userRole, c })
  return denied ? { error: true, response: denied } : parsed
}

/** Shape the request into a filter, without permission checking. */
function parseFilterInput(c: Context): FilterResult {
  const filterByFormula = c.req.query('filterByFormula')

  if (filterByFormula) {
    const parsedFormula = parseFormulaToFilter(filterByFormula)
    return parsedFormula ? { error: false, value: parsedFormula } : { error: true }
  }

  const parsedFilterResult = parseFilterParameter({ filterParam: c.req.query('filter'), c })

  return parsedFilterResult.success
    ? { error: false, value: parsedFilterResult.filter }
    : { error: true, response: parsedFilterResult.error }
}
