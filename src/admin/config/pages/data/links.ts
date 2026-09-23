/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// Links — which short link the audience is actually using, and which one needs
// changing right now.
//
// TWO pages out of one module: the flat directory and one link's deep-dive.
// They share a window, a query and four panel shapes, so splitting them across
// two files would put the halves of one surface where a change to the trend
// chart could land on one and miss the other.
//
// ─── IT IS A FLAT DIRECTORY — NO `redirectToFirst` ─────────────────────────
//
// Records, Submissions and Files 302 a bare path to their first object because
// their object list is config-bounded and the sidebar enumerates it. The links
// population is unbounded and database-backed: there is no meaningful "first
// link", enumerating hundreds of rows in a 256px disclosure would be hostile,
// and the operator's first question is cross-link anyway. `page.redirectToFirst`
// exists and is deliberately NOT declared here — `[internal ref]`
// pins the bare path staying put.
//
// ─── EVERY METRIC COMES FROM THE ANALYTICS READERS ─────────────────────────
//
// There is no `/api/admin/links/overview` and no per-link click endpoint,
// however natural either looks: a second aggregation path over the same click
// rows would eventually disagree with the first ([internal ref] D6). Both pages ask the
// SAME readers a narrower question, with `event_type=link_click`, and the
// deep-dive adds `event_name`. The ONE links-specific endpoint either page binds
// is the catalog, and it lists definitions rather than metrics.
//
// ─── WHAT KEPT THIS A BUILDER, AND WHAT CLOSED IT ──────────────────────────
//
// Three things, in the order they were closed.
//
// `page.window` (the analytics readers require ABSOLUTE ISO `from` / `to`, and a
// `dataSource.system.query` value is a static literal, so "seven days back,
// ending now" was not expressible at all). `link.activeWhen` / `activeProps`
// (the period rail marks one preset current, which is an attribute on one of
// three links rather than a visibility gate — spelling it with one would mean
// six links to render three). And a page-level `{ system }` record resolved
// SERVER-SIDE, because the deep-dive's own name has to be in the first
// response: a heading patched in after a fetch leaves the document briefly
// nameless, and permanently nameless to a crawler or a reader with no scripting.
//
// The last blocker was ONE token. The whole surface passed 84 specs on its first
// run and was reverted anyway, because the builder heads the deep-dive
// `title ?? slug` and `AdminLink.title` is nullable — a console-minted link put
// the literal word `null` at the top of an operator page. [internal ref] closed it in
// the `$` grammar rather than in this file: `$record.title|$record.slug` resolves
// to the first candidate that is non-empty, so every consumer of that
// substitution gained a fallback at once and this page declares no special case.

import { pageHeading } from '../../components/data-page'
import { withShell } from '../../components/shell'
import {
  ANALYTICS_CAMPAIGNS_ENDPOINT,
  ANALYTICS_DEVICES_ENDPOINT,
  ANALYTICS_EVENTS_ENDPOINT,
  ANALYTICS_OVERVIEW_ENDPOINT,
  ANALYTICS_REFERRERS_ENDPOINT,
  LINK_DETAIL_ENDPOINT,
  LINKS_ENDPOINT,
} from '../../system-sources'
import type { Page as PageConfig } from '@/domain/models/app'

/** One node of a page's component tree, as the config type expresses it. */
type PageComponent = NonNullable<PageConfig['components']>[number]

/**
 * Id of the catalog grid — the `onSuccess.refetch` target of every write on the
 * directory, so a mint or a delete repaints the list rather than the page.
 */
const CATALOG_GRID_ID = 'admin-links-catalog'

/**
 * Id of the deep-dive's full-definition drawer.
 *
 * The drawer is the ONLY place `targets[]` and `utm{}` can be rendered as
 * structure. `$record.<field>` coerces with `String(value)` and its grammar is
 * `[a-zA-Z0-9_]+` with no dots, so `$record.utm` prints `[object Object]` and
 * `$record.utm.source` prints `[object Object].source` — both measured. A
 * record-drawer `recordField` with `renderAs: 'key-value'` / `'list'` is the one
 * primitive that walks into a nested value, which is why the detail's richest
 * half is behind a row click rather than printed on the page.
 */
const DEFINITION_DRAWER_ID = 'admin-link-definition-drawer'

/**
 * The three look-back windows, in rail order.
 *
 * 24 hours is too short to read a campaign and 30 days flattens a launch spike,
 * so 7 days sits in the middle and is the default.
 *
 * Only the ids are declared. `granularity` and `label` both DERIVE from the span
 * — `≤48h → hour`, `≤90d → day`; `7d → "last 7 days"` — and the derivations are
 * exactly the values the retired builder spelled out by hand, so restating them
 * would be three more places for the rail and the copy to drift apart.
 */
const WINDOW = {
  param: 'period',
  default: '7d',
  presets: [{ id: '24h' }, { id: '7d' }, { id: '30d' }],
}

/**
 * The query every analytics read on both pages carries, spelled ONCE so a panel
 * cannot be added with a window of its own.
 *
 * All four panels of a page share this object, and the system-value hook keys
 * its cache on endpoint + query — so the three KPI tiles and the trend chart
 * collapse into a single request, which is what
 * `[internal ref]` asserts. Two equivalent literals would
 * silently become two fetches.
 *
 * `event_type` is the whole point of binding the analytics readers rather than a
 * links-specific endpoint: one aggregation path over the click store, asked a
 * narrower question.
 */
const CLICK_QUERY = {
  from: '$window.start',
  to: '$window.end',
  granularity: '$window.granularity',
  event_type: 'link_click',
} as const

/** The same query narrowed to the link the URL names. */
const ONE_LINK_QUERY = { ...CLICK_QUERY, event_name: '$param.slug' } as const

/**
 * The same window and the same link, asked about the OTHER event the redirect
 * records.
 *
 * ─── WHY THIS EXISTS: "Clicks" DOES NOT MEAN "ARRIVALS" ───────────────────
 *
 * `routes.ts` records `qr_scan` instead of `link_click` when the request
 * carries the `?qr` marker the printed code embeds
 * (`link-click-analytics.ts:169`), so the two are disjoint sets over the same
 * redirect. Measured on this console: five requests to one slug, three of them
 * through the QR code, reported `pageViews: 2` under `link_click` and
 * `pageViews: 3` under `qr_scan`. Every scan of a code an operator printed and
 * put on a poster was therefore missing from the only figure this page
 * published, with nothing to say so.
 *
 * ─── AND WHY TWO FIGURES RATHER THAN ONE SUM ──────────────────────────────
 *
 * Because they answer different questions. "Clicks" is the link as a link — a
 * thing someone was sent and followed. "Scans" is the link as an object in the
 * world — a code on a poster, a card, a label — and the whole reason to print
 * one is to find out whether the paper worked. A single "Arrivals" figure adds
 * the two into a number that cannot answer either, and quietly redefines a
 * column every existing reading of this page was taken against.
 *
 * ─── THE TWO COSTS, NAMED ─────────────────────────────────────────────────
 *
 * It is a SECOND request. The system-value hook keys its cache on endpoint +
 * query, which is what collapses the click tiles and the trend chart into one
 * fetch, and a different `event_type` is a different query by construction.
 * One extra read per detail view is the honest price of a figure that was
 * missing entirely.
 *
 * And it is a DELIBERATE DEVIATION from the reference, which draws one metric
 * card on this page. The drawing was made before the QR half of the redirect
 * was measured; it is not wrong about the layout, only silent about a number
 * that turned out to exist.
 */
const ONE_LINK_SCAN_QUERY = { ...ONE_LINK_QUERY, event_type: 'qr_scan' } as const

/**
 * The period rail: the three presets as real LINKS, the active one marked
 * `aria-current="page"`.
 *
 * Links rather than buttons because that is what they are — each addresses a
 * different document. Back and forward move between windows for free, a shared
 * link carries the window it was read at, and a reload survives it.
 *
 * `activeWhen` compares `$window.id`, which the substitution passes have already
 * resolved to a literal by the time it is evaluated; `activeProps` is MERGED
 * over `props` key by key, so the `className` is swapped rather than
 * concatenated. The alternative — a visibility gate — needs six links to render
 * three, each pair duplicating an href and a label so the two can drift.
 *
 * @param basePath - the page's own mount-relative path, so the rail keeps the
 *   operator where they are.
 */
const periodRail = (basePath: string): PageComponent =>
  ({
    type: 'container',
    element: 'nav',
    props: {
      'aria-label': '$t:admin.links.period.region',
      className: 'border-border flex w-fit items-center gap-1 rounded-md border p-0.5',
    },
    children: WINDOW.presets.map((preset) => ({
      type: 'link',
      // The chip's caption is a KEY minted from the preset id, not the id
      // itself: `24h` and `7d` are English abbreviations, and a French console
      // writes "7 j". Deriving the key keeps the rail's three captions in the
      // catalogue without enumerating the presets a second time here.
      content: `$t:admin.links.period.${preset.id}`,
      props: {
        href: `${basePath}?period=${preset.id}`,
        className:
          'text-foreground-muted hover:text-foreground rounded px-2.5 py-1 text-sm font-medium',
      },
      activeWhen: { value: '$window.id', equals: preset.id },
      activeProps: {
        'aria-current': 'page',
        className: 'bg-background-raised text-foreground rounded px-2.5 py-1 text-sm font-medium',
      },
    })),
  }) as PageComponent

/**
 * The one-line statement of which window the figures above cover.
 *
 * A click count is indistinguishable at any window: 412 over seven days and 412
 * over all time are the same three digits. The phrase appears exactly once per
 * document, so `getByText(/last 7 days/i)` resolves to one element.
 */
const windowCopy = (): PageComponent =>
  ({
    type: 'text',
    element: 'p',
    props: { className: 'text-foreground-subtle text-sm' },
    content: 'Measured over the $window.label.',
  }) as PageComponent

/**
 * One KPI tile reading a pre-computed scalar at `valuePath`.
 *
 * The label paints as visible text in the SSR skeleton, before the shared fetch
 * settles. Tiles over the same endpoint AND query collapse into one request —
 * the hook keys its cache on those two and NOT on the per-tile value path. The
 * cheap mistake, keying on the path too, is invisible except as N times the
 * load, which is why the spec asserts the request COUNT rather than the numbers.
 */
const kpiTile = (
  label: string,
  endpoint: string,
  valuePath: string,
  query?: Readonly<Record<string, string>>
): PageComponent =>
  ({
    type: 'kpi',
    label,
    dataSource: { system: { endpoint, valuePath, ...(query === undefined ? {} : { query }) } },
    kpiFormat: { type: 'number' },
  }) as PageComponent

/**
 * The click trend, over the overview's TOP-LEVEL `timeSeries`.
 *
 * The chart hook reads `json[rowsKey]` as a plain key and never a dotted path,
 * which is why a NESTED series block binds to nothing and renders an empty chart
 * with no error anywhere.
 *
 * Its `emptyState` is the honest answer to a window with nothing in it: a flat
 * line at zero reads as "measured, and it was zero", which is a different claim
 * from "no clicks were recorded" — and the second is the only one the endpoint
 * supports.
 */
const trendChart = (query: Readonly<Record<string, string>>): PageComponent =>
  ({
    type: 'chart',
    props: { 'aria-label': '$t:admin.links.trend.region' },
    dataSource: { system: { endpoint: ANALYTICS_OVERVIEW_ENDPOINT, rowsKey: 'timeSeries', query } },
    chartType: 'area',
    xAxis: { field: 'period', format: 'date' },
    series: [
      { field: 'pageViews', label: 'Clicks' },
      { field: 'uniqueVisitors', label: 'Unique visitors' },
    ],
    emptyState: { role: 'region', name: 'No data', title: 'No clicks recorded in this period' },
  }) as PageComponent

/**
 * A read-only system-source grid over one reader.
 *
 * Every breakdown is the same shape, so they come from one helper rather than
 * five near-copies. A system-source grid keeps its native `<table>` role and
 * accessible name, so each resolves as `table "<label>"`.
 *
 * `idKey` is the row's identity, and where a reader's identity field is NULLABLE
 * (`referrers.domain` is null for direct traffic; every `campaigns.*` field is
 * null for untagged traffic) two such rows would normalize onto the same id —
 * `parseSystemEnvelope` maps `row[idKey]` onto `id` with no index fallback. Each
 * reader groups its rows, so the null bucket collapses to at most one row per
 * grid; that is an observed property of the queries rather than a guarantee the
 * schema makes, and it is recorded here so a future grouping change is caught.
 */
const systemGrid = (config: {
  readonly label: string
  readonly endpoint: string
  readonly rowsKey: string
  readonly idKey: string
  readonly columns: ReadonlyArray<Record<string, unknown>>
  readonly emptyMessage: string
  readonly query?: Readonly<Record<string, string>>
}): PageComponent =>
  ({
    type: 'table',
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
  }) as PageComponent

/** A labelled section wrapping one or more panels, with its own heading. */
const panelSection = (label: string, children: ReadonlyArray<PageComponent>): PageComponent =>
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

/**
 * The static "analytics not enabled" note.
 *
 * The catalog still renders beneath it: link DEFINITIONS do not depend on
 * analytics, and hiding them would be a worse answer than an honest gap where
 * the metrics would be.
 */
const analyticsDisabledNote = (): PageComponent =>
  ({
    type: 'container',
    element: 'section',
    visibility: { unlessDeclares: 'analytics' },
    props: {
      'aria-label': '$t:admin.links.unavailable.region',
      className:
        'border-border bg-background-raised mt-2 flex flex-col gap-2 rounded-lg border p-6',
    },
    children: [
      {
        type: 'text',
        element: 'p',
        props: { className: 'text-foreground text-md font-medium' },
        content: '$t:admin.links.unavailable.heading',
      },
      {
        type: 'text',
        element: 'p',
        props: { className: 'text-foreground-muted max-w-xl text-md leading-relaxed' },
        content: '$t:admin.links.unavailable.body',
      },
    ],
  }) as PageComponent

// ─── The directory ──────────────────────────────────────────────────────────

/**
 * The catalog columns an operator scans.
 *
 * `source` decides what the console MAY offer, so it is a rendered column rather
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
]

/**
 * The row action column — the one write the DIRECTORY offers.
 *
 * ─── WHY ONLY DELETE HERE, AND WHY THE GATE IS `source` ────────────────────
 *
 * `visibleWhen` is ONE field condition, so a control needing "db-sourced AND
 * currently active" cannot be expressed on a row at all. Disable and Enable are
 * exactly that shape, so they live on the DEEP-DIVE, where the page-level record
 * lets two `visibility.record` gates nest — `source` outside, `state` inside.
 *
 * Delete needs only the first half, so it is the one that fits here. It is gated
 * on `source` rather than offered to everything, because `DELETE` naming a
 * config-declared slug answers **409 `LINK_IS_CONFIG_DECLARED`** by design
 * ([internal ref] D2) — painting a control the backend refuses is a defect, not a
 * cosmetic issue, and the refusal is the same whatever the link's state.
 *
 * Both confirm labels are EXPLICIT. The confirm-gate runtime defaults its two
 * buttons to French, which would put "Annuler" in an otherwise English console —
 * a platform gap this config works around rather than inherits.
 */
const CATALOG_ACTIONS = {
  type: 'actions',
  label: 'Actions',
  actions: [
    {
      // The drill-down, as a real control rather than a bare clickable row.
      //
      // ─── WHY NOT `onRowClick`, WHICH IS WHAT SHIPPED FIRST ───────────────
      //
      // A row click and a row-action column CANNOT COEXIST. The row's handler
      // fires first, so every action button in the column becomes a navigation:
      // measured, clicking Delete here landed on `/links/ab-test` with no
      // confirm ever armed, and the identical shape on the `/users` directory
      // turned Ban, Lift ban and Change role into navigations too — taking five
      // previously green specs red.
      //
      // An action item is the fix AND the better affordance. A row click is
      // reachable by pointer only; this is a button in the tab order with an
      // accessible name. It is also what the reference draws: a per-row
      // control, never a row that silently navigates.
      // `mode: 'navigate'` on a FETCH action, not a top-level `type: 'navigate'`.
      // The action dispatcher emits data attributes for `automation` / `auth` /
      // `crud` / `fetch` only, so a bare `navigate` renders a button that does
      // nothing at all — measured here first, and the same trap the Invite
      // affordance on `/users` already carries a note about. The url is
      // MOUNT-RELATIVE, like every other intra-app path in this config.
      label: 'Open',
      action: { type: 'fetch', mode: 'navigate', url: '/links/$record.slug' },
    },
    {
      // The danger weight, and it is the SAME gesture the detail page already
      // draws that way (`manageBlock`'s Delete carries `variant: 'destructive'`
      // as a standalone `button`). One object, one consequence, one colour —
      // a row action that recedes where the page-level control reddens would
      // teach an operator that the two do different things.
      //
      // It is the only item in this column that names a weight. `Open` is a
      // drill-down and stays neutral; a column where both items shout has no
      // emphasis left to spend.
      label: 'Delete',
      variant: 'destructive',
      visibleWhen: { field: 'source', eq: 'db' },
      confirm: {
        title: 'Delete this link?',
        message:
          'Anyone who follows /l/$record.slug from here on gets a 410. Its click history is kept, and the slug becomes free to mint again.',
        role: 'alertdialog',
        confirmLabel: 'Delete link',
        cancelLabel: 'Cancel',
      },
      action: {
        type: 'fetch',
        method: 'DELETE',
        url: `${LINKS_ENDPOINT}/$record.slug`,
        onSuccess: { type: 'toast', message: 'Link deleted', refetch: CATALOG_GRID_ID },
        onError: {
          type: 'toast',
          variant: 'destructive',
          message: 'The link was not deleted. It may be declared in app.links[].',
        },
      },
    },
  ],
} as const

/**
 * The catalog grid.
 *
 * Narrowing goes to the SERVER: the endpoint applies `?q=` over slug, title and
 * destination and echoes `appliedQuery`, which is the signal that tells the grid
 * not to re-filter the page it was handed. Without that echo a client narrows an
 * already-narrowed page and hides matches living on the next one — and only ever
 * on fields that happen to be rendered columns, which is how that class of bug
 * stays invisible.
 *
 * The `search` block must be PRESENT for the box to render: `toolbar.search`
 * alone leaves the grid with no input at all.
 *
 * No `pagination` block, deliberately: the endpoint pages by opaque CURSOR while
 * the grid's pager speaks `page=N`. Declaring one renders a control whose second
 * page returns the first.
 *
 * ─── THE ROW CLICK IS THE ONLY WAY INTO THE DEEP-DIVE ──────────────────────
 *
 * `/links/:slug` has shipped since this file was written and NOTHING linked to
 * it: no column rendered a link, no row was clickable, and the sidebar lists
 * only the directory. The page was reachable by typing its address. The **Open**
 * action in {@link CATALOG_ACTIONS} is that drill-down — and it is an action
 * item rather than an `onRowClick` for a reason measured the hard way; the
 * comment on it has the whole story.
 */
const catalogGrid = (): PageComponent =>
  ({
    type: 'table',
    props: { id: CATALOG_GRID_ID, 'aria-label': '$t:admin.links.catalog.region' },
    dataSource: {
      system: { endpoint: LINKS_ENDPOINT, rowsKey: 'items', idKey: 'slug', totalKey: 'total' },
    },
    columns: [...CATALOG_COLUMNS, CATALOG_ACTIONS],
    search: { enabled: true, placeholder: 'Search links' },
    toolbar: { search: true, sort: true },
    emptyMessage: 'No links yet',
    noMatchMessage: 'No link matches “{query}”',
  }) as PageComponent

/**
 * Mint a runtime link — the console's first CREATE surface.
 *
 * ─── TWO FIELDS, AND THE THIRD WOULD 400 ───────────────────────────────────
 *
 * `POST /api/admin/links` takes a dozen optional fields, and this form offers
 * two. That is not restraint about what an operator might want: the endpoint-form
 * runtime collects `Object.fromEntries(new FormData(form))` and submits EVERY
 * declared field, so an untouched optional input arrives as `""` — and
 * `title`, `notes` and every `utm*` field are `NullOr(String minLength 1)`, so a
 * blank one is refused with **400 `Invalid link payload`**. Measured, not
 * assumed. A five-field form would therefore fail unless the operator filled all
 * five, which is the opposite of optional.
 *
 * `slug` and `destination` are the two the endpoint requires anyway, so the form
 * that can be submitted half-empty is exactly the form that offers only them.
 * Everything else is set afterwards, on the deep-dive. The gap is filed: the
 * runtime should OMIT an empty optional field rather than send an empty string.
 *
 * `onSuccess.refetch` names the catalog grid, so the new row appears without a
 * reload — which is also the operator's confirmation that the slug was free.
 */
const newLinkForm = (): PageComponent =>
  ({
    type: 'form',
    props: { id: 'admin-link-create-form', 'aria-label': '$t:admin.links.create.region' },
    endpoint: {
      url: LINKS_ENDPOINT,
      method: 'POST',
      submitLabel: 'Create link',
      onSuccess: {
        type: 'toast',
        variant: 'success',
        message: 'Link created',
        refetch: CATALOG_GRID_ID,
      },
      onError: {
        type: 'toast',
        variant: 'destructive',
        message: 'The link was not created. The slug may be taken or reserved.',
      },
    },
    fields: [
      { field: 'slug', control: 'text', label: 'Slug' },
      { field: 'destination', control: 'url', label: 'Destination' },
    ],
  }) as PageComponent

/**
 * The create form under a heading, so the directory reads as two sections.
 *
 * The section itself draws NO frame. A `form` carries its own card prestyle —
 * padding, a raised ground and a border — so a bordered section around one is
 * two boxes with a 16 px gap between their edges, which reads as a nesting that
 * means nothing. The heading and its sentence sit outside the card; the card is
 * the form.
 */
const newLinkSection = (): PageComponent =>
  ({
    type: 'container',
    element: 'section',
    props: {
      'aria-label': '$t:admin.links.create.region',
      className: 'flex flex-col gap-3',
    },
    children: [
      {
        type: 'text',
        element: 'h2',
        props: { className: 'text-foreground text-md font-medium' },
        content: '$t:admin.links.create.heading',
      },
      {
        type: 'text',
        element: 'p',
        props: { className: 'text-foreground-subtle max-w-2xl text-sm leading-relaxed' },
        content: '$t:admin.links.create.body',
      },
      newLinkForm(),
    ],
  }) as PageComponent

/**
 * The directory's metrics region: the window it covers, then the four figures.
 *
 * Three of the four read the analytics overview and collapse into ONE request.
 * The fourth reads the catalog's `total` — a population figure rather than a
 * click figure, and it belongs beside them because "412 clicks" means something
 * different across 3 links and across 300.
 */
const directoryMetrics = (): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    visibility: { declares: 'analytics' },
    props: { className: 'flex flex-col gap-6' },
    children: [
      periodRail('/links'),
      {
        type: 'container',
        element: 'section',
        props: {
          className: 'flex flex-col gap-3 pt-2',
          'aria-label': '$t:admin.links.metrics.region',
        },
        children: [
          windowCopy(),
          {
            type: 'container',
            props: { className: 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4' },
            children: [
              kpiTile('Clicks', ANALYTICS_OVERVIEW_ENDPOINT, 'summary.pageViews', CLICK_QUERY),
              kpiTile(
                'Unique visitors',
                ANALYTICS_OVERVIEW_ENDPOINT,
                'summary.uniqueVisitors',
                CLICK_QUERY
              ),
              kpiTile('Sessions', ANALYTICS_OVERVIEW_ENDPOINT, 'summary.sessions', CLICK_QUERY),
              kpiTile('Links tracked', LINKS_ENDPOINT, 'total'),
            ],
          },
        ],
      },
      trendChart(CLICK_QUERY),
    ],
  }) as PageComponent

const directory = withShell(
  {
    id: 'dashboard-data-links',
    name: 'dashboard-data-links',
    path: '/links',
    meta: { title: '$t:admin.meta.links', lang: 'en-US' },
    window: WINDOW,
    components: [
      pageHeading('$t:admin.links.heading', '$t:admin.links.blurb'),
      {
        type: 'container',
        element: 'div',
        props: { className: 'flex flex-col gap-6 pt-2' },
        children: [directoryMetrics(), analyticsDisabledNote(), catalogGrid(), newLinkSection()],
      } as PageComponent,
    ],
  } as PageConfig,
  { breadcrumb: { links: '$t:admin.crumb.links' } }
) satisfies PageConfig

// ─── One link's deep-dive ───────────────────────────────────────────────────

/**
 * The definition panel: the catalog row for this one slug.
 *
 * Bound to the catalog narrowed by `?q={slug}` rather than read off the
 * page-level record, for one reason worth keeping: `state` comes back DERIVED by
 * the resolver — the same function the redirect handler uses — so this panel
 * cannot report `active` for a link whose visitors are getting a 410, which a
 * second reading of the lifecycle rules here eventually would.
 */
const definitionPanel = (): PageComponent =>
  ({
    type: 'table',
    props: { id: 'admin-link-definition', 'aria-label': '$t:admin.links.definition.region' },
    dataSource: {
      system: {
        endpoint: LINKS_ENDPOINT,
        rowsKey: 'items',
        idKey: 'slug',
        query: { q: '$param.slug' },
      },
    },
    // The one row IS the affordance: clicking it opens the half of the
    // definition this page cannot print — the target list and the campaign
    // parameters. `idKey: 'slug'` makes the row id the slug, which is exactly
    // what the drawer's detail endpoint wants in its `:slug` slot.
    onRowClick: { action: 'openDrawer', component: DEFINITION_DRAWER_ID },
    columns: [
      { field: 'shortUrl', label: 'Short link' },
      { field: 'destination', label: 'Destination' },
      { field: 'source', label: 'Source', valueLabels: { config: 'Config', db: 'Console' } },
      { field: 'state', label: 'State' },
      { field: 'validFrom', label: 'Starts', format: 'datetime' },
      { field: 'validUntil', label: 'Expires', format: 'datetime' },
    ],
    emptyMessage: 'This link is no longer declared',
  }) as PageComponent

/**
 * The full definition, as a read-only drawer over `GET /api/admin/links/:slug`.
 *
 * Everything the catalog row omits for width: every candidate destination with
 * its weight, the five campaign parameters, the operator notes, the click cap
 * and the expired-destination fallback.
 *
 * `renderAs` is what makes it readable. `targets` is an array of objects and
 * `utm` is a nested object, and BOTH are unprintable anywhere else in config —
 * see {@link DEFINITION_DRAWER_ID}. `canEdit: false` is not a choice: a system
 * detail source has no records table to PATCH, so the drawer is read-only by
 * construction, and the writes live under it on the page.
 *
 * No `password` in any cell, because there is none in the payload: the endpoint
 * does not emit one, which is what makes the redaction real rather than
 * cosmetic — masking in the UI would still ship the value to the browser, the
 * proxy and the error tracker ([internal ref] D5).
 */
const definitionDrawer = (): PageComponent =>
  ({
    type: 'drawer',
    id: DEFINITION_DRAWER_ID,
    // No `role`, so this is a `dialog` — the default, and the only one of the
    // two surfaces that carries a dismiss contract. A `region` is a LANDMARK:
    // it has no Escape handling and no focus management by design, so the
    // drawer opened over a row could only be closed by re-navigating. All four
    // console record drawers are dialogs.
    // A LITERAL, not a `$t:` token. `props.title` is threaded into
    // `data-island-props` verbatim and the island is not on the translation
    // path, so a token here reaches the DOM as its own text — the same trap the
    // tab-label count badges hit one component over.
    props: { title: 'Full definition' },
    dataSource: { system: { endpoint: LINK_DETAIL_ENDPOINT, param: 'slug', recordKey: 'link' } },
    canEdit: false,
    recordFields: [
      { name: 'shortUrl', type: 'single-line-text', label: 'Short link' },
      { name: 'targets', type: 'json', label: 'Targets', renderAs: 'list' },
      { name: 'utm', type: 'json', label: 'Campaign parameters', renderAs: 'key-value' },
      // No `renderAs`: a string array's default `String(value)` coercion is the
      // comma-separated reading an operator wants, and an EMPTY one becomes an
      // empty line. `renderAs: 'json'` printed a literal `[]` for a link with no
      // tags, which reads as a value rather than as an absence.
      { name: 'tags', type: 'single-line-text', label: 'Tags' },
      { name: 'notes', type: 'long-text', label: 'Notes' },
      { name: 'maxClicks', type: 'single-line-text', label: 'Click cap' },
      { name: 'expiredTo', type: 'single-line-text', label: 'When expired' },
    ],
  }) as PageComponent

/**
 * The QR preview and its download, both pointing at the PUBLIC image route.
 *
 * `$record.qrUrl` comes from the page-level record rather than being composed
 * from the slug, so there is one authority on where a link's QR lives and no
 * second renderer to drift from it.
 *
 * The DOWNLOAD is absolute (`$app.origin` + the path) and the preview is not,
 * and that asymmetry is load-bearing rather than sloppy. A mount-local `href`
 * is rewritten onto the console's base at boot, so a bare `/l/…` download link
 * would resolve to `/_admin/l/…` and 404 — the `$app.origin` prefix is the
 * documented way a preset page points OUT of the console. `src` is not a
 * navigation key, so the preview is left alone and stays root-relative.
 *
 * Exactly one symbol inside the region, deliberately: the download is a plain
 * text link rather than an icon button, so the preview is unambiguously the
 * thing an operator is looking at.
 *
 * ─── THE PREVIEW IS THE `qr-code` COMPONENT, NOT AN `<img>` ────────────────
 *
 * It was an `image` pointing at `$record.qrUrl`, and the argument for that was
 * single-authority: one place decides where a link's QR lives. What it cost was
 * three things the component gives for free. `qr-code` is SSR-only — the
 * renderer emits no `data-island` marker — so the symbol is in the first
 * response, costs no request, survives a browser with scripting off, and prints
 * from the browser's own dialog, which is most of what a printed QR is for. And
 * it encodes `/l/<slug>?qr=1`, the marker that makes a scan countable apart from
 * a click; the raw image route carries no such thing, so every scan was
 * indistinguishable from a paste.
 *
 * The DOWNLOAD still reads `$record.qrUrl`, so the authority argument survives
 * where it actually bites — the file an operator saves and sends to a printer is
 * the one the platform serves.
 */
const qrRegion = (): PageComponent =>
  ({
    type: 'container',
    element: 'section',
    props: {
      'aria-label': '$t:admin.links.qr.region',
      className:
        'border-border bg-background-raised flex w-fit flex-col items-center gap-3 rounded-lg border p-4',
    },
    children: [
      {
        type: 'qr-code',
        link: '$param.slug',
        props: {
          'aria-label': 'QR code for /l/$param.slug',
          className: 'h-40 w-40',
        },
      },
      {
        type: 'link',
        content: '$t:admin.links.qr.download',
        props: {
          href: '$app.origin$record.qrUrl',
          download: '$record.slug-qr.svg',
          target: '_blank',
          rel: 'noopener noreferrer',
          className: 'text-foreground-muted hover:text-foreground text-sm underline',
        },
      },
    ],
  }) as PageComponent

// ─── The write half, and the exact shape config can express ────────────────
//
// The console has almost no write surfaces. This is one, and it is deliberately
// the narrowest honest version of the canvas's Edit drawer rather than a
// half-working copy of it.
//
// ─── WHY THERE IS NO PREFILLED EDIT FORM ───────────────────────────────────
//
// `renderEndpointControl`
// (src/presentation/render/elements/crud-form/endpoint-form-renderer.tsx:80)
// reads exactly three keys off a field: `field`, `control` and `options`. It
// ignores `defaultValue`, `placeholder`, `description`, `required`, `readOnly`
// and `optionsSource`. So an endpoint-bound `form` renders EMPTY, always —
// measured with a literal `defaultValue: 'LITERAL-X'`, which did not reach the
// input either, so this is not a `$record` substitution problem. An edit form
// whose every field starts blank is not an edit form: `PATCH` is sparse, but the
// runtime submits every input including the untouched ones, so saving would
// blank whatever the operator did not retype.
//
// What CAN be authored is a form over the fields the operator is retyping
// anyway. Re-pointing a link is exactly that gesture — one required field, a
// value that is always new — so it ships, and the rest of the edit surface waits
// on prefill support in that renderer.
//
// ─── THE TWO GATES, AND WHY THEY NEST ──────────────────────────────────────
//
// `visibility.record` names ONE field and has no conjunction, and Disable needs
// "db-sourced AND currently active". Two gates nest instead: `source` on the
// outer container, `state` on the inner one. The page-level record is what makes
// that possible at all — the same record the heading reads — and it is why these
// controls live here rather than on a directory row, where `visibleWhen` is also
// a single condition and there is no outer scope to put the second one in.

/**
 * Re-point the link: `PATCH /api/admin/links/:slug` with one field.
 *
 * `$param.slug` resolves into the URL server-side (the route-param pass walks
 * every string leaf), so the form posts to the link it is sitting on.
 *
 * `control: 'url'` gives the browser's own validation before anything is sent;
 * an empty submit still reaches the endpoint and comes back **400 `Invalid link
 * payload`**, which the `onError` toast reports rather than swallowing.
 */
const repointForm = (): PageComponent =>
  ({
    type: 'form',
    props: {
      id: 'admin-link-repoint-form',
      'aria-label': '$t:admin.links.manage.repoint',
      // The form's own card prestyle is dropped here, the opposite way round
      // from the create form: this one sits INSIDE the Manage frame, beside the
      // state buttons, and its own border would draw a box around one field in
      // the middle of a section that is already a box. `resolveClasses` merges
      // through `tailwind-merge`, so a same-property author class wins over the
      // recipe.
      className: 'border-0 bg-transparent p-0',
    },
    endpoint: {
      url: `${LINKS_ENDPOINT}/$param.slug`,
      method: 'PATCH',
      submitLabel: 'Re-point link',
      onSuccess: {
        type: 'toast',
        variant: 'success',
        message: 'Destination updated',
        refetch: 'admin-link-definition',
      },
      onError: {
        type: 'toast',
        variant: 'destructive',
        message: 'The destination was not changed. It must be a non-empty URL or path.',
      },
    },
    fields: [{ field: 'destination', control: 'url', label: 'New destination' }],
  }) as PageComponent

/**
 * One state button — Disable or Enable — gated on the state it reverses.
 *
 * Disable confirms and Enable does not, which is the same asymmetry the users
 * directory draws: confirmation is reserved for the direction that removes
 * access. Both labels are spelled out because the confirm gate's own defaults
 * are French.
 */
const stateButton = (config: {
  readonly label: string
  readonly state: string
  readonly path: string
  readonly message: string
  readonly confirm?: Readonly<Record<string, string>>
}): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    visibility: { record: { field: 'state', eq: config.state } },
    children: [
      {
        type: 'button',
        label: config.label,
        variant: 'secondary',
        ...(config.confirm === undefined ? {} : { confirm: config.confirm }),
        action: {
          type: 'fetch',
          method: 'POST',
          url: `${LINKS_ENDPOINT}/$param.slug/${config.path}`,
          onSuccess: {
            type: 'toast',
            message: config.message,
            refetch: 'admin-link-definition',
          },
          onError: { type: 'toast', variant: 'destructive', message: 'The link did not change.' },
        },
      },
    ],
  }) as PageComponent

/** The whole write block, shown only for a link the console may write. */
const manageSection = (): PageComponent =>
  ({
    type: 'container',
    element: 'section',
    visibility: { record: { field: 'source', eq: 'db' } },
    props: {
      'aria-label': '$t:admin.links.manage.region',
      className: 'border-border flex flex-col gap-4 rounded-lg border p-4',
    },
    children: [
      {
        type: 'text',
        element: 'h3',
        props: { className: 'text-foreground text-md font-medium' },
        content: '$t:admin.links.manage.heading',
      },
      repointForm(),
      {
        type: 'container',
        element: 'div',
        props: { className: 'flex flex-wrap items-center gap-2' },
        children: [
          stateButton({
            label: 'Disable',
            state: 'active',
            path: 'disable',
            message: 'Link disabled',
            confirm: {
              title: 'Disable this link?',
              message:
                'Anyone who follows /l/$param.slug stops arriving immediately. Enable puts it back; nothing is lost.',
              role: 'alertdialog',
              confirmLabel: 'Disable link',
              cancelLabel: 'Cancel',
            },
          }),
          stateButton({
            label: 'Enable',
            state: 'disabled',
            path: 'enable',
            message: 'Link enabled',
          }),
          {
            type: 'button',
            label: 'Delete',
            variant: 'destructive',
            confirm: {
              title: 'Delete this link?',
              message:
                'Anyone who follows /l/$param.slug from here on gets a 410. Its click history is kept, and the slug becomes free to mint again.',
              role: 'alertdialog',
              confirmLabel: 'Delete link',
              cancelLabel: 'Cancel',
            },
            action: {
              type: 'fetch',
              method: 'DELETE',
              url: `${LINKS_ENDPOINT}/$param.slug`,
              // Back to the directory: the page this button is on stops having a
              // subject the moment it succeeds.
              onSuccess: { type: 'toast', message: 'Link deleted' },
              onError: {
                type: 'toast',
                variant: 'destructive',
                message: 'The link was not deleted.',
              },
            },
          },
        ],
      },
    ],
  }) as PageComponent

/**
 * The counterpart note for a CONFIG-declared link.
 *
 * It appears exactly where the write block would be, and says where the link is
 * authored instead of leaving a silent hole. `POST`, `PATCH` and `DELETE`
 * naming a config slug answer 409 `LINK_IS_CONFIG_DECLARED`, so no control is
 * painted at all — the note is the honest substitute for one.
 */
const configSourceNote = (): PageComponent =>
  ({
    type: 'container',
    element: 'section',
    visibility: { record: { field: 'source', eq: 'config' } },
    props: {
      'aria-label': '$t:admin.links.manage.region',
      className: 'border-border bg-background-raised flex flex-col gap-2 rounded-lg border p-4',
    },
    children: [
      {
        type: 'text',
        element: 'h3',
        props: { className: 'text-foreground text-md font-medium' },
        content: '$t:admin.links.manage.config.heading',
      },
      {
        type: 'text',
        element: 'p',
        props: { className: 'text-foreground-muted max-w-2xl text-md leading-relaxed' },
        content: '$t:admin.links.manage.config.body',
      },
    ],
  }) as PageComponent

/** Visits and share, the shape every breakdown reader returns. */
const BREAKDOWN_COLUMNS = [
  { field: 'name', label: 'Name' },
  { field: 'count', label: 'Clicks', align: 'right' },
  // The endpoint already returns a scaled percentage (33.33, not 0.3333) and
  // there is no formatter that leaves an already-scaled number alone — so the
  // unit lives in the header rather than being applied twice to the cell.
  { field: 'percentage', label: 'Share %', align: 'right' },
]

/** The three breakdowns, each from a reader that already existed. */
const breakdowns = (): ReadonlyArray<PageComponent> => [
  systemGrid({
    label: '$t:admin.links.referrers.region',
    endpoint: ANALYTICS_REFERRERS_ENDPOINT,
    rowsKey: 'referrers',
    idKey: 'domain',
    columns: [
      { field: 'domain', label: 'Referrer' },
      { field: 'pageViews', label: 'Clicks', align: 'right' },
      { field: 'uniqueVisitors', label: 'Visitors', align: 'right' },
    ],
    emptyMessage: 'No referrers in this period',
    query: ONE_LINK_QUERY,
  }),
  systemGrid({
    label: '$t:admin.links.devices.region',
    endpoint: ANALYTICS_DEVICES_ENDPOINT,
    rowsKey: 'deviceTypes',
    idKey: 'name',
    columns: BREAKDOWN_COLUMNS,
    emptyMessage: 'No devices recorded in this period',
    query: ONE_LINK_QUERY,
  }),
  systemGrid({
    label: '$t:admin.links.campaigns.region',
    endpoint: ANALYTICS_CAMPAIGNS_ENDPOINT,
    rowsKey: 'campaigns',
    idKey: 'campaign',
    columns: [
      { field: 'campaign', label: 'Campaign' },
      { field: 'source', label: 'Source' },
      { field: 'medium', label: 'Medium' },
      { field: 'pageViews', label: 'Clicks', align: 'right' },
    ],
    emptyMessage: 'No tagged campaigns in this period',
    query: ONE_LINK_QUERY,
  }),
]

/**
 * The raw click log for this link.
 *
 * Field names are `snake_case` because THIS reader's projection is snake_case,
 * unlike every other admin endpoint the console binds. That inconsistency is
 * recorded rather than papered over: camelCase bindings render blank cells,
 * which is exactly how it was found.
 */
const clickLog = (): PageComponent =>
  systemGrid({
    label: '$t:admin.links.clickLog.region',
    endpoint: ANALYTICS_EVENTS_ENDPOINT,
    rowsKey: 'events',
    idKey: 'id',
    columns: [
      { field: 'timestamp', label: 'Recorded', format: 'datetime' },
      { field: 'event_type', label: 'Type' },
      { field: 'session_hash', label: 'Session' },
    ],
    emptyMessage: 'No clicks in this period',
    query: ONE_LINK_QUERY,
  })

/** Everything on the deep-dive that needs a reachable `/api/analytics/*`. */
const detailAnalytics = (): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    visibility: { declares: 'analytics' },
    props: { className: 'flex flex-col gap-6' },
    children: [
      periodRail('/links/$param.slug'),
      {
        type: 'container',
        element: 'section',
        props: {
          className: 'flex flex-col gap-3 pt-2',
          'aria-label': '$t:admin.links.metrics.region',
        },
        children: [
          windowCopy(),
          {
            // FOUR tiles, so the breakpoints change with them: three across a
            // tablet leaves a single orphan on the second row, where two-then-
            // two pairs Clicks with Scans — the two ways in — above the two
            // audience figures.
            type: 'container',
            props: { className: 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4' },
            children: [
              kpiTile('Clicks', ANALYTICS_OVERVIEW_ENDPOINT, 'summary.pageViews', ONE_LINK_QUERY),
              // Scans sits immediately beside Clicks because the pair only
              // means anything read together: either alone understates the
              // link. Same `kpiFormat` as its neighbour, so nothing about the
              // two invites a reader to compare units rather than values, and
              // a window with no scans reads `0` — measured, not blank: the
              // endpoint answers `summary.pageViews: 0` for a slug nobody has
              // scanned, which is the honest claim. See `ONE_LINK_SCAN_QUERY`
              // for why this is two figures and not one sum.
              kpiTile(
                'Scans',
                ANALYTICS_OVERVIEW_ENDPOINT,
                'summary.pageViews',
                ONE_LINK_SCAN_QUERY
              ),
              kpiTile(
                'Unique visitors',
                ANALYTICS_OVERVIEW_ENDPOINT,
                'summary.uniqueVisitors',
                ONE_LINK_QUERY
              ),
              kpiTile('Sessions', ANALYTICS_OVERVIEW_ENDPOINT, 'summary.sessions', ONE_LINK_QUERY),
            ],
          },
        ],
      },
      trendChart(ONE_LINK_QUERY),
      panelSection('$t:admin.links.audience.heading', [
        {
          type: 'container',
          props: { className: 'grid grid-cols-1 gap-4 lg:grid-cols-3' },
          children: breakdowns(),
        } as PageComponent,
      ]),
      panelSection('$t:admin.links.clickLog.heading', [clickLog()]),
    ],
  }) as PageComponent

/**
 * One link's deep-dive.
 *
 * The page-level `{ system }` binding is what names it: `recordKey: 'link'`
 * against `GET /api/admin/links/:slug`, resolved on the RENDER path with the
 * caller's identity borrowed, so the heading is in the first response and a slug
 * naming nothing is the page's own 404 rather than a document full of tokens.
 *
 * It renders the link's IDENTITY as VALUES and never as a config document — no
 * YAML view, no "view source", no diff, no history. Showing a runtime object's
 * identity is not a third introspection surface under [internal ref] A1, which bounds
 * surfaces whose subject is the configuration DOCUMENT.
 *
 * The write controls under it are painted for a DB-sourced link only, and are
 * the console's first real write surface. A config-declared slug gets a note
 * naming the file instead: `POST`, `PATCH` and `DELETE` answer 409
 * `LINK_IS_CONFIG_DECLARED` for one, and a control the backend refuses is a
 * defect rather than a cosmetic issue ([internal ref] D2).
 *
 * And no `password`, in any cell or any payload the page fetches — the catalog
 * and detail endpoints do not emit one, which is what makes the redaction real
 * rather than cosmetic: masking in the UI would still ship the value to the
 * browser, the proxy and the error tracker ([internal ref] D5).
 */
const detail = withShell(
  {
    id: 'dashboard-data-link-detail',
    name: 'dashboard-data-link-detail',
    path: '/links/:slug',
    // The SAME key the catalog page uses. `meta.title` is resolved before any
    // record is fetched, so a `$record.` token here is not substituted — it
    // shipped verbatim, and every tab and bookmark of a link read
    // "Sovrium — Data · Links · $record.slug". Every other detail page in the
    // console reuses its list page's key for exactly this reason; the slug is
    // carried by the page heading, which IS on the record path.
    meta: { title: '$t:admin.meta.links', lang: 'en-US' },
    window: WINDOW,
    dataSource: { system: { endpoint: LINK_DETAIL_ENDPOINT, param: 'slug', recordKey: 'link' } },
    components: [
      // The heading is the FALLBACK CHAIN, and it is the whole reason this page
      // could not ship a fortnight ago. `AdminLink.title` is nullable, so a
      // console-minted link headed by `$record.title` alone put the literal word
      // `null` at the top of the page; making null render as empty replaced that
      // with an untitled document, which is a different wrong answer. The chain
      // resolves to the first non-empty candidate.
      pageHeading(
        '$record.title|$record.slug',
        // "clicks and scans", not "clicks": the figures below are now two, and
        // a blurb naming one of them tells a reader the page is about half of
        // what it shows — the half that happens to exclude everyone who
        // arrived through the printed code.
        'How /l/$record.slug is being used: the clicks and scans it received, where they came from, and what they were browsing with. Its definition and QR code are below.'
      ),
      {
        type: 'container',
        element: 'div',
        props: { className: 'flex flex-col gap-6 pt-2' },
        children: [
          panelSection('$t:admin.links.definition.heading', [
            definitionPanel(),
            qrRegion(),
            definitionDrawer(),
          ]),
          manageSection(),
          configSourceNote(),
          detailAnalytics(),
        ],
      } as PageComponent,
    ],
  } as PageConfig,
  { breadcrumb: { links: '$t:admin.crumb.links' } }
) satisfies PageConfig

/**
 * Both pages, directory first.
 *
 * Order is route precedence, and it is load-bearing: matching takes the first
 * pattern that matches, and there is no static-over-dynamic rule, so a
 * `/links/:slug` listed ahead of `/links` would still leave `/links` reachable
 * (one segment vs two) — but keeping the literal first is the convention every
 * other multi-page surface here follows, and it is one less thing to re-derive.
 */
export default [directory, detail] as readonly PageConfig[]
