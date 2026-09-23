/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// Records — the operator's own rows, one grid per declared table.
//
// TWO pages, because the surface answers two different questions:
//
//   `/tables`         the bare collection. Nothing useful to show: the sidebar's
//                     auto-expanded Records disclosure IS the table picker, so
//                     this 302s to the first table. It renders only for an app
//                     that declares NO tables, and then it is an empty state.
//   `/tables/:table`  one table's Airtable-grade record grid + the record-detail
//                     drawer a row click opens.
//
// ─── WHAT IT TOOK TO WRITE THIS AS CONFIG ──────────────────────────────────
//
// This page was the last Data surface that genuinely could not be authored, and
// the reason was narrow and specific: a config page written once cannot know
// which table it will be asked for, and could therefore neither BIND a grid to
// it nor enumerate its COLUMNS. Two primitives closed exactly that —
// `dataSource.table: $param.table` binds the table the URL names, and
// `columnsFrom: table` derives one column per declared field of whatever that
// turns out to be, honouring field-level read permissions server-side.
//
// A third thing had to move, and it is NOT visible here: `table` resolves
// columns, field meta and permissions from the RENDERING app's `tables`, which
// under a mount is the console preset's — and the preset declares none. The
// operator table the URL names is merged in by the MOUNT
// (`routeBoundOperatorTables`, `application/use-cases/mount/embedded-app-mount.ts`),
// which is the one place allowed to look at the operator's schema. Without it
// every table would 404.
//
// ─── WHY NOT A SYSTEM SOURCE OVER `/api/tables/:table/records` ─────────────
//
// It renders rows and silently drops the whole feature set the surface exists
// for. Inline edit, the typed create modal, the `_canCreate` gate, saved views
// and density are each gated on `!isSystemSource` by construction. The DB
// binding is what keeps them, which is why `columnsFrom` exists at all.

import { fillHost, pageHeading } from '../../components/data-page'
import { withShell } from '../../components/shell'
import { TABLES_OVERVIEW_ENDPOINT } from '../../system-sources'
import type { Page as PageConfig } from '@/domain/models/app'

/** One node of a page's component tree, as the config type expresses it. */
type PageComponent = NonNullable<PageConfig['components']>[number]

/**
 * The drawer id the grid's `onRowClick` dispatches to.
 *
 * Named once: `onRowClick: { action: 'openDrawer', component: … }` finds its
 * drawer by id, so a mismatch between the two is a row click that opens
 * nothing, with no error anywhere.
 */
const RECORD_DRAWER_ID = 'record-detail-drawer'

/** The Records crumb label, shared by both pages of the surface. */
const BREADCRUMB = { tables: '$t:admin.crumb.tables' } as const

/**
 * The whole-page empty state for an app that declares no tables.
 *
 * A `section` with an `aria-label`, so it is addressable as a landmark rather
 * than by its copy — the same shape every other Data surface's empty state uses.
 */
const noTablesState = (): PageComponent =>
  ({
    type: 'container',
    element: 'section',
    props: {
      'aria-label': '$t:admin.tables.empty.heading',
      className:
        'border-border bg-background-raised flex min-h-64 flex-col items-center justify-center gap-2 rounded-lg border p-10 text-center',
    },
    children: [
      {
        type: 'text',
        element: 'p',
        props: { className: 'text-foreground text-md font-medium' },
        content: '$t:admin.tables.empty.heading',
      },
      {
        type: 'text',
        element: 'p',
        props: { className: 'text-foreground-muted max-w-md text-md leading-relaxed' },
        content: '$t:admin.tables.empty.body',
      },
      {
        type: 'text',
        element: 'p',
        props: { className: 'text-foreground-subtle mt-1 max-w-md text-md italic' },
        content: '$t:admin.tables.empty.hint',
      },
    ],
  }) as PageComponent

/**
 * The table list `redirectToFirst` reads its first row from.
 *
 * ─── WHY THIS COMPONENT EXISTS AT ALL ──────────────────────────────────────
 *
 * `redirectToFirst` resolves its target from a list the PAGE declares — a
 * component `dataSource.system`, read server-side before the page renders.
 * Declaring one without a list is a decode error, deliberately: a redirect with
 * no source would silently never fire.
 *
 * It is a real directory, not a placeholder. When the operator has tables the
 * page 302s and this never paints; when they have none it is an empty list
 * under the empty state above, which is the honest pair — the state SAYS there
 * is nothing, and the list SHOWS nothing.
 *
 * ─── WHY `/api/admin/tables/overview` AND `by_table` ───────────────────────
 *
 * The same endpoint and the same key the sidebar's Records disclosure lazy-loads
 * (the `tables` disclosure in `../../components/sidebar`). That matters more than it looks: the two
 * lists must agree, or the bare path redirects to a table the picker does not
 * list. It also changes the redirect's ORDER, from first-DECLARED (what the
 * retired builder used) to first as this endpoint sorts them, which is
 * alphabetical — and the sidebar's order, so the landing table is now the one an
 * operator sees at the top of the picker rather than one only the config file
 * knows about.
 */
const tableDirectory = (): PageComponent =>
  ({
    type: 'list',
    props: { 'data-testid': 'admin-tables-directory', className: 'flex flex-col gap-1' },
    dataSource: { system: { endpoint: TABLES_OVERVIEW_ENDPOINT, rowsKey: 'by_table' } },
    listDisplay: {
      itemTemplate: { title: '{name}', subtitle: '{rowCount} records' },
      emptyMessage: 'No tables',
    },
  }) as PageComponent

/**
 * `/tables` — the bare collection.
 *
 * `hrefTemplate` is MOUNT-RELATIVE (`/tables/{name}`), like every other href the
 * preset writes: the mount moves it onto the console's base at boot, so the
 * config never spells `/_admin` and never doubles it.
 */
const directoryPage: PageConfig = withShell(
  {
    id: 'dashboard-data-tables',
    name: 'dashboard-data-tables',
    path: '/tables',
    meta: { title: '$t:admin.meta.tables', lang: 'en-US' },
    redirectToFirst: { hrefTemplate: '/tables/{name}' },
    components: [
      pageHeading('$t:admin.tables.heading', '$t:admin.tables.blurb'),
      noTablesState(),
      tableDirectory(),
    ],
  } as PageConfig,
  { breadcrumb: BREADCRUMB }
)

/**
 * The record grid for the table the URL names.
 *
 * `aria-label` carries `$param.table` because the specs — and an operator with a
 * screen reader — need the grid to name WHICH table it shows; the route-param
 * pass substitutes every string leaf, so an `aria-label` is reachable exactly as
 * a URL is.
 *
 * `columnsFrom: table` and NO `columns`: the two are mutually exclusive (a
 * decode error together), because a page cannot both author its columns and
 * derive them.
 *
 * Every literal below is copied from the retired builder deliberately, not
 * chosen. The two render on the same console until the migration completes, and
 * a grid whose search placeholder or empty message differed between a config
 * page and a builder page would visibly change under the SPA nav's content swap.
 */
const recordGrid = (): PageComponent =>
  ({
    type: 'table',
    props: { 'aria-label': 'Records $param.table' },
    dataSource: { table: '$param.table' },
    columnsFrom: 'table',
    // ─── THE GRID OWNS THE SCROLL ──────────────────────────────────────────
    //
    // The one board in the whole console canvas annotated `grid fills its
    // container` is this one — all five Records boards carry it, and no other
    // surface does. It is also the only grid page whose table IS the page: the
    // grid measures 1255px of a 1291px body, where every other console grid
    // sits under a band of KPIs, chips or filters that must keep their natural
    // height.
    //
    // What it fixes is not tidiness. Before this, `/tables/:table` at 1440×900
    // put a 1255px block inside a 900px column, so the column scrolled and the
    // column HEAD went with it: every row below the fold was an unlabelled
    // tuple. The pager sat at 1322, 422px below a 900px viewport, so the
    // operator reached page 2 by scrolling past all 25 rows of page 1.
    //
    // (The commit that introduced this said the header scrolled away "after
    // eight rows". That number was never measured and is wrong — 17 rows fit
    // above the fold at this size. The geometry either side of it is measured;
    // the row count was not, and a commit message cannot be corrected.)
    //
    // `fill` is HALF of the contract; the other half is the bounded chain that
    // `fillHost` and `withShell({ fill: true })` supply below. The schema is
    // explicit that `fill` does not create its own bound, and in an unbounded
    // document it degrades to the natural height rather than collapsing — so
    // the failure mode of getting the chain wrong is this comment's claim
    // quietly not being true, not a blank page.
    layout: 'fill',
    // Checkboxes, and the island's own "Export selected" with them.
    //
    // `multiple` rather than `single`: the operator reads a grid to act on a
    // SET — the rows a filter just isolated — and a single-select checkbox
    // column costs the same width while answering a question nobody asks of a
    // console.
    //
    // ─── NO `bulkActions`, AND THAT IS A DECISION ──────────────────────────
    //
    // The canvas draws three beside the count: Export selection, Set status,
    // Move to trash. Only the first ships, and it is not a bulk ACTION — it is
    // the island's own export of the selection, which `selection` alone brings.
    //
    // *Set status* cannot be authored here at all. This page is written once for
    // every table any operator will ever declare, and it derives its columns
    // with `columnsFrom` precisely because it cannot know them; a bulk action
    // naming a `status` field would be a control that works on the one table
    // that happens to have one and 400s on the rest.
    //
    // *Move to trash* could be authored — `POST /api/tables/:tableId/records/
    // bulk-delete` exists, and a delete here is soft. It is left out because the
    // console has no trash SURFACE: `.../batch/restore` exists as an endpoint
    // and nothing in this config lists a deleted row, so an operator who
    // trashed 25 rows would have no way to see them again, let alone restore
    // them. A destructive control whose undo exists only as an HTTP call is
    // worse than no control. The canvas draws `Trash · 23` as a second view of
    // this page; when that view ships, this action ships with it.
    selection: { mode: 'multiple' },
    // The `search` BLOCK is what renders the searchbox — `toolbar.search` alone
    // does not, a trap `data-links-surface` records too.
    search: { enabled: true, placeholder: 'Search rows' },
    // Without this a no-match search falls back to `emptyMessage` and tells the
    // operator the table is empty seconds after they watched it render a row.
    noMatchMessage: 'No record matches “{query}”',
    // Saved views + density, both gated on `!isSystemSource` — available here,
    // and ONLY here among the console grids, because this is the one bound to a
    // real DB table. `density` additionally persists through a table key, which
    // is the empty string for a system source, so declaring it elsewhere would
    // paint a control that silently cannot save.
    // The canvas's control row, in its order: `Grid · All invoices ·
    // Hide fields · Filter · Group · Sort · Trash`. Five of the six are toolbar
    // flags; `Trash` is the missing second view noted above.
    //
    // This is the row the 40px `toolbarRow()` exists for on OTHER surfaces, and
    // deliberately does NOT get one here: every control below is the table
    // island's own and renders INSIDE the grid frame, so lifting them into a
    // page-level row would draw a second, emptier bar above a bar that already
    // has them — and under `layout: 'fill'` it would cost the rows 40px to do
    // it. A page-level row is for affordances that belong to the PAGE; this
    // page has none that the grid does not already own.
    //
    // All five are gated on `!isSystemSource` in the island, so they can only
    // be claimed by a DB-bound grid — which, among the console's seven, is this
    // one alone.
    toolbar: {
      views: true,
      density: true,
      columnToggle: true,
      filters: true,
      groupBy: true,
      sort: true,
    },
    // The island caps at 25 rows with or without this block; what the block adds
    // is the PAGER and the "1–25 of 28" summary. A grid may cap; it may not cap
    // silently.
    pagination: { pageSize: 25, pageSizeOptions: [25, 50, 100] },
    onRowClick: { action: 'openDrawer', component: RECORD_DRAWER_ID },
    emptyMessage: 'No records',
  }) as PageComponent

/**
 * The record-detail drawer a row click opens.
 *
 * NO `recordFields`: the list is optional and DERIVES one typed control per
 * declared field of the bound table, which is the only thing that can work here
 * — the bound table is not known until the request arrives.
 *
 * `canEdit: true` is uniform, and matches what the retired builder passed. Every
 * caller who reaches a mounted console page is admin-tier (anonymous callers get
 * a 404 outside the public carve-out), and config is code-only, so there is no
 * console role that reads records without being allowed to edit them. The
 * records API enforces the real per-field decision regardless.
 */
const recordDrawer = (): PageComponent =>
  ({
    type: 'drawer',
    id: RECORD_DRAWER_ID,
    props: { title: 'Record details' },
    dataSource: { table: '$param.table' },
    canEdit: true,
  }) as PageComponent

/** `/tables/:table` — one table's grid, mounted full-width. */
const gridPage: PageConfig = withShell(
  {
    id: 'dashboard-data-tables-table',
    name: 'dashboard-data-tables-table',
    path: '/tables/:table',
    // The title cannot name the table: the route-param pass walks `components`
    // and `layout`, deliberately not `meta`, at parity with the `$query` and
    // `$app` passes. Widening one family without the others would leave three
    // `$`-references with three different reaches.
    meta: { title: '$t:admin.meta.tables', lang: 'en-US' },
    components: [
      pageHeading('$t:admin.tables.heading', '$t:admin.tables.blurb'),
      // `fillHost`, not `fullWidth`, and `fill: true` on the shell: the two
      // halves of the bounded parent `layout: 'fill'` requires and does not
      // create. Measured at 1440×900 — with any ONE of the three missing, the
      // column scrolls its full 439px and the grid ends 422px below the fold,
      // exactly as it did before this wave. There is no partial credit here.
      fillHost([recordGrid(), recordDrawer()]),
    ],
  } as PageConfig,
  { breadcrumb: BREADCRUMB, fill: true }
)

/**
 * Both pages, DIRECTORY FIRST.
 *
 * Order is load-bearing: `findMatchingRoute` takes the first pattern that
 * matches, with no static-over-dynamic precedence, and `/tables/:table` does not
 * match `/tables` — so the two are disjoint and the order is free today. It is
 * written this way to read as the operator meets them, and any future literal
 * sub-path (`/tables/new`) MUST be inserted ahead of the `:table` page or the
 * param page will swallow it.
 */
export default [directoryPage, gridPage] satisfies readonly PageConfig[]
