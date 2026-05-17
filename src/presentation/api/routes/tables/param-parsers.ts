/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
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
  /**
   * When true, the aggregate parameter was provided in the shortcut
   * comma-separated `field:op` form (e.g. `amount:sum,amount:count`).
   * In that case, and when a single field is referenced, the response
   * flattens `aggregations.sum = { field: value }` to `aggregations.sum = value`.
   */
  readonly shortcut?: boolean
}

const AGGREGATE_OPS = ['sum', 'count', 'avg', 'min', 'max'] as const
type AggregateOp = (typeof AGGREGATE_OPS)[number]

function isAggregateOp(value: string): value is AggregateOp {
  return (AGGREGATE_OPS as readonly string[]).includes(value)
}

type ShortcutEntry = { readonly field: string; readonly op: AggregateOp }

function parseShortcutEntry(part: string): ShortcutEntry | undefined {
  const [field, op] = part.split(':').map((s) => s.trim())
  if (!field || !op || !isAggregateOp(op)) return undefined
  return { field, op }
}

function entriesToAggregateParams(entries: readonly ShortcutEntry[]): AggregateParams | undefined {
  const fieldsFor = (op: AggregateOp) => entries.filter((e) => e.op === op).map((e) => e.field)
  const sum = fieldsFor('sum')
  const avg = fieldsFor('avg')
  const min = fieldsFor('min')
  const max = fieldsFor('max')
  const hasCount = entries.some((e) => e.op === 'count')
  const hasAny = hasCount || sum.length + avg.length + min.length + max.length > 0
  if (!hasAny) return undefined
  return {
    ...(hasCount ? { count: true } : {}),
    ...(sum.length > 0 ? { sum } : {}),
    ...(avg.length > 0 ? { avg } : {}),
    ...(min.length > 0 ? { min } : {}),
    ...(max.length > 0 ? { max } : {}),
    shortcut: true,
  }
}

/**
 * Parse shortcut aggregate form: `field:op,field:op`.
 * Examples:
 *   `amount:sum`                          -> { sum: ['amount'], shortcut: true }
 *   `amount:sum,amount:count,amount:avg`  -> { sum: ['amount'], count: true, avg: ['amount'], shortcut: true }
 */
function parseAggregateShortcut(raw: string): AggregateParams | undefined {
  const entries: readonly ShortcutEntry[] = raw
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .map(parseShortcutEntry)
    .filter((e): e is ShortcutEntry => e !== undefined)
  if (entries.length === 0) return undefined
  return entriesToAggregateParams(entries)
}

/**
 * Parse aggregate parameter.
 * Accepts either the JSON form (legacy) or the shortcut `field:op,field:op` form.
 */
export function parseAggregateParam(
  aggregateParam: string | undefined
): AggregateParams | undefined {
  if (!aggregateParam) return undefined

  // Try JSON first (legacy). JSON objects begin with `{`.
  const trimmed = aggregateParam.trim()
  if (trimmed.startsWith('{')) {
    try {
      return JSON.parse(trimmed) as AggregateParams
    } catch {
      return undefined
    }
  }

  return parseAggregateShortcut(trimmed)
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
  readonly groupBy: string | undefined
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
  const groupBy = c.req.query('groupBy')

  return { includeDeleted, format, timezone, sort, fields, limit, offset, aggregate, groupBy }
}
