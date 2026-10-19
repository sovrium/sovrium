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
// rows would eventually disagree with the first. Both pages ask the
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
// the literal word `null` at the top of an operator page. It was closed in
// the `$` grammar rather than in this file: `$record.title|$record.slug` resolves
// to the first candidate that is non-empty, so every consumer of that
// substitution gained a fallback at once and this page declares no special case.

import { consolePage, toolbarRow } from '../../components/data-page'
import { dataTable, STATUS_BADGE, toolbarSearch } from '../../components/data-table-blocks'
import { ANALYTICS_OVERVIEW_ENDPOINT, LINKS_ENDPOINT } from '../../system-sources'
import { detail } from './link-detail'
import {
  CATALOG_GRID_ID,
  CLICK_QUERY,
  WINDOW,
  analyticsDisabledNote,
  kpiTile,
  periodRail,
  trendChart,
  windowCopy,
} from './links-shared'
import type { Page as PageConfig } from '@/domain/models/app'

/** One node of a page's component tree, as the config type expresses it. */
type PageComponent = NonNullable<PageConfig['components']>[number]

// ─── The directory ──────────────────────────────────────────────────────────

/**
 * The catalog columns an operator scans.
 *
 * `source` decides what the console MAY offer, so it is a rendered column rather
 * than a detail-page footnote: a `config` link is declared in a file the console
 * may not write and its mutation endpoints answer 409, so no Edit or Delete
 * affordance is painted for it at all. Painting a control the backend refuses is
 * a defect, not a cosmetic issue.
 *
 * `state` is derived by the resolver — the SAME function the redirect handler
 * uses — so the grid can never report `active` for a link whose visitors get a
 * 410. `scheduled` and `expired` stay distinct rather than collapsing into
 * "inactive": they call for opposite actions.
 */
const CATALOG_COLUMNS = [
  { field: 'shortUrl', label: '$t:admin.links.shortLink' },
  { field: 'title', label: '$t:admin.common.title' },
  { field: 'destination', label: '$t:admin.links.destination', format: 'truncate' },
  {
    field: 'source',
    label: '$t:admin.common.source',
    valueLabels: { config: '$t:admin.links.source.config', db: '$t:admin.links.source.console' },
    // Where the link is declared is a fact, not a state: the neutral badge.
    cellStyle: [{ when: { in: ['config', 'db'] }, className: STATUS_BADGE.quiet.neutral }],
  },
  {
    field: 'state',
    label: '$t:admin.common.state',
    valueLabels: {
      active: '$t:admin.links.state.active',
      disabled: '$t:admin.common.disabled',
      scheduled: '$t:admin.links.state.scheduled',
      expired: '$t:admin.links.state.expired',
      exhausted: '$t:admin.links.state.exhausted',
      archived: '$t:admin.links.state.archived',
    },
    // The console's one status badge, as on Runs and Automations. Only a live
    // link is green; a scheduled one is on its way; every other state is a
    // fact to read, and none of them is an alarm.
    cellStyle: [
      { when: { eq: 'active' }, className: STATUS_BADGE.quiet.positive },
      { when: { eq: 'scheduled' }, className: STATUS_BADGE.quiet.progress },
      {
        when: { in: ['disabled', 'expired', 'exhausted', 'archived'] },
        className: STATUS_BADGE.quiet.neutral,
      },
    ],
  },
  // Clicks over the selected period, counted by the list read itself.
  { field: 'clicks', label: '$t:admin.links.clicks30', align: 'right' },
  { field: 'validUntil', label: '$t:admin.common.expires', format: 'datetime' },
]

/**
 * The row action columns — `Open`, and the one write the DIRECTORY offers.
 *
 * A capability removes a whole column, never one item, so Delete — an
 * editor-only write — sits in {@link CATALOG_WRITE_ACTIONS} and the read-only
 * tier keeps `Open`, a read every console tier follows.
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
 * — painting a control the backend refuses is a defect, not a
 * cosmetic issue, and the refusal is the same whatever the link's state.
 *
 * Both confirm labels are EXPLICIT: the confirm-gate runtime defaults them to
 * French — a platform gap this config works around rather than inherits.
 */
const CATALOG_ACTIONS = {
  type: 'actions',
  label: '$t:admin.common.actions',
  actions: [
    {
      // The drill-down, as a real control rather than a bare clickable row.
      //
      // ─── WHY NOT `onRowClick`, WHICH IS WHAT SHIPPED FIRST ───────────────
      //
      // A row click and a row-action column CANNOT COEXIST: the row's handler
      // fires first, so every action button becomes a navigation (measured:
      // Delete landed on `/links/ab-test` with no confirm armed, and the same
      // shape on `/users` turned Ban and Change role into navigations).
      //
      // An action item is the fix AND the better affordance: a button in the
      // tab order with an accessible name, as the reference draws it.
      // `mode: 'navigate'` on a FETCH action, not a top-level `type: 'navigate'`:
      // the dispatcher emits data attributes for `automation` / `auth` / `crud` /
      // `fetch` only, so a bare `navigate` renders a button that does nothing
      // (the Invite trap on `/users`). The url is MOUNT-RELATIVE.
      label: '$t:admin.common.open',
      action: { type: 'fetch', mode: 'navigate', url: '/links/$record.slug' },
    },
  ],
} as const

const CATALOG_WRITE_ACTIONS = {
  type: 'actions',
  label: '',
  capability: 'edit-operations',
  actions: [
    {
      // The danger weight, as on the detail page's Delete: one object, one
      // consequence, one colour. The only row action here naming a weight —
      // `Open` stays neutral, and a row where both shout has no emphasis left.
      label: '$t:admin.common.delete',
      variant: 'destructive',
      visibleWhen: { field: 'source', eq: 'db' },
      confirm: {
        title: '$t:admin.links.deleteConfirm',
        message: '$t:admin.links.deleteMessageRow',
        role: 'alertdialog',
        confirmLabel: '$t:admin.links.delete',
        cancelLabel: '$t:admin.common.cancel',
      },
      action: {
        type: 'fetch',
        method: 'DELETE',
        url: `${LINKS_ENDPOINT}/$record.slug`,
        onSuccess: { type: 'toast', message: '$t:admin.links.deleted', refetch: CATALOG_GRID_ID },
        onError: {
          type: 'toast',
          variant: 'destructive',
          message: '$t:admin.links.notDeletedDeclared',
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
/**
 * The query the catalogue grid's first page reads with. The Links tracked tile
 * asks the SAME read for its `total`, so the page issues one links request
 * rather than two that differ only by the grid's paging.
 */
const CATALOG_FIRST_PAGE = { page: '1', limit: '25' } as const

/** The channel the catalogue's search box publishes on and its grid listens to. */
const LINKS_CHANNEL = 'links-filter'

const catalogGrid = (): PageComponent =>
  dataTable({
    props: { id: CATALOG_GRID_ID, 'aria-label': '$t:admin.links.catalog.region' },
    dataSource: {
      system: {
        endpoint: LINKS_ENDPOINT,
        rowsKey: 'items',
        idKey: 'slug',
        totalKey: 'total',
        // The Clicks column counts over the period the rail selects, so it
        // agrees with the Clicks card above it.
        query: { from: '$window.start', to: '$window.end' },
        bindTo: LINKS_CHANNEL,
        sharedFilter: {},
      },
    },
    columns: [...CATALOG_COLUMNS, CATALOG_ACTIONS, CATALOG_WRITE_ACTIONS],
    emptyMessage: '$t:admin.links.empty',
    noMatchMessage: '$t:admin.links.noMatch',
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
    // The dialog is the frame: the form's own card border is dropped inside it.
    props: {
      id: 'admin-link-create-form',
      'aria-label': '$t:admin.links.create.region',
      className: 'border-0 bg-transparent p-0',
    },
    endpoint: {
      url: LINKS_ENDPOINT,
      method: 'POST',
      submitLabel: '$t:admin.links.create.submit',
      // `reset` empties the form and puts the caret back on Slug: a minted
      // link is done, and the next one starts from a clean form.
      onSuccess: {
        type: 'toast',
        variant: 'success',
        message: '$t:admin.links.create.done',
        refetch: CATALOG_GRID_ID,
        close: true,
        reset: true,
      },
      onError: {
        type: 'toast',
        variant: 'destructive',
        message: '$t:admin.links.create.failed',
      },
    },
    fields: [
      { field: 'slug', control: 'text', label: '$t:admin.links.slug' },
      // A path on this site (`/devis?source=salon`) or an absolute address: a
      // `url` input would refuse the path the server accepts, so the server's
      // check is the one that decides, and its 400 is the toast above.
      { field: 'destination', control: 'text', label: '$t:admin.links.destination' },
    ],
  }) as PageComponent

/** The New link dialog's id: what the header button opens. */
const NEW_LINK_DIALOG_ID = 'admin-link-create-dialog'

/**
 * The New link gesture: the page's primary action, last in the control row,
 * as Invite is on Users.
 *
 * It opens the create DIALOG over the catalogue rather than a form below it:
 * minting a link is one short form, the catalogue stays in view behind it, and
 * the new row appears there when the dialog closes. Minting is a write, so the
 * read-only tier is not offered the button at all.
 */
const newLinkAffordance = (): PageComponent =>
  ({
    type: 'button',
    label: '$t:admin.links.create.heading',
    visibility: { capability: 'edit-operations' },
    props: { className: 'sm:ml-auto', interactions: { click: { modal: NEW_LINK_DIALOG_ID } } },
  }) as PageComponent

/** The create dialog: the heading, the one sentence, and the two-field form. */
const newLinkDialog = (): PageComponent =>
  ({
    type: 'dialog',
    title: '$t:admin.links.create.heading',
    description: '$t:admin.links.create.body',
    visibility: { capability: 'edit-operations' },
    props: { id: NEW_LINK_DIALOG_ID },
    children: [newLinkForm()],
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
    // Both halves, because the click readers answer an admin-equivalent caller
    // only: a read-only operator would get three refused tiles and a chart
    // printing the refusal. She reads the population figure alone — below.
    visibility: { declares: 'analytics', capability: 'administer-accounts' },
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
              kpiTile(
                '$t:admin.analytics.clicks',
                ANALYTICS_OVERVIEW_ENDPOINT,
                'summary.pageViews',
                CLICK_QUERY
              ),
              kpiTile(
                '$t:admin.analytics.uniqueVisitors',
                ANALYTICS_OVERVIEW_ENDPOINT,
                'summary.uniqueVisitors',
                CLICK_QUERY
              ),
              kpiTile(
                '$t:admin.analytics.sessions',
                ANALYTICS_OVERVIEW_ENDPOINT,
                'summary.sessions',
                CLICK_QUERY
              ),
              kpiTile('$t:admin.links.tracked', LINKS_ENDPOINT, 'total', CATALOG_FIRST_PAGE),
            ],
          },
        ],
      },
      trendChart(CLICK_QUERY),
    ],
  }) as PageComponent

/**
 * The metrics region for a caller the click readers refuse: the catalog's
 * population figure, which reads the links endpoint she is answered on. No
 * period rail — a count of links has no window.
 */
const catalogOnlyMetrics = (): PageComponent =>
  ({
    type: 'container',
    element: 'section',
    visibility: { declares: 'analytics', unlessCapability: 'administer-accounts' },
    props: {
      className: 'grid grid-cols-1 gap-4 pt-2 sm:grid-cols-2 lg:grid-cols-4',
      'aria-label': '$t:admin.links.metrics.region',
    },
    children: [kpiTile('$t:admin.links.tracked', LINKS_ENDPOINT, 'total', CATALOG_FIRST_PAGE)],
  }) as PageComponent

const directory = consolePage({
  id: 'dashboard-data-links',
  path: '/links',
  title: '$t:admin.meta.links',
  heading: ['$t:admin.links.heading', '$t:admin.links.blurb'],
  page: {
    requires: ['links'],
    window: WINDOW,
  },
  shell: { breadcrumb: { links: '$t:admin.crumb.links' } },
  body: [
    {
      type: 'container',
      element: 'div',
      props: { className: 'flex flex-col gap-6 pt-2' },
      children: [
        directoryMetrics(),
        catalogOnlyMetrics(),
        analyticsDisabledNote(),
        toolbarRow([toolbarSearch(LINKS_CHANNEL, '$t:admin.links.search'), newLinkAffordance()]),
        catalogGrid(),
      ],
    } as PageComponent,
    // The dialog renders in a portal, so where it sits in the tree changes
    // nothing on screen.
    newLinkDialog(),
  ],
}) satisfies PageConfig

export default [directory, detail] as readonly PageConfig[]
