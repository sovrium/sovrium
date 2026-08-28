/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The panels the two Links surfaces share.
 *
 * The directory (`/_admin/links`) and one link's deep-dive
 * (`/_admin/links/{slug}`) render the same KPI tiles, the same trend chart and
 * the same breakdown-grid shape, differing only in whether the query carries
 * `&event_name={slug}`. They live here rather than in either surface so neither
 * imports the other — and so a change to the trend chart cannot land on one
 * surface and miss the other.
 */

import type { App } from '@/domain/models/app'
import type { Component } from '@/domain/models/app/pages/components'

/** The Links directory path — the base every period-selector link addresses. */
export const LINKS_CONSOLE_PATH = '/_admin/links'

/** The fixed, non-configurable base path a link is served at. */
export const LINK_PREFIX = '/l/'

/**
 * The analytics overview: totals plus a TOP-LEVEL `timeSeries`.
 *
 * The chart binds this endpoint specifically because of that top level. The
 * chart hook reads `json[rowsKey]` as a plain key, never a dotted path — which
 * is why no admin overview endpoint's NESTED `series` block has ever been
 * chartable, and the trap is silent: a nested envelope binds to nothing and
 * renders an empty chart with no error anywhere.
 */
export const ANALYTICS_OVERVIEW_ENDPOINT = '/api/analytics/overview'

/** The link catalog — definitions, never metrics ([internal ref] D6). */
export const CATALOG_ENDPOINT = '/api/admin/links'

/**
 * Whether the operator declared a live `analytics` block.
 *
 * When they did not, every `/api/analytics/*` endpoint 404s, so each metric
 * panel would degrade to a neutral placeholder and tell the operator nothing
 * about why. The surface says it instead, and still renders the catalog — link
 * definitions do not depend on analytics at all.
 *
 * Matches the predicate `api-routes.ts` gates those endpoints on, `false`
 * included: an explicit `analytics: false` unregisters them exactly like an
 * absent block.
 */
export function analyticsIsEnabled(app: App): boolean {
  return app.analytics !== undefined && app.analytics !== false
}

/**
 * One KPI tile reading a pre-computed scalar at `valuePath` from an endpoint's
 * envelope.
 *
 * Its label paints as visible text in the `kpi` SSR skeleton, before the shared
 * fetch settles. Tiles over the SAME endpoint + query collapse into ONE request:
 * the system-value hook keys its cache on the endpoint and query and NOT on the
 * per-tile value path. The cheap mistake — keying on the value path too — is
 * invisible except as N times the load, which is why the spec asserts the
 * request count rather than the rendered numbers.
 */
export function kpiTile(
  label: string,
  endpoint: string,
  valuePath: string,
  query?: Readonly<Record<string, string>>
): Component {
  return {
    type: 'kpi',
    label,
    dataSource: {
      system: { endpoint, valuePath, ...(query === undefined ? {} : { query }) },
    },
    kpiFormat: { type: 'number' },
  } as unknown as Component
}

/**
 * The click trend: a generic AREA `chart` over the overview's top-level
 * `timeSeries`.
 *
 * Its `emptyState` is the honest answer to a window with nothing in it. A flat
 * line at zero reads as "measured, and it was zero", which is a different claim
 * from "no clicks were recorded" — and the second is the only one the endpoint
 * actually supports. Present-when-empty, absent-when-populated.
 */
export function clickTrendChart(query: Readonly<Record<string, string>>): Component {
  return {
    type: 'chart',
    props: { 'aria-label': 'Link click trend' },
    dataSource: {
      system: { endpoint: ANALYTICS_OVERVIEW_ENDPOINT, rowsKey: 'timeSeries', query },
    },
    chartType: 'area',
    xAxis: { field: 'period', format: 'date' },
    series: [
      { field: 'pageViews', label: 'Clicks' },
      { field: 'uniqueVisitors', label: 'Unique visitors' },
    ],
    emptyState: {
      role: 'region',
      name: 'No data',
      title: 'No clicks recorded in this period',
    },
  } as unknown as Component
}

/**
 * A read-only system-source grid over one read endpoint.
 *
 * Every panel below is the same shape — an endpoint, a `rowsKey`, an identity
 * field and explicit columns — so they are built from one helper rather than
 * five near-copies. A system-source grid keeps its native `<table>` role and
 * accessible name, so each resolves as `table "<label>"`.
 */
export function systemGrid(config: {
  readonly label: string
  readonly endpoint: string
  readonly rowsKey: string
  readonly idKey: string
  readonly columns: ReadonlyArray<Record<string, unknown>>
  readonly emptyMessage: string
  readonly query?: Readonly<Record<string, string>>
}): Component {
  return {
    type: 'data-table',
    props: { 'aria-label': config.label },
    dataSource: {
      system: {
        endpoint: config.endpoint,
        rowsKey: config.rowsKey,
        idKey: config.idKey,
        ...(config.query === undefined ? {} : { query: config.query }),
      },
    },
    columns: config.columns,
    emptyMessage: config.emptyMessage,
  } as unknown as Component
}

/** A labelled section wrapping one or more panels, with its own heading. */
export function panelSection(label: string, children: ReadonlyArray<Component>): Component {
  return {
    type: 'container',
    element: 'section',
    props: { className: 'flex flex-col gap-3', 'aria-label': label },
    children: [
      {
        type: 'text',
        element: 'h3',
        props: { className: 'text-foreground text-sm font-medium' },
        content: label,
      },
      ...children,
    ],
  } as unknown as Component
}
