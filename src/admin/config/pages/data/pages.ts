/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// Analytics — the audience of the operator's own pages.
//
// A flat Plausible-style dashboard, not an object rail: audience is app-wide,
// and there is no "pick a page first". Six panels, every one of them a generic
// system-bound component over an endpoint that already shipped.
//
// ─── WHAT IT TOOK TO WRITE THIS AS CONFIG ──────────────────────────────────
//
// One thing, and it is the reason this surface stayed a builder longest: every
// `/api/analytics/*` reader requires ABSOLUTE ISO `from` / `to`, while a
// `dataSource.system.query` value is a static literal. "Thirty days back, ending
// now" was not expressible in config at all, so the builder computed it in
// TypeScript and baked it into ten panels.
//
// `page.window` closes exactly that: a closed list of look-back presets,
// resolved ONCE per render into `$window.start` / `$window.end` /
// `$window.granularity`. Once per render is the load-bearing half — a page whose
// panels each resolved `now` for themselves would drift their windows apart by
// however long the render took, and a surface reporting two periods at once
// invites the operator to compare them.
//
// ─── WHY ONE PRESET, AND NO PERIOD RAIL ────────────────────────────────────
//
// The retired builder had no period selector: the window was fixed at 30 days,
// and its own comment called that a deferred platform gap. Declaring the three
// presets the Links console offers would be a NEW capability on this surface,
// not a migration of the old one — it changes what an operator can do, moves the
// `@regression` screenshot baseline, and is a product decision rather than a
// mechanical one. So this declares the window the surface actually has, which
// is what makes `$window.*` usable here without changing a single byte of the
// rendered document.
//
// Adding `{ id: '24h' }` and `{ id: '7d' }` plus a `link` rail marked with
// `activeWhen` is a two-part edit the day that decision is taken.
//
// ─── EVERY LITERAL IS COPIED, NOT CHOSEN ───────────────────────────────────
//
// The `@regression` test takes an UNMASKED full-page screenshot, so every string
// on this page is pixel-pinned — including the six section headings, every
// column header and every empty message, none of which any locator names. They
// are reproduced verbatim from the retired builder for that reason.

import { sectionCard } from '../../components/dashboard-blocks'
import {
  consolePage,
  kpiStrip,
  pageHeading,
  tabbedBody,
  tabPanel,
  tabQuery,
} from '../../components/data-page'
import { dataTable } from '../../components/data-table-blocks'
import {
  ANALYTICS_CAMPAIGNS_ENDPOINT,
  ANALYTICS_DEVICES_ENDPOINT,
  ANALYTICS_EVENTS_ENDPOINT,
  ANALYTICS_OVERVIEW_ENDPOINT,
  ANALYTICS_PAGES_ENDPOINT,
  ANALYTICS_REFERRERS_ENDPOINT,
} from '../../system-sources'
import { footprintBody } from './footprint'
import type { Page as PageConfig } from '@/domain/models/app'

/** One node of a page's component tree, as the config type expresses it. */
type PageComponent = NonNullable<PageConfig['components']>[number]

/**
 * The window every panel reads at, spelled once.
 *
 * `granularity` is deliberately ABSENT from the five breakdown reads: the
 * retired builder sent it only to `/overview`, and the readers that ignore it
 * would still see a different query string — which would split the request the
 * system-value hook otherwise dedupes.
 */
const WINDOW = { from: '$window.start', to: '$window.end' } as const

/** The overview's window, which additionally carries the time-series bucket width. */
const OVERVIEW_WINDOW = { ...WINDOW, granularity: '$window.granularity' } as const

/**
 * The lede, which has to track whether the page can show anything.
 *
 * Promising "views, visitors, sessions, the trend over time…" directly above an
 * "Analytics is not enabled" panel reads as a broken page rather than an
 * unconfigured one: the reader cannot tell whether the numbers are missing or
 * merely off. Two intros, each gated on the HOST app's declaration, is what
 * makes exactly one of them reach the document — `declares` EXCLUDES rather
 * than hiding, so the h1 count stays 1.
 */
const enabledIntro = (): PageComponent => ({
  ...(pageHeading('$t:admin.pages.heading', '$t:admin.pages.blurb') as Record<string, unknown>),
  visibility: { declares: 'analytics' },
})

// Painted, like the enabled intro and every console page. On an app that collects no
// analytics the route is its Footprint half alone, and the page opens on that
// half rather than on a notice about the half it does not have. The sentence
// still names the page and says analytics is off for a reader that asks.
const disabledIntro = (): PageComponent => ({
  ...(pageHeading('$t:admin.pages.heading', '$t:admin.pages.blurbDisabled') as Record<
    string,
    unknown
  >),
  visibility: { unlessDeclares: 'analytics' },
})

/**
 * One audience figure, read as a pre-computed scalar from the overview envelope.
 *
 * The label paints as visible text in the SSR skeleton, before the shared fetch
 * settles. All three tiles share ONE request: the system-value hook keys its
 * cache on the endpoint AND the query, and deliberately not on the value path —
 * which is why {@link OVERVIEW_WINDOW} is one object rather than three
 * equivalent literals.
 */
const kpiTile = (label: string, valuePath: string): PageComponent =>
  sectionCard({
    label,
    endpoint: ANALYTICS_OVERVIEW_ENDPOINT,
    valuePath,
    system: { query: OVERVIEW_WINDOW },
  })

/** The KPI strip: a named region over the three audience figures. */
const audienceFigures = (): PageComponent =>
  kpiStrip('$t:admin.pages.metrics.region', [
    kpiTile('$t:admin.analytics.pageViews', 'summary.pageViews'),
    kpiTile('$t:admin.analytics.uniqueVisitors', 'summary.uniqueVisitors'),
    kpiTile('$t:admin.analytics.sessions', 'summary.sessions'),
  ])

/**
 * The audience timeseries, bound to the overview's TOP-LEVEL `timeSeries`.
 *
 * The chart hook reads `json[rowsKey]` as a plain key and never a dotted path,
 * which is why no admin overview endpoint's NESTED series block has ever been
 * chartable — and the trap is silent: a nested envelope binds to nothing and
 * renders an empty chart with no error anywhere.
 *
 * The `emptyState` is the honest answer to a window with nothing in it. A flat
 * line at zero reads as "measured, and it was zero", which is a different claim
 * from "no visits were recorded" — and the second is the only one the endpoint
 * supports.
 */
const audienceChart = (): PageComponent =>
  ({
    type: 'chart',
    props: { 'aria-label': '$t:admin.pages.trend.region' },
    dataSource: {
      system: {
        endpoint: ANALYTICS_OVERVIEW_ENDPOINT,
        rowsKey: 'timeSeries',
        query: OVERVIEW_WINDOW,
      },
    },
    chartType: 'area',
    xAxis: { field: 'period', format: 'date' },
    // Horizontal rules only, no axis baselines: shadcn's chart anatomy.
    yAxis: { field: 'pageViews', gridLines: true },
    series: [
      { field: 'pageViews', label: '$t:admin.analytics.pageViews' },
      { field: 'uniqueVisitors', label: '$t:admin.analytics.uniqueVisitors' },
      { field: 'sessions', label: '$t:admin.analytics.sessions' },
    ],
    emptyState: {
      role: 'region',
      name: '$t:admin.common.noData',
      title: '$t:admin.analytics.noVisits',
    },
  }) as PageComponent

/**
 * A read-only system-source grid over one reader.
 *
 * Every breakdown below is the same shape — an endpoint, a `rowsKey`, an
 * identity field, explicit columns — so they are built from one helper rather
 * than seven near-copies. A system-source grid keeps its native `<table>` role
 * and accessible name, so each resolves as `table "<label>"`.
 *
 * `idKey` is the row's identity. Where a reader's identity field is NULLABLE
 * (`referrers.domain` is null for direct traffic; every `campaigns.*` field is
 * null for untagged traffic) two such rows would normalize onto the same `id` —
 * `parseSystemEnvelope` maps `row[idKey]` onto `id` with no index fallback. Each
 * reader groups its rows, so the null bucket collapses to at most one row per
 * grid; that is an observed property of the queries rather than a guarantee the
 * schema makes, and it is recorded here so a future grouping change is caught.
 */
const breakdown = (config: {
  readonly label: string
  readonly endpoint: string
  readonly rowsKey: string
  readonly idKey: string
  readonly columns: readonly Record<string, unknown>[]
  readonly emptyMessage: string
}): PageComponent =>
  dataTable({
    props: { 'aria-label': config.label },
    dataSource: {
      system: {
        endpoint: config.endpoint,
        rowsKey: config.rowsKey,
        idKey: config.idKey,
        query: WINDOW,
      },
    },
    columns: config.columns,
    emptyMessage: config.emptyMessage,
  }) as PageComponent

/** A labelled section wrapping one or more panels, with its own heading. */
const panelSection = (label: string, children: readonly PageComponent[]): PageComponent =>
  ({
    type: 'container',
    element: 'section',
    props: { className: 'flex flex-col gap-3', 'aria-label': label },
    children: [
      {
        type: 'text',
        element: 'h3',
        props: { className: 'text-foreground text-md font-medium' },
        content: label,
      },
      ...children,
    ],
  }) as PageComponent

/** Visits and share, the shape the device / browser / OS readers return. */
const TECHNOLOGY_COLUMNS = [
  { field: 'name', label: '$t:admin.common.name' },
  { field: 'count', label: '$t:admin.analytics.visits', align: 'right' },
  // The endpoint already returns a scaled percentage (33.33, not 0.3333) and
  // there is no formatter that leaves an already-scaled number alone — so the
  // unit lives in the header rather than being applied twice to the cell.
  { field: 'percentage', label: '$t:admin.analytics.share', align: 'right' },
]

/** The most-viewed pages over the window. */
const topPages = (): PageComponent =>
  breakdown({
    label: '$t:admin.pages.top.region',
    endpoint: ANALYTICS_PAGES_ENDPOINT,
    rowsKey: 'pages',
    idKey: 'path',
    columns: [
      { field: 'path', label: '$t:admin.analytics.page' },
      { field: 'pageViews', label: '$t:admin.analytics.views', align: 'right' },
      { field: 'uniqueVisitors', label: '$t:admin.analytics.visitors', align: 'right' },
    ],
    emptyMessage: '$t:admin.analytics.noPages',
  })

/**
 * Acquisition: where the audience came from. Referrers and campaigns sit
 * side-by-side because an operator reads them together — a spike in one is
 * usually explained by the other.
 */
const acquisitionSection = (): PageComponent =>
  panelSection('$t:admin.pages.acquisition.heading', [
    {
      type: 'container',
      props: { className: 'grid grid-cols-1 gap-4 lg:grid-cols-2' },
      children: [
        breakdown({
          label: '$t:admin.pages.referrers.region',
          endpoint: ANALYTICS_REFERRERS_ENDPOINT,
          rowsKey: 'referrers',
          idKey: 'domain',
          columns: [
            { field: 'domain', label: '$t:admin.analytics.referrer' },
            { field: 'pageViews', label: '$t:admin.analytics.views', align: 'right' },
            { field: 'uniqueVisitors', label: '$t:admin.analytics.visitors', align: 'right' },
          ],
          emptyMessage: '$t:admin.pages.noReferrers',
        }),
        breakdown({
          label: '$t:admin.pages.campaigns.region',
          endpoint: ANALYTICS_CAMPAIGNS_ENDPOINT,
          rowsKey: 'campaigns',
          idKey: 'campaign',
          columns: [
            { field: 'campaign', label: '$t:admin.analytics.campaign' },
            { field: 'source', label: '$t:admin.common.source' },
            { field: 'medium', label: '$t:admin.analytics.medium' },
            { field: 'pageViews', label: '$t:admin.analytics.views', align: 'right' },
          ],
          emptyMessage: '$t:admin.pages.noCampaigns',
        }),
      ],
    } as PageComponent,
  ])

/**
 * Technology: the device / browser / OS split. Three grids over ONE `/devices`
 * response — three arrays in one envelope — so the three panels cost a single
 * request.
 */
const technologySection = (): PageComponent =>
  panelSection('$t:admin.pages.technology.heading', [
    {
      type: 'container',
      props: { className: 'grid grid-cols-1 gap-4 lg:grid-cols-3' },
      children: [
        breakdown({
          label: '$t:admin.pages.devices.region',
          endpoint: ANALYTICS_DEVICES_ENDPOINT,
          rowsKey: 'deviceTypes',
          idKey: 'name',
          columns: TECHNOLOGY_COLUMNS,
          emptyMessage: '$t:admin.analytics.noDevices',
        }),
        breakdown({
          label: '$t:admin.pages.browsers.region',
          endpoint: ANALYTICS_DEVICES_ENDPOINT,
          rowsKey: 'browsers',
          idKey: 'name',
          columns: TECHNOLOGY_COLUMNS,
          emptyMessage: '$t:admin.analytics.noBrowsers',
        }),
        breakdown({
          label: '$t:admin.pages.os.region',
          endpoint: ANALYTICS_DEVICES_ENDPOINT,
          rowsKey: 'operatingSystems',
          idKey: 'name',
          columns: TECHNOLOGY_COLUMNS,
          emptyMessage: '$t:admin.analytics.noOs',
        }),
      ],
    } as PageComponent,
  ])

/**
 * The event log: every analytics event recorded in the window, newest first.
 *
 * Named "Event log" rather than "Custom events" ON PURPOSE. The endpoint takes
 * an optional `event_type` filter but applies NONE by default, so the feed
 * carries `page_view` rows alongside author-emitted ones — a panel titled
 * "Custom events" over that feed would be a wrong-answer label. Page views ARE
 * events; the `Type` column is what separates them, and the operator can read
 * it. Filtering to one type would mean hardcoding a value out of a free-form
 * vocabulary (`event_type` is an arbitrary string, not an enum).
 *
 * Field names are `snake_case` because THIS reader's projection is snake_case,
 * unlike every other admin endpoint the console binds. That inconsistency is
 * recorded rather than papered over: camelCase bindings render blank cells,
 * which is exactly how it was found.
 */
const eventLogSection = (): PageComponent =>
  panelSection('$t:admin.pages.events.heading', [
    breakdown({
      label: '$t:admin.pages.events.heading',
      endpoint: ANALYTICS_EVENTS_ENDPOINT,
      rowsKey: 'events',
      idKey: 'id',
      columns: [
        { field: 'event_name', label: '$t:admin.analytics.event' },
        { field: 'event_type', label: '$t:admin.common.type' },
        { field: 'timestamp', label: '$t:admin.analytics.recorded', format: 'datetime' },
      ],
      emptyMessage: '$t:admin.analytics.noEvents',
    }),
  ])

/** The live body — everything that needs a reachable `/api/analytics/*`. */
const liveBody = (): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    visibility: { declares: 'analytics' },
    props: { className: 'flex flex-col gap-8 pt-2' },
    children: [
      audienceFigures(),
      audienceChart(),
      topPages(),
      acquisitionSection(),
      technologySection(),
      eventLogSection(),
    ],
  }) as PageComponent

/**
 * The two halves of this route, and the `?tab=` value that addresses each.
 *
 * Audience, then cost. Pages reports who this instance served and Footprint
 * reports what serving them consumed — one question asked twice. Reading the
 * second is always a consequence of reading the first, so the first opens by
 * default.
 */
const TABS = [
  { id: 'pages', label: '$t:admin.common.pages' },
  { id: 'footprint', label: '$t:admin.analytics.footprint' },
] as const

/** The one half an app serving no page of its own has: what the instance spends. */
const FOOTPRINT_ONLY = [{ id: 'footprint', label: '$t:admin.analytics.footprint' }] as const

/**
 * The Pages panel: the audience of the operator's own pages.
 *
 * Only ever drawn where every one of its reads answers — see {@link withPages}
 * — so it carries the live components alone and no "not enabled" fallback.
 */
const pagesPanel = (): PageComponent => tabPanel([liveBody()])

/**
 * The strip, in two shapes under complementary gates.
 *
 * The audience half needs two things at once: an app that collects analytics,
 * and a caller the `/api/analytics/*` readers answer — an admin-equivalent one.
 * Missing either, the Pages tab could only ever open on an empty or refused
 * report, so the route is its Footprint half alone. The lede above says why
 * when the app collects nothing; a viewer is simply not offered the audience.
 *
 * A tab set's panels are fixed per set, so the shapes are separate sets and
 * exactly one reaches the document. A component's visibility keys all have to
 * hold, so "either is missing" takes two Footprint-only copies.
 */
const withPages = (): PageComponent =>
  ({
    ...(tabbedBody('$t:admin.pages.tabs.region', TABS, [
      pagesPanel(),
      tabPanel([footprintBody()]),
    ]) as Record<string, unknown>),
    visibility: { declares: 'analytics', capability: 'administer-accounts' },
  }) as PageComponent

const footprintOnly = (visibility: Readonly<Record<string, string>>): PageComponent =>
  ({
    ...(tabbedBody('$t:admin.pages.tabs.region', FOOTPRINT_ONLY, [
      tabPanel([footprintBody()]),
    ]) as Record<string, unknown>),
    // Its one tab is always the open one: `?tab=` defaults to Pages for the
    // two-tab strip, and this strip has no such tab to open.
    defaultTab: 'footprint',
    visibility,
  }) as PageComponent

/**
 * `/analytics` — the audience of the operator's own pages, with its cost beside.
 *
 * The headings come in two under opposite gates, so exactly one reaches the
 * document and the `h1` count stays at 1 on an app with analytics off.
 *
 * `window` is declared even though only the Pages panel reads it: a
 * `$window.*` token resolves against the PAGE. The old `/pages` and
 * `/footprint` addresses answer a permanent move here (`config/redirects.ts`).
 */
const analyticsPage: PageConfig = consolePage({
  id: 'dashboard-data-pages',
  path: '/analytics',
  title: '$t:admin.meta.pages',
  body: [
    {
      type: 'container',
      element: 'div',
      children: [enabledIntro(), disabledIntro()],
    } as PageComponent,
    withPages(),
    footprintOnly({ unlessDeclares: 'analytics' }),
    footprintOnly({ declares: 'analytics', unlessCapability: 'administer-accounts' }),
  ],
  page: { window: { default: '30d', presets: [{ id: '30d' }] }, query: tabQuery(TABS) },
  shell: { breadcrumb: { analytics: '$t:admin.crumb.analytics' } },
})

export default [analyticsPage] satisfies readonly PageConfig[]
