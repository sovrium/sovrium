/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { SELECT_OPTION_SOURCE_DEFAULT_LIMIT } from '@/domain/models/app/pages/components/component-types/form-controls/select-option-source'
import type { SelectSystemOptionSource } from '@/domain/models/app/pages/components/component-types/form-controls/select-option-source'
import type { OptionItem } from '@/domain/models/app/pages/components/shared-schemas'
import type { SystemRowsFetcher } from '@/presentation/render/resolve/first-object-redirect-resolver'

/**
 * Resolve a choice control's options from a SYSTEM read endpoint.
 *
 * ─── WHY AN ENDPOINT AND NOT A TABLE ───────────────────────────────────────
 *
 * The values a control most often needs to offer are not rows of a table. The
 * roles a caller may assign are computed from the auth config and stored
 * nowhere; an app's automation, agent and table names are the same shape —
 * facts ABOUT the operator's configuration, already served by a read endpoint
 * and unreachable from `{ table, displayField }`.
 *
 * ─── WHY THE ROWS ARE READ SERVER-SIDE ─────────────────────────────────────
 *
 * The caller's own credentials are borrowed for the read (`SystemRowsFetcher`),
 * so a control never offers rows its reader could not see, and the endpoint
 * itself never reaches the client bundle — an admin endpoint in a serialised
 * island prop is exactly what rule S4 forbids, and would let a reader enumerate
 * the admin surface from the page source.
 *
 * ─── DEFAULTS, AND WHY THESE ──────────────────────────────────────────────
 *
 * `rowsKey` and `idKey` default to the shared rows-envelope values (`items`,
 * `id`) so one contract describes every consumer that reads rows. `valueKey`
 * falls back to `idKey` because a system row's identity is what an option
 * submits — a role picker declares `name` precisely because its identity is not.
 */

/** Envelope defaults, shared with every other rows consumer. */
const DEFAULT_ROWS_KEY = 'items'
const DEFAULT_ID_KEY = 'id'

/**
 * Hard ceiling on the resolved list, mirroring the schema's `limit` bound.
 * Applied again here because the resolver must stay bounded even if it is ever
 * called with a config that bypassed decode — the list is server-rendered into
 * the page, so an unbounded read inlines the endpoint's whole corpus into HTML.
 */
const MAX_RESOLVED_OPTIONS = 1000

/**
 * Fetch and project a system source into a concrete option list.
 *
 * Returns an EMPTY array for every unresolved case — no fetcher (a caller with
 * no HTTP context: a unit test, a static build), a failed read, an endpoint the
 * caller may not see. Fail-closed and silent is the right degradation here: the
 * control still renders, and an error would turn one unreachable endpoint into
 * a blank page (anti-enumeration, rule S1).
 */
export async function resolveSystemOptions(
  binding: SelectSystemOptionSource,
  fetchSystemRows: SystemRowsFetcher | undefined
): Promise<readonly OptionItem[]> {
  if (fetchSystemRows === undefined) return []

  const { system, labelKey } = binding
  const idKey = system.idKey ?? DEFAULT_ID_KEY
  const valueKey = binding.valueKey ?? idKey
  const rows = await fetchSystemRows(
    withStaticQuery(system.endpoint, system.query),
    system.rowsKey ?? DEFAULT_ROWS_KEY
  ).catch(() => [])

  const limit = Math.min(binding.limit ?? SELECT_OPTION_SOURCE_DEFAULT_LIMIT, MAX_RESOLVED_OPTIONS)
  return rows
    .slice(0, limit)
    .map((row) => toOption(row, labelKey, valueKey))
    .filter((option): option is OptionItem => option !== undefined)
}

/**
 * Append the source's STATIC query parameters to its endpoint.
 *
 * Built on the string rather than through `URL` because the endpoint is a
 * ROOT-RELATIVE path with no origin at this layer; the fetcher resolves it
 * against the request URL. Values are percent-encoded, so a parameter carrying
 * a `&` cannot inject a second one.
 */
function withStaticQuery(
  endpoint: string,
  query: Readonly<Record<string, string | number | boolean>> | undefined
): string {
  if (query === undefined) return endpoint
  const entries = Object.entries(query)
  if (entries.length === 0) return endpoint
  const search = entries
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&')
  return `${endpoint}${endpoint.includes('?') ? '&' : '?'}${search}`
}

/**
 * Project one row into an option.
 *
 * A row whose label or value is nullish is DROPPED rather than rendered as an
 * empty choice, matching the table-backed projection: a blank row in a dropdown
 * is a control the user cannot reason about, and `String(null)` would paint the
 * literal text `null`.
 */
function toOption(
  row: Readonly<Record<string, unknown>>,
  labelKey: string,
  valueKey: string
): OptionItem | undefined {
  const label = row[labelKey]
  const value = row[valueKey]
  if (label === null || label === undefined) return undefined
  if (value === null || value === undefined) return undefined
  return { label: String(label), value: String(value) }
}
