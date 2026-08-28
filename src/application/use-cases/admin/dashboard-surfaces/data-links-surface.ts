/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The Data-tab **Links** surface.
 *
 * `/_admin/links` answers the two questions config-as-code cannot: _which of my
 * links is my audience actually using_, and _which link is the one I need to
 * change right now_. `/_admin/links/{slug}` is one link's deep-dive
 * ({@link ./data-links-detail-surface}).
 *
 * Like every other console surface it is SYNTHESIZED CONFIG, not bespoke React —
 * a `Page` tree of generic `kpi` / `chart` / `data-table` components bound to
 * endpoints by `dataSource.system`. That matters here for a specific reason:
 * nothing on this surface is new machinery, so nothing about it can drift from
 * how Records, Files or Analytics behave.
 *
 * ─── IT IS A FLAT DIRECTORY — NO FIRST-OBJECT REDIRECT ──────────────────────
 *
 * Records, Submissions and Files 302 a bare `/_admin/{key}` to their first
 * object because their object list is config-bounded and the sidebar enumerates
 * it. The links population is unbounded and database-backed: there is no
 * meaningful "first link", enumerating hundreds of rows in a 256px sidebar
 * disclosure would be hostile, and the operator's first question is cross-link
 * anyway. `users`, `connections`, `pages` and `footprint` are flat for the same
 * reason, and Links joins them.
 *
 * ─── EVERY METRIC COMES FROM THE ANALYTICS READERS ──────────────────────────
 *
 * The KPI strip and the trend chart bind `/api/analytics/overview` with
 * `?event_type=link_click`; the deep-dive adds `&event_name={slug}` and three
 * more existing readers. There is NO `/api/admin/links/overview` and no
 * `/api/admin/links/:slug/clicks`, however natural they look: a second
 * aggregation path over the same click rows would eventually disagree with the
 * first ([internal ref] D6). The ONE new endpoint the surface binds is the CATALOG —
 * `GET /api/admin/links` — and it lists definitions, not metrics.
 */

import { homeCrumb, wrapInShell } from './dashboard-shell-surface'
import { buildDataLinkDetailPage } from './data-links-detail-surface'
import {
  analyticsIsEnabled,
  ANALYTICS_OVERVIEW_ENDPOINT,
  CATALOG_ENDPOINT,
  clickTrendChart,
  kpiTile,
  LINKS_CONSOLE_PATH,
} from './data-links-panels'
import { analyticsQuery, periodSelector, resolveLinksWindow, windowCopy } from './data-links-window'
import { dataPageIntro } from './data-object-rail'
import type { DataShellOptions } from './data-landing-surface'
import type { LinksWindow } from './data-links-window'
import type { App } from '@/domain/models/app'
import type { Page } from '@/domain/models/app/pages'
import type { Component } from '@/domain/models/app/pages/components'

/** The directory intro: heading + orienting one-liner. */
function intro(): Component {
  return dataPageIntro(
    'Links',
    'Read how your short links are performing, and open the one you need to change. The figures come from the same click store the Analytics surface reads; the catalog below lists every link this instance serves, whether it was declared in config or minted here.'
  )
}

/**
 * The metrics region: the window it covers, then the four figures.
 *
 * Three of the four read the analytics overview and collapse into ONE request.
 * The fourth reads the catalog's `total` — a population figure rather than a
 * click figure, and it belongs beside them because "412 clicks" means something
 * different across 3 links and across 300.
 */
function metricsRegion(active: LinksWindow): Component {
  const query = analyticsQuery(active)
  return {
    type: 'container',
    element: 'section',
    props: { className: 'flex flex-col gap-3 pt-2', 'aria-label': 'Link metrics' },
    children: [
      windowCopy(active),
      {
        type: 'container',
        props: { className: 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4' },
        children: [
          kpiTile('Clicks', ANALYTICS_OVERVIEW_ENDPOINT, 'summary.pageViews', query),
          kpiTile('Unique visitors', ANALYTICS_OVERVIEW_ENDPOINT, 'summary.uniqueVisitors', query),
          kpiTile('Sessions', ANALYTICS_OVERVIEW_ENDPOINT, 'summary.sessions', query),
          kpiTile('Links tracked', CATALOG_ENDPOINT, 'total'),
        ],
      } as unknown as Component,
    ],
  } as unknown as Component
}

/**
 * The catalog columns an operator scans.
 *
 * `source` decides what the console may offer, so it is a rendered column rather
 * than a detail-page footnote: a `config` link is declared in a file the console
 * may not write and its mutation endpoints answer 409, so no Edit or Delete
 * affordance is painted for it at all. Painting a control the backend refuses is
 * a defect, not a cosmetic issue ([internal ref] D2).
 *
 * `state` is derived by the resolver — the SAME function the redirect handler
 * uses — so the grid can never report `active` for a link whose visitors get a
 * 410. `scheduled` and `expired` stay distinct rather than collapsing into
 * "inactive": they call for opposite actions.
 */
const CATALOG_COLUMNS = [
  { field: 'shortUrl', label: 'Short link' },
  { field: 'title', label: 'Title' },
  { field: 'destination', label: 'Destination', format: 'truncate' },
  { field: 'source', label: 'Source', valueLabels: { config: 'Config', db: 'Console' } },
  {
    field: 'state',
    label: 'State',
    valueLabels: {
      active: 'Active',
      disabled: 'Disabled',
      scheduled: 'Scheduled',
      expired: 'Expired',
      exhausted: 'Exhausted',
      archived: 'Archived',
    },
  },
  { field: 'validUntil', label: 'Expires', format: 'datetime' },
] as const

/**
 * The catalog grid: a read-only system-source `data-table` over
 * `GET /api/admin/links`.
 *
 * Rows are keyed on `slug` (the catalog's identity and its cursor sort key) and
 * read from the TOP-LEVEL `items` key — a nested envelope would bind to nothing,
 * silently, and render an empty grid with no error anywhere.
 *
 * Narrowing goes to the SERVER: the endpoint applies `?q=` over slug, title and
 * destination and echoes `appliedQuery`, which is the signal that tells the grid
 * not to re-filter the page it was handed. Without that echo a client would
 * narrow an already-narrowed page and hide matches living on the next one — and
 * only ever on fields that happen to be rendered columns, which is how that
 * class of bug stays invisible.
 *
 * The `search` block must be PRESENT for the box to render: `toolbar.search`
 * alone leaves the grid with no input at all, the same trap
 * `data-buckets-surface` and `table-data-surface` both record.
 *
 * No `pagination` block, deliberately: the endpoint pages by opaque CURSOR while
 * the grid's pager speaks `page=N`. Declaring one would render a control whose
 * second page returns the first — the same lying pager the connections and
 * DB-table grids were fixed for.
 */
function catalogGrid(): Component {
  return {
    type: 'data-table',
    props: { id: 'admin-links-catalog', 'aria-label': 'Link catalog' },
    dataSource: {
      system: { endpoint: CATALOG_ENDPOINT, rowsKey: 'items', idKey: 'slug', totalKey: 'total' },
    },
    columns: CATALOG_COLUMNS,
    search: { enabled: true, placeholder: 'Search links' },
    toolbar: { search: true, sort: true },
    emptyMessage: 'No links yet',
    noMatchMessage: 'No link matches “{query}”',
  } as unknown as Component
}

/**
 * The static "analytics not enabled" note. The catalog still renders beneath it:
 * link DEFINITIONS do not depend on analytics, and hiding them would be a worse
 * answer than an honest gap where the metrics would be.
 */
function analyticsDisabledNote(): Component {
  return {
    type: 'container',
    element: 'section',
    props: {
      'aria-label': 'Link metrics unavailable',
      className:
        'border-border bg-background-raised mt-2 flex flex-col gap-2 rounded-lg border p-6',
    },
    children: [
      {
        type: 'text',
        element: 'p',
        props: { className: 'text-foreground text-sm font-medium' },
        content: 'Click metrics are not available',
      },
      {
        type: 'text',
        element: 'p',
        props: { className: 'text-foreground-muted max-w-xl text-sm leading-relaxed' },
        content:
          'Link clicks are recorded through the built-in analytics engine. Enable analytics in your app config to measure them — the catalog below works either way.',
      },
    ],
  } as unknown as Component
}

/** The directory body: metrics + trend over the active window, then the catalog. */
function directoryBody(app: App, active: LinksWindow): Component {
  const metrics = analyticsIsEnabled(app)
    ? [
        periodSelector(LINKS_CONSOLE_PATH, active),
        metricsRegion(active),
        clickTrendChart(analyticsQuery(active)),
      ]
    : [analyticsDisabledNote()]
  return {
    type: 'container',
    element: 'div',
    props: { className: 'flex flex-col gap-6 pt-2' },
    children: [...metrics, catalogGrid()],
  } as unknown as Component
}

/**
 * Build the Links surface: the flat directory, or one link's deep-dive when the
 * path carries an object segment.
 *
 * NEVER a `DataObjectRedirect` — see the flat-directory note at the top of this
 * module.
 */
export function buildDataLinksPage(
  app: App,
  object: string | undefined,
  options: DataShellOptions,
  period?: string
): Page {
  const active = resolveLinksWindow(period)
  if (object !== undefined) return buildDataLinkDetailPage(app, object, options, active)
  return {
    id: 'dashboard-data-links',
    name: 'dashboard-data-links',
    path: '/links',
    meta: { title: 'Sovrium — Data · Links' },
    components: wrapInShell([intro(), directoryBody(app, active)], {
      canEdit: options.canEdit,
      appName: options.appName,
      appVersion: options.appVersion,
      breadcrumb: [homeCrumb(options.appName), { label: 'Links', href: LINKS_CONSOLE_PATH }],
    }),
  } as Page
}
