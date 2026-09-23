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

import { pageHeading, tabQuery, tabbedBody, tabPanel } from '../../components/data-page'
import { withShell } from '../../components/shell'
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

const disabledIntro = (): PageComponent => ({
  ...(pageHeading('$t:admin.pages.heading', '$t:admin.pages.blurbDisabled') as Record<
    string,
    unknown
  >),
  visibility: { unlessDeclares: 'analytics' },
})

/**
 * The "analytics not enabled" state.
 *
 * A static named region, and NO live components: when the operator declares no
 * `analytics` block every `/api/analytics/*` endpoint is unregistered, so each
 * panel would degrade to a neutral placeholder that tells the operator nothing
 * about why. The surface says it instead.
 */
const disabledRegion = (): PageComponent =>
  ({
    type: 'container',
    element: 'section',
    visibility: { unlessDeclares: 'analytics' },
    props: {
      'aria-label': '$t:admin.pages.disabled.region',
      className:
        'border-border bg-background-raised mt-2 flex flex-col items-center gap-2 rounded-lg border p-10 text-center',
    },
    children: [
      {
        type: 'text',
        element: 'p',
        props: { className: 'text-foreground text-md font-medium' },
        content: '$t:admin.pages.disabled.heading',
      },
      {
        type: 'text',
        element: 'p',
        props: { className: 'text-foreground-muted max-w-md text-md leading-relaxed' },
        content: '$t:admin.pages.disabled.body',
      },
      {
        type: 'text',
        element: 'p',
        props: { className: 'text-foreground-subtle mt-1 max-w-md text-md italic' },
        content: '$t:admin.pages.disabled.hint',
      },
    ],
  }) as PageComponent

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
  ({
    type: 'kpi',
    label,
    dataSource: {
      system: { endpoint: ANALYTICS_OVERVIEW_ENDPOINT, valuePath, query: OVERVIEW_WINDOW },
    },
    kpiFormat: { type: 'number' },
  }) as PageComponent

/** The KPI strip: a named region over the three audience figures. */
const kpiStrip = (): PageComponent =>
  ({
    type: 'container',
    element: 'section',
    props: { className: 'pt-2', 'aria-label': '$t:admin.pages.metrics.region' },
    children: [
      {
        type: 'container',
        props: { className: 'grid grid-cols-1 gap-4 sm:grid-cols-3' },
        children: [
          kpiTile('Page views', 'summary.pageViews'),
          kpiTile('Unique visitors', 'summary.uniqueVisitors'),
          kpiTile('Sessions', 'summary.sessions'),
        ],
      },
    ],
  }) as PageComponent

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
    series: [
      { field: 'pageViews', label: 'Page views' },
      { field: 'uniqueVisitors', label: 'Unique visitors' },
      { field: 'sessions', label: 'Sessions' },
    ],
    emptyState: { role: 'region', name: 'No data', title: 'No visits in this period' },
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
  ({
    type: 'table',
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
  { field: 'name', label: 'Name' },
  { field: 'count', label: 'Visits', align: 'right' },
  // The endpoint already returns a scaled percentage (33.33, not 0.3333) and
  // there is no formatter that leaves an already-scaled number alone — so the
  // unit lives in the header rather than being applied twice to the cell.
  { field: 'percentage', label: 'Share %', align: 'right' },
]

/** The most-viewed pages over the window. */
const topPages = (): PageComponent =>
  breakdown({
    label: '$t:admin.pages.top.region',
    endpoint: ANALYTICS_PAGES_ENDPOINT,
    rowsKey: 'pages',
    idKey: 'path',
    columns: [
      { field: 'path', label: 'Page' },
      { field: 'pageViews', label: 'Views', align: 'right' },
      { field: 'uniqueVisitors', label: 'Visitors', align: 'right' },
    ],
    emptyMessage: 'No pages viewed in this period',
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
            { field: 'domain', label: 'Referrer' },
            { field: 'pageViews', label: 'Views', align: 'right' },
            { field: 'uniqueVisitors', label: 'Visitors', align: 'right' },
          ],
          emptyMessage: 'No referrers in this period',
        }),
        breakdown({
          label: '$t:admin.pages.campaigns.region',
          endpoint: ANALYTICS_CAMPAIGNS_ENDPOINT,
          rowsKey: 'campaigns',
          idKey: 'campaign',
          columns: [
            { field: 'campaign', label: 'Campaign' },
            { field: 'source', label: 'Source' },
            { field: 'medium', label: 'Medium' },
            { field: 'pageViews', label: 'Views', align: 'right' },
          ],
          emptyMessage: 'No tagged campaigns in this period',
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
          emptyMessage: 'No devices recorded',
        }),
        breakdown({
          label: '$t:admin.pages.browsers.region',
          endpoint: ANALYTICS_DEVICES_ENDPOINT,
          rowsKey: 'browsers',
          idKey: 'name',
          columns: TECHNOLOGY_COLUMNS,
          emptyMessage: 'No browsers recorded',
        }),
        breakdown({
          label: '$t:admin.pages.os.region',
          endpoint: ANALYTICS_DEVICES_ENDPOINT,
          rowsKey: 'operatingSystems',
          idKey: 'name',
          columns: TECHNOLOGY_COLUMNS,
          emptyMessage: 'No operating systems recorded',
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
        { field: 'event_name', label: 'Event' },
        { field: 'event_type', label: 'Type' },
        { field: 'timestamp', label: 'Recorded', format: 'datetime' },
      ],
      emptyMessage: 'No events in this period',
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
      kpiStrip(),
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
 * Audience, then cost. `/pages` reports who this instance served and `/footprint`
 * reports what serving them consumed — one question asked twice, split across
 * two sidebar rows and two documents until now. Reading the second is always a
 * consequence of reading the first, so the first opens by default.
 */
const TABS = [
  { id: 'pages', label: 'Pages' },
  { id: 'footprint', label: 'Footprint' },
] as const

/**
 * The Pages panel: the four audience components, whichever of them applies.
 *
 * `liveBody` and `disabledRegion` carry opposite `declares` gates, so exactly
 * one reaches the document — and BOTH stay inside this one panel, for the
 * `panels[i]` ↔ `children[i]` rule: a gate that removed a top-level child would
 * put the footprint body under the Pages tab with nothing saying so.
 */
const pagesPanel = (): PageComponent => tabPanel([liveBody(), disabledRegion()])

/**
 * Both routes render the SAME strip; only the tab a bare URL opens on differs.
 *
 * `/footprint` is RETAINED rather than redirected because a redirect is not
 * available: `redirects[]` decodes, ships inside the preset, and then does
 * nothing at all under the console mount — both `/_admin/<from>` and `/<from>`
 * answer 404. A retained page is what keeps a bookmark working.
 *
 * `window` is declared on both even though only the Pages panel reads it: a
 * `$window.*` token resolves against the PAGE, and `/footprint?tab=pages` is a
 * reachable state whose panels would otherwise resolve against nothing.
 */
const analyticsPage = (config: {
  readonly id: string
  readonly path: string
  readonly title: string
  readonly defaultTab: string
  // `/footprint` keeps its OWN heading rather than inheriting "Analytics". The
  // `h1` is `sr-only`, so it is the only thing naming the surface to a screen
  // reader, and the retained route is a different answer to the same question.
  readonly heading: PageComponent
  readonly breadcrumb: Readonly<Record<string, string>>
}): PageConfig =>
  withShell(
    {
      id: config.id,
      name: config.id,
      path: config.path,
      meta: { title: config.title, lang: 'en-US' },
      // ONE preset, which IS the window this surface has. See the header for why
      // adding the Links console's three is a product decision rather than part
      // of the migration.
      window: { default: '30d', presets: [{ id: '30d' }] },
      query: tabQuery(TABS, config.defaultTab),
      components: [
        config.heading,
        tabbedBody('$t:admin.pages.tabs.region', TABS, [pagesPanel(), tabPanel([footprintBody()])]),
      ],
    } as PageConfig,
    { breadcrumb: config.breadcrumb }
  )

/** `/pages` — the audience of the operator's own pages, with its cost beside. */
const audiencePage: PageConfig = analyticsPage({
  id: 'dashboard-data-pages',
  path: '/pages',
  title: '$t:admin.meta.pages',
  defaultTab: 'pages',
  // TWO headings under opposite gates, so exactly one reaches the document and
  // the `h1` count stays at 1 on an app with analytics off. That is why this is
  // a component rather than a string pair — a single heading could not express
  // it, and `/pages` is the only surface in the console that needs to.
  heading: {
    type: 'container',
    element: 'div',
    children: [enabledIntro(), disabledIntro()],
  } as PageComponent,
  breadcrumb: { pages: '$t:admin.crumb.pages' },
})

/**
 * `/footprint` — the retained address, opening on the Footprint tab.
 *
 * It keeps its own document title and its own breadcrumb leaf, so a bookmark
 * still says what it is looking at.
 */
const footprintPage: PageConfig = analyticsPage({
  id: 'dashboard-footprint',
  path: '/footprint',
  title: '$t:admin.meta.footprint',
  defaultTab: 'footprint',
  heading: pageHeading('$t:admin.footprint.heading', '$t:admin.footprint.blurb'),
  breadcrumb: { footprint: '$t:admin.crumb.footprint' },
})

/** Both routes, audience first — the order an operator meets them in. */
export default [audiencePage, footprintPage] satisfies readonly PageConfig[]
