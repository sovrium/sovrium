/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A single flattened view filter condition consumed by the data-table runtime
 * filter-builder UI.
 */
export type FlatViewFilter = {
  readonly field: string
  readonly operator: string
  readonly value: unknown
}

/**
 * A developer-configured view normalised for the data-table island Views menu.
 */
export type ResolvedDataTableView = {
  readonly id: string
  readonly name: unknown
  readonly filters?: ReadonlyArray<FlatViewFilter>
  readonly sorts?: unknown
  readonly groupBy?: unknown
}

/**
 * Flatten the top-level `{ and: [...] }` group of a view's recursive
 * `ViewFilterNode` into a flat list of `{ field, operator, value }` conditions.
 *
 * - A bare condition (no `and`/`or` wrapper) becomes a one-element list.
 * - The `{ and: [...] }` shape is expanded into its conditions (the only group
 *   shape consumed by the runtime filter-builder UI).
 * - Anything else (e.g. `{ or: [...] }` or nested groups) is omitted — too
 *   complex for the runtime filter-builder.
 */
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

/**
 * Normalise a view's `groupBy` (either a bare field-name string or a
 * `{ field }` object) into a plain field-name string.
 */
function normaliseGroupBy(view: Record<string, unknown>): string | undefined {
  const { groupBy } = view
  if (!groupBy) return undefined
  return typeof groupBy === 'string' ? groupBy : (groupBy as { readonly field?: string }).field
}

/**
 * Resolve developer-configured views from `app.tables[i].views[]` (PG-03 /
 * [internal ref]) into the shape the data-table island consumes to
 * surface read-only entries in its Views menu.
 *
 * SQL-backed views (those with a `query`) are skipped — they're backend
 * Postgres VIEWs, not data-table views. The schema's numeric `id` is normalised
 * to a string so the dropdown can key uniformly across developer + personal
 * sources.
 *
 * @param views - The resolved table's `views` array (may be undefined)
 * @returns Normalised data-table views, or undefined when no table is resolved
 */
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
