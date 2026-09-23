/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// SYSTEM · Decisions — the architecture decision records the running app
// declares in `app.decisions[]`: a register to scan, one document to read.
//
// ─── WHAT THIS SURFACE IS FOR ──────────────────────────────────────────────
//
// Every other console page answers WHAT the app is: its tables, its automations,
// its variables. None of them answers WHY any of it is that way. An operator who
// inherits a running app can read that `DATABASE_URL` points at Postgres and
// still not know that it used to be SQLite, that the write lock was hit daily,
// or that the record saying so is still in the register with its status set to
// `superseded`. This is the page where the config explains itself.
//
// ─── READ-ONLY, AND STRUCTURALLY SO ────────────────────────────────────────
//
// [internal ref] amendment A6 authorises the register as an INTROSPECTION surface, on
// the same invariant as the two config reads A1 authorised: reading the running
// configuration is observability, mutating it is authoring. There is no edit
// control here because there is nothing to edit against — `GET /api/admin/decisions`
// is the only address the register has, a decision is changed in `app.ts` and
// redeployed, and the page says so where an operator would look for a button.
//
// ─── THREE THINGS THE CANVAS DRAWS THAT CONFIG CANNOT SAY ──────────────────
//
// Recorded here rather than silently dropped, because each is a platform gap
// with a shipped substitute rather than a decision taken on this surface.
//
//  1. STATUS CHIPS. The canvas draws `all · accepted · proposed · superseded` as
//     a chip row over the grid. A chip row is expressible — `/links` draws one
//     over `?period=` — but it would filter NOTHING: the endpoint takes no
//     parameters (it returns the register whole, by design), a `table` has no
//     static row predicate, and a `visibility.query` gate over four copies of
//     the same grid would render four identical unfiltered tables. A control
//     that redraws itself and changes no row is worse than no control. The
//     shipped substitute is the runtime filter builder (`toolbar.filters`),
//     which filters the rows the grid actually holds — and it holds all of them,
//     because the endpoint never pages.
//
//  2. NEWEST FIRST. The endpoint returns the DECLARED order deliberately —
//     "ordering is a reading choice and belongs to the surface that makes it" —
//     and this surface cannot make it: `defaultSort` was removed from the table
//     schema (it typed and then failed `sovrium validate`, the drift its
//     docstring still records). So the register reads in the order `app.ts`
//     states it, which is at least a fact about the file, and `toolbar.sort`
//     is how a reader asks for it by date.
//
// 3. A ONE-CELL LINEAGE COLUMN. The canvas prints `supersedes [internal ref]` or
// `superseded by [internal ref]` in one column. A column binds ONE field and there
//     is no cell template, so the two directions would be two columns of mostly
//     empty cells. The grid carries the one that changes what a reader should
//     DO — `Superseded by`, which marks a record not to act on — and the
//     document carries both, as links, in the record rail.
//
//  4. THE COUNTS. The canvas prints `12 decisions` and
//     `8 accepted · 2 proposed · 2 superseded` in the chrome bar. The endpoint
//     publishes all four as flat scalars for exactly that, and no config path
//     renders a system-bound scalar as bar text — the gap the `chromeEnd`
//     contract already records. They are NOT relocated to a `kpi` strip: that
//     would be four lazy islands over a page whose entire content is one small
//     table, on a surface the canvas draws with no tiles at all.
//
// ─── WHY TWO ROUTES AND NOT `?id=` ─────────────────────────────────────────
//
// The document was planned as a `?id=` view switch on this one route. It is not
// expressible: `page.query` REQUIRES a closed `enum` (an out-of-list URL value
// clamps to the default), and the ids belong to the host app's register, which
// a platform-owned preset compiled into the binary cannot enumerate. A path
// segment has no such allow-list, so the document is `/decisions/:id` — the same
// shape `/links/:slug`, `/users/:email` and `/tables/:table` already take.

import { fillHost, pageHeading, toolbarRow } from '../components/data-page'
import { withShell } from '../components/shell'
import { DECISIONS_ENDPOINT } from '../system-sources'
import type { Page as PageConfig } from '@/domain/models/app'

/**
 * One node of a page's component tree, as the config type expresses it.
 *
 * Derived rather than imported: the generated declaration `sovrium types` writes
 * exports `PageConfig` and not the node type inside it, so every console page
 * that needs to name one narrows it here — the same line `data/links.ts` and its
 * siblings carry.
 */
type PageComponent = NonNullable<PageConfig['components']>[number]

/** The register grid, named once so a future refetch can address it. */
const REGISTER_GRID_ID = 'admin-decisions-register'

/**
 * The register, as ROWS.
 *
 * Bound twice — once by the grid island on `/decisions`, once by the document's
 * row template on `/decisions/:id` — because there is no per-id read. The whole
 * register is one small array the endpoint builds synchronously from the decoded
 * config, so the document costs the same request the register does.
 */
const DECISION_ROWS = {
  system: { endpoint: DECISIONS_ENDPOINT, rowsKey: 'decisions', idKey: 'id' },
} as const

/**
 * Render an optional lineage value only where the record HAS one.
 *
 * `notIn: ['undefined', '']` rather than an `exists` operator, because there is
 * no `exists` operator. The predicate coerces with `String(value)` before it
 * compares (`matchesConditionOperators`), so an OMITTED key arrives as the
 * literal string `'undefined'` — this endpoint omits rather than nulls, and the
 * `''` half covers a source that blanks instead. Both spellings of "there is no
 * value here" in one list.
 *
 * Without it the rail prints a label over nothing, which is the failure the
 * Environment page's own row template already names: a bare `Default` with no
 * default after it is a word not doing work.
 */
const whereSet = (field: string) => ({ record: { field, notIn: ['undefined', ''] } }) as const

// ─── THE REGISTER ──────────────────────────────────────────────────────────

/**
 * Status, as WEIGHT and INK — never as a box, and never as colour.
 *
 * `accepted` is the resting state of a register and takes no treatment at all:
 * four quiet rows and two that are not is the whole signal. `proposed` gains
 * weight because it is the one row an operator might still argue with, and
 * `superseded` recedes because it is history that has to stay readable without
 * competing with what is in force.
 *
 * ─── WHY NOT THE CHIP THE CANVAS DRAWS ─────────────────────────────────────
 *
 * `cellStyle.className` is applied TWICE — to the `<td>` and again to the
 * `<span>` inside it. Measured here: `rounded-full border px-2 py-0.5` on
 * `proposed` painted a pill inside a second, cell-sized rounded box spanning the
 * whole column. Any box treatment has that shape, which is why the existing
 * console status pills (`/connections`) render as full-cell coloured bars. So a
 * chip is not authorable from config today, and the honest alternative is the
 * one this page takes.
 *
 * No colour on any of the three either. Colour here would be decoration, and the
 * only ramp left is `error` ([internal ref] D3, amendment A1) — nothing about a
 * decision being proposed is an error.
 */
const STATUS_COLUMN = {
  field: 'status',
  label: 'Status',
  width: 120,
  valueLabels: { accepted: 'Accepted', proposed: 'Proposed', superseded: 'Superseded' },
  cellStyle: [
    { when: { eq: 'proposed' }, className: 'text-foreground font-medium' },
    { when: { eq: 'superseded' }, className: 'text-foreground-subtle' },
  ],
} as const

/**
 * The drill-down, as a row ACTION and never as `onRowClick`.
 *
 * The two cannot coexist: a row's click handler fires before the buttons in an
 * action column, so every control in that column becomes a navigation instead —
 * measured on `/links` and `/users` before it was fixed in the platform
 *, and still the wrong affordance even now that the
 * conflict is resolved. A row that silently navigates is reachable by pointer
 * only; this is a button in the tab order with an accessible name.
 *
 * `mode: 'navigate'` on a FETCH action, not a top-level `type: 'navigate'`: the
 * action dispatcher emits data attributes for `automation` / `auth` / `crud` /
 * `fetch` only, so a bare `navigate` renders a button that does nothing. The url
 * is mount-relative like every other intra-console path.
 */
const OPEN_ACTION = {
  type: 'actions',
  label: 'Actions',
  actions: [
    { label: 'Open', action: { type: 'fetch', mode: 'navigate', url: '/decisions/$record.id' } },
  ],
} as const

/**
 * The register's columns.
 *
 * Every `label` is a LITERAL. The grid is island-hosted, so its column labels
 * and `valueLabels` are serialized into `data-island-props` verbatim and a `$t:`
 * token would ship the raw key into a table header.
 *
 * `touches` is an ARRAY, and it prints comma-joined: neither the cell renderer
 * nor `$record.` substitution has a separator to give it, and iterating an array
 * field is the open proposal [internal ref] rather than something this page can author.
 * It is still the most useful column on the grid — it is how an operator finds
 * the decision that explains the property they are looking at.
 */
const REGISTER_COLUMNS = [
  { field: 'id', label: 'ID', width: 110 },
  { field: 'title', label: 'Title' },
  STATUS_COLUMN,
  { field: 'date', label: 'Date', width: 120 },
  { field: 'touches', label: 'Touches' },
  { field: 'supersededBy', label: 'Superseded by', width: 150 },
  OPEN_ACTION,
]

/**
 * The register grid.
 *
 * ─── SEARCH IS CLIENT-SIDE, AND HONESTLY SO ────────────────────────────────
 *
 * The endpoint takes no `?q=` and emits no `appliedQuery`, which is exactly the
 * tri-state contract's "this endpoint does not search; filter client-side". The
 * second half of that argument is the projection: a register is bounded by the
 * config rather than by data, so the grid holds EVERY row, and the fields an
 * operator searches by — id, title, date, touches — are all rendered columns, so
 * the in-memory filter can actually match them. Both conditions that made the
 * paginated grids lie are absent here.
 *
 * No `pagination` block for the same reason the connections directory has none:
 * the endpoint takes no paging parameters and the island sets
 * `manualPagination` unconditionally, so a declared pager would report a slice
 * it never made.
 *
 * `layout: 'fill'` is one of the three links of the fill chain, and the other
 * two are `fillHost` below and `withShell(…, { fill: true })` above. All three
 * or none: two of the three were measured to buy exactly nothing.
 */
const registerGrid = (): PageComponent =>
  ({
    type: 'table',
    props: { id: REGISTER_GRID_ID, 'aria-label': '$t:admin.decisions.register.region' },
    dataSource: DECISION_ROWS,
    columns: REGISTER_COLUMNS,
    layout: 'fill',
    search: { enabled: true, placeholder: 'Search decisions' },
    toolbar: { search: true, filters: true, sort: true },
    emptyMessage: 'No decisions declared. Add a decisions[] block to your app config.',
    noMatchMessage: 'No decision matches “{query}”',
  }) as PageComponent

/**
 * Where the register lives, said once, where a reader looks for an edit control.
 *
 * The one sentence on this page that is not data. It is here rather than absent
 * because "read-only" on its own answers the wrong question: an operator who
 * cannot edit needs to know WHERE the record is instead, and the answer is a
 * file in their own repository.
 */
const provenance = (): PageComponent =>
  ({
    type: 'text',
    element: 'p',
    props: { className: 'text-foreground-subtle text-sm' },
    content: '$t:admin.decisions.provenance',
  }) as PageComponent

const registerPage: PageConfig = withShell(
  {
    id: 'dashboard-decisions',
    name: 'dashboard-decisions',
    path: '/decisions',
    meta: { title: '$t:admin.meta.decisions', lang: 'en-US' },
    components: [
      pageHeading('$t:admin.decisions.heading', '$t:admin.decisions.blurb'),
      fillHost([toolbarRow([provenance()]), registerGrid()]),
    ],
  } as PageConfig,
  { breadcrumb: { decisions: '$t:admin.crumb.decisions' }, fill: true }
)

// ─── ONE DECISION ──────────────────────────────────────────────────────────

/** A prose part of the record: its Nygard heading, and the paragraph under it. */
const part = (heading: string, body: string): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: { className: 'flex flex-col gap-1.5' },
    children: [
      {
        type: 'text',
        element: 'h3',
        props: { className: 'text-foreground text-sm font-medium' },
        content: heading,
      },
      {
        type: 'text',
        element: 'p',
        props: { className: 'text-foreground-muted max-w-[72ch] text-md leading-relaxed' },
        content: body,
      },
    ],
  }) as PageComponent

/**
 * One label-and-value row of the record rail.
 *
 * `gate` is {@link whereSet}'s output and nothing else: the only conditional
 * rows here are the two lineage links, and typing the parameter as the helper's
 * return keeps a hand-written predicate from drifting in beside them.
 */
const railRow = (
  label: string,
  value: PageComponent,
  gate?: ReturnType<typeof whereSet>
): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: { className: 'flex items-baseline justify-between gap-4' },
    ...(gate === undefined ? {} : { visibility: gate }),
    children: [
      {
        type: 'text',
        element: 'span',
        props: { className: 'text-foreground-subtle shrink-0 text-sm' },
        content: label,
      },
      value,
    ],
  }) as PageComponent

/**
 * A rail value that is plain text.
 *
 * `min-w-0 break-words text-right` on every one of them: the rail is 288px at
 * `lg` and several of these values are the author's own free text — a touches
 * list, a list of deciders — so the value has to be allowed to wrap rather than
 * push its own label out of the box.
 */
const railText = (content: string, extra = 'text-foreground'): PageComponent =>
  ({
    type: 'text',
    element: 'span',
    props: { className: `${extra} min-w-0 text-right text-sm break-words` },
    content,
  }) as PageComponent

/**
 * A rail value that is a link to another record in the same register.
 *
 * Both directions of a supersession are AUTHORED and both must agree — the
 * decode refuses a one-sided link — so a lineage link here can never be a link
 * into a record that does not exist. That is what makes it safe to render as a
 * link rather than as an id an operator has to go and find.
 */
const railLink = (field: string): PageComponent =>
  ({
    type: 'link',
    content: `$record.${field}`,
    props: {
      href: `/decisions/$record.${field}`,
      className: 'text-foreground font-mono text-sm underline',
    },
  }) as PageComponent

/**
 * The record rail: who, when, what it touched, and where it sits in the chain.
 *
 * `deciders` and `touches` are arrays and print comma-joined, for the reason the
 * Touches column already carries. `Source` names the file rather than the index
 * — `decisions[7]` would be a position the endpoint does not publish, and an
 * index that moves the moment a record is inserted above it is worse than the
 * file name alone.
 */
const recordRail = (): PageComponent =>
  ({
    type: 'container',
    element: 'aside',
    props: {
      'aria-label': '$t:admin.decisions.record.region',
      className:
        'border-border bg-background-raised flex shrink-0 flex-col gap-3 rounded-lg border p-4 lg:w-72',
    },
    children: [
      {
        type: 'text',
        element: 'h3',
        props: { className: 'text-foreground text-sm font-medium' },
        content: '$t:admin.decisions.record.heading',
      },
      // `capitalize` rather than the raw value, because the GRID renders this
      // same field through `valueLabels` — `Superseded`, not `superseded` — and
      // a reader who opens a row from that grid must not meet a second spelling
      // of the word they just clicked. A rail value takes no `valueLabels`, and
      // all three statuses are one word, so the CSS transform reproduces the
      // grid's three labels exactly rather than approximating them.
      railRow(
        '$t:admin.decisions.field.status',
        railText('$record.status', 'text-foreground capitalize')
      ),
      railRow(
        '$t:admin.decisions.field.date',
        railText('$record.date', 'text-foreground font-mono')
      ),
      railRow('$t:admin.decisions.field.deciders', railText('$record.deciders')),
      railRow(
        '$t:admin.decisions.field.supersedes',
        railLink('supersedes'),
        whereSet('supersedes')
      ),
      railRow(
        '$t:admin.decisions.field.supersededBy',
        railLink('supersededBy'),
        whereSet('supersededBy')
      ),
      railRow('$t:admin.decisions.field.touches', railText('$record.touches')),
      railRow(
        '$t:admin.decisions.field.source',
        railText('app.ts › decisions[]', 'text-foreground-subtle font-mono')
      ),
    ],
  }) as PageComponent

/**
 * The document itself — the template expanded for the ONE record the URL names.
 *
 * `visibility.record` against `$param.id` is the only idiom that marks a FETCHED
 * row: `activeWhen` runs before the rows are expanded and compares literals, so
 * `$record.id` is still a raw token when it fires. The route-param pass walks
 * every string leaf, so by row-expansion time this predicate is literal against
 * literal and exactly one row survives.
 *
 * An id in the URL that names no record renders no document at all. That is the
 * SSR row template's known gap — the template is deleted at zero surviving rows
 * and there is no `emptyMessage` slot on that path — so the back link and the
 * page's own heading are deliberately OUTSIDE this binding: whatever the URL
 * says, the page still names itself and still has a way out.
 */
const documentBody = (): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    // `contents`, so the surviving row sits in the page's own flow rather than
    // inside a second box — the shape the design-system nav column already uses.
    //
    // `list-none` is NOT cosmetic here. The row expansion wraps every record's
    // clone in a SYNTHESIZED `<li>` that takes no props from the template, and a
    // `display: list-item` box draws its marker whatever its parent is — so the
    // document shipped with a bullet floating to the left of the record id until
    // this was added. `list-style-type` is inherited, which is why it can be set
    // on a `display: contents` ancestor at all.
    props: { className: 'contents list-none' },
    dataSource: DECISION_ROWS,
    children: [
      {
        type: 'container',
        element: 'div',
        props: { className: 'flex min-w-0 flex-col gap-4' },
        visibility: { record: { field: 'id', eq: '$param.id' } },
        children: [
          {
            type: 'container',
            element: 'div',
            props: { className: 'flex flex-wrap items-baseline gap-x-3 gap-y-1' },
            children: [
              {
                type: 'text',
                element: 'span',
                props: { className: 'text-foreground-subtle font-mono text-sm' },
                content: '$record.id',
              },
              {
                type: 'text',
                element: 'h2',
                props: { className: 'text-foreground text-lg font-medium' },
                content: '$record.title',
              },
            ],
          },
          {
            type: 'container',
            element: 'div',
            props: { className: 'flex flex-col gap-6 lg:flex-row lg:items-start' },
            children: [
              {
                type: 'container',
                element: 'div',
                props: {
                  className:
                    'border-border bg-background-raised flex min-w-0 flex-1 flex-col gap-5 rounded-lg border p-6',
                },
                children: [
                  part('$t:admin.decisions.part.context', '$record.context'),
                  part('$t:admin.decisions.part.decision', '$record.decision'),
                  part('$t:admin.decisions.part.consequences', '$record.consequences'),
                ],
              } as PageComponent,
              recordRail(),
            ],
          } as PageComponent,
        ],
      } as PageComponent,
    ],
  }) as PageComponent

/** Back to the register — the only way out of a page with no sidebar row. */
const backToRegister = (): PageComponent =>
  ({
    type: 'link',
    content: '$t:admin.decisions.back',
    props: {
      href: '/decisions',
      className: 'text-foreground-muted hover:text-foreground text-sm underline',
    },
  }) as PageComponent

/**
 * `/decisions/:id` — one record, read in full.
 *
 * The `h1` names the SURFACE and the trail's last crumb names the object, which
 * is the object-sub-page convention `/tables/:table` and `/forms/:form` already
 * follow: a screen-reader user gets "what kind of page is this" from the heading
 * and "which one" from the trail. The visible title is an `h2` inside the row
 * template, because it is the record's and not the page's.
 *
 * `meta.title` cannot name the record: the route-param pass walks `components`
 * and `layout`, deliberately not `meta`.
 */
const documentPage: PageConfig = withShell(
  {
    id: 'dashboard-decision',
    name: 'dashboard-decision',
    path: '/decisions/:id',
    meta: { title: '$t:admin.meta.decision', lang: 'en-US' },
    components: [
      pageHeading('$t:admin.decisions.one.heading', '$t:admin.decisions.one.blurb'),
      {
        type: 'container',
        element: 'div',
        props: { className: 'flex flex-col gap-6 pt-2' },
        children: [toolbarRow([backToRegister()]), documentBody()],
      } as PageComponent,
    ],
  } as PageConfig,
  { breadcrumb: { decisions: '$t:admin.crumb.decisions' } }
)

/** The register and the one document that reads out of it. */
export const decisionPages: readonly PageConfig[] = [registerPage, documentPage]
