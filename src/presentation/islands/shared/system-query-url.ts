/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The shared shape every system-source binding carries for a STATIC read request:
 * a required `endpoint` plus optional static `query` params. Both
 * `KpiSystemSource` (scalar value-path) and `ChartSystemSource` (rows/series)
 * satisfy this structurally — they legitimately differ in everything else
 * (valuePath/valueTemplate vs rowsKey), but the URL they build from `endpoint` +
 * static `query` is identical.
 *
 * NOTE: this is intentionally NOT used by the data-table system source. The grid
 * (`use-data-table-query.ts#buildSystemQueryString`) merges THREE param sources
 * (static `query` + dynamic external-filter params with empty-clears-param
 * semantics + read-side page/sort/search) and returns a query string, not a full
 * URL — a different concern, kept separate by design.
 */
interface SystemQuerySource {
  readonly endpoint: string
  readonly query?: Readonly<Record<string, string | number | boolean>> | undefined
}

/**
 * Builds the request URL for a system read endpoint, merging the static `query`
 * params onto the endpoint path. Shared by the KPI value-path hook
 * (`useKpiSystemValue`) and the chart rows/series hook (`useChartSystemRecords`).
 */
export function buildSystemQueryUrl(system: SystemQuerySource): string {
  const params = new URLSearchParams()
  Object.entries(system.query ?? {}).forEach(([key, value]) => {
    params.set(key, String(value))
  })
  const suffix = params.toString()
  return `${system.endpoint}${suffix ? `?${suffix}` : ''}`
}
