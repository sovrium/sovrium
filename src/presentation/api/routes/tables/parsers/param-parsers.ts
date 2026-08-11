/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { DEFAULT_PAGE_SIZE } from '@/application/use-cases/tables/utils/list-helpers'
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
 * Resolve the row offset a list request starts at.
 *
 * `offset` and `page` address the same window, so one of them has to win.
 * `offset` does: it is the parameter that already works, the one the published
 * reference tells callers to use, and the one existing clients send. Letting
 * `page` override it would silently change which rows a working request
 * returns — a 200 answering different data is worse than either alternative.
 * `page` is therefore a convenience alias applied only when no `offset` is
 * given, which makes honouring it strictly additive.
 *
 * A `page` that is not a positive number is ignored rather than rejected: it
 * cannot name a window, and turning it into a 400 would fail requests the query
 * schema advertises as valid.
 */
const resolveOffset = (
  offsetParam: string | undefined,
  pageParam: string | undefined,
  limit: number | undefined
): number | undefined => {
  if (offsetParam) return Number(offsetParam)
  if (!pageParam) return undefined

  const page = Number(pageParam)
  if (!Number.isFinite(page) || page < 1) return undefined
  return Math.floor(page - 1) * (limit ?? DEFAULT_PAGE_SIZE)
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
  const limit = limitParam ? Number(limitParam) : undefined
  const offset = resolveOffset(c.req.query('offset'), c.req.query('page'), limit)
  const aggregate = parseAggregateParam(c.req.query('aggregate'))
  const groupBy = c.req.query('groupBy')

  return { includeDeleted, format, timezone, sort, fields, limit, offset, aggregate, groupBy }
}
