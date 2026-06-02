/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

export type FlatViewFilter = {
  readonly field: string
  readonly operator: string
  readonly value: unknown
}

export type ResolvedDataTableView = {
  readonly id: string
  readonly name: unknown
  readonly filters?: ReadonlyArray<FlatViewFilter>
  readonly sorts?: unknown
  readonly groupBy?: unknown
}

function flattenViewFilters(filters: unknown): ReadonlyArray<FlatViewFilter> | undefined {
  if (!filters || typeof filters !== 'object') return undefined
  const obj = filters as Record<string, unknown>

  if (typeof obj['field'] === 'string') {
    return [
      {
        field: obj['field'],
        operator: String(obj['operator'] ?? 'equals'),
        value: obj['value'],
      },
    ]
  }

  if (Array.isArray(obj['and'])) {
    return (obj['and'] as ReadonlyArray<Record<string, unknown>>)
      .filter((c) => typeof c['field'] === 'string')
      .map((c) => ({
        field: c['field'] as string,
        operator: String(c['operator'] ?? 'equals'),
        value: c['value'],
      }))
  }

  return undefined
}

function normaliseGroupBy(view: Record<string, unknown>): string | undefined {
  const { groupBy } = view
  if (!groupBy) return undefined
  return typeof groupBy === 'string' ? groupBy : (groupBy as { readonly field?: string }).field
}

export function resolveDataTableViews(
  views: ReadonlyArray<Record<string, unknown>> | undefined
): ReadonlyArray<ResolvedDataTableView> | undefined {
  if (!views) return undefined

  return views
    .filter((v) => !('query' in v) || !v['query'])
    .map((v) => {
      const flatFilters = flattenViewFilters(v['filters'])
      const groupByCandidate = normaliseGroupBy(v)

      return {
        id: String(v['id']),
        name: v['name'],
        ...(flatFilters && flatFilters.length > 0 ? { filters: flatFilters } : {}),
        ...('sorts' in v && v['sorts'] ? { sorts: v['sorts'] } : {}),
        ...(groupByCandidate ? { groupBy: groupByCandidate } : {}),
      }
    })
}
