/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { Context } from 'hono'

type AggregateParams = {
  readonly count?: boolean
  readonly sum?: readonly string[]
  readonly avg?: readonly string[]
  readonly min?: readonly string[]
  readonly max?: readonly string[]
}

/**
 * Parse aggregate JSON parameter
 */
export function parseAggregateParam(
  aggregateParam: string | undefined
): AggregateParams | undefined {
  if (!aggregateParam) return undefined

  try {
    return JSON.parse(aggregateParam) as AggregateParams
  } catch {
    // Invalid JSON, ignore aggregation
    return undefined
  }
}

/**
 * Parse list records query parameters
 */
export function parseListRecordsParams(c: Context): {
  readonly includeDeleted: boolean
  readonly format: 'display' | undefined
  readonly timezone: string | undefined
  readonly sort: string | undefined
  readonly fields: string | undefined
  readonly limit: number | undefined
  readonly offset: number | undefined
  readonly aggregate: AggregateParams | undefined
} {
  const includeDeleted = c.req.query('includeDeleted') === 'true'
  const format = c.req.query('format') === 'display' ? ('display' as const) : undefined
  const timezone = c.req.query('timezone')
  const sort = c.req.query('sort')
  const fields = c.req.query('fields')
  const limitParam = c.req.query('limit')
  const offsetParam = c.req.query('offset')
  const limit = limitParam ? Number(limitParam) : undefined
  const offset = offsetParam ? Number(offsetParam) : undefined
  const aggregate = parseAggregateParam(c.req.query('aggregate'))

  return { includeDeleted, format, timezone, sort, fields, limit, offset, aggregate }
}
