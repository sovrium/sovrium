/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// Submissions — what your forms received, one inbox per form.
//
//   `/forms`        the bare collection, which 302s to the first form; it
//                   renders only for an app that declares none.
//   `/forms/:form`  that form's metrics, toolbar, inbox and detail drawer.
//
// ─── THE ONE THING THAT NEEDED SOLVING: LINKING OUT OF THE CONSOLE ─────────
//
// The toolbar carries an "Open form" link to the LIVE, submittable form — a page
// of the OPERATOR's app, not of the console. Every mount-local `href` a preset
// page writes is moved onto the mount's base at boot, which is exactly right for
// a console link and exactly wrong for this one: `/forms/contact` would become
// `/_admin/forms/contact`, the page the operator is already on.
//
// `$app.origin` resolves that without a new primitive. A value that does not
// begin with `/` is not a mount-local path, so the boot walk leaves it alone;
// at render it becomes the scheme and host THIS request arrived on, which for a
// mounted console is the operator's own app. The result is an absolute URL out
// of the console and into the live form.
//
// ─── ONE BEHAVIOUR CHANGE, STATED ─────────────────────────────────────────
//
// The link now always targets the CANONICAL `/forms/{name}` route, where a form
// is reachable whether or not it declares a custom `path` (`FormPathSchema`).
// The retired builder preferred the custom path when one was declared. Config
// cannot read it — `$param.form` is the form's NAME, and the declared path is
// not on the route — so a form declaring `path: /contact` now opens at
// `/forms/contact` instead. Both serve the same form; only the address is less
// pretty.

import {
  fillHost,
  pageHeading,
  tabQuery,
  tabbedBody,
  tabPanel,
  toolbarRow,
} from '../../components/data-page'
import { withShell } from '../../components/shell'
import { FORMS_ENDPOINT } from '../../system-sources'
import type { Page as PageConfig } from '@/domain/models/app'

/** One node of a page's component tree, as the config type expresses it. */
type PageComponent = NonNullable<PageConfig['components']>[number]

/** Drawer id the inbox opens on a row click (the list → detail drill-down). */
const DETAIL_DRAWER_ID = 'form-submission-detail'

/** The Submissions crumb label, shared by both pages of the surface. */
const BREADCRUMB = { forms: '$t:admin.crumb.forms' } as const

/** Outline toolbar-button chrome, shared by the export button and the form link. */
const TOOLBAR_BTN =
  'border-border text-foreground-subtle hover:text-foreground inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-md'

/** Neutral status pill, one per lifecycle status. */
const STATUS_PILL = 'bg-background-subtle text-foreground-subtle rounded-full px-2 py-0.5 text-sm'

/**
 * Submission lifecycle status → display label.
 *
 * The endpoint returns the RAW status, so this is a render-only relabel and the
 * API contract is untouched. An unmapped status renders verbatim rather than
 * disappearing.
 */
const STATUS_LABELS = {
  received: 'received',
  processing: 'in progress',
  processed: 'processed',
  done: 'processed',
  failed: 'failed',
  spam: 'spam',
} as const

/** This form's admin submissions endpoint (rows envelope: `{ items }`). */
const SUBMISSIONS_ENDPOINT = '/api/admin/forms/$param.form/submissions'

/**
 * This form's aggregate endpoint — the Insights panel's single source.
 *
 * It answers 200 with `{ disabled: true, reason: 'analytics-opted-out' }` for a
 * form that declared `analytics.enabled: false`, rather than 404. Every figure
 * bound below then resolves to nothing and degrades to the neutral em-dash,
 * which is the right reading: the form opted out, so there is no number.
 */
const FORM_ANALYTICS_ENDPOINT = '/api/admin/forms/$param.form/analytics'

/**
 * The submissions grid: status pill, received timestamp, row-click drill-down.
 *
 * ─── WHY BOTH `search` AND `toolbar.search` ────────────────────────────────
 *
 * The render guard is `showSearch && searchConfig`; `toolbar.search` alone paints
 * no box. Declaring one is the quiet way to ship an inert control.
 *
 * ─── WHY THERE IS NO `pagination` BLOCK ────────────────────────────────────
 *
 * The endpoint is CURSOR-paginated and reports no total, while the grid's pager
 * is page-number based and derives its total from the rows it holds. Declaring
 * the block painted three wrong answers at once against 30 seeded submissions:
 * the summary read "1–25 of 25"; "Page 1 of 1" left Next permanently disabled;
 * and the `page=2` it would have sent is not on the handler's allow-list, so it
 * re-served page 1 verbatim. The rows stay capped at the fetch's 25 either way —
 * the block never controlled that — so the cap is STATED beneath the grid.
 */
const submissionsGrid = (): PageComponent =>
  ({
    type: 'table',
    props: { 'aria-label': '$t:admin.forms.submissions.region' },
    dataSource: { system: { endpoint: SUBMISSIONS_ENDPOINT, rowsKey: 'items', idKey: 'id' } },
    columns: [
      {
        field: 'status',
        label: 'Status',
        valueLabels: STATUS_LABELS,
        cellStyle: Object.keys(STATUS_LABELS).map((value) => ({
          when: { eq: value },
          className: STATUS_PILL,
        })),
      },
      { field: 'submittedAt', label: 'Received', format: 'datetime' },
    ],
    search: { enabled: true, placeholder: 'Search submissions' },
    toolbar: { search: true },
    // The grid owns the scroll on this surface. There is no pager to keep on
    // screen (the note above says why), so what fill buys here is the pinned
    // column header — twenty-five rows of status and timestamp are unreadable
    // once the header has scrolled off, and the read-window note below the
    // grid stops being something an operator has to scroll past the rows to
    // find.
    layout: 'fill',
    // Checkboxes, and the island's own "Export selected" with them — the one
    // half of the canvas's selection bar that this console can actually honour.
    //
    // The canvas draws `{{chkCount}} selected · Export selection · Delete`, and
    // annotates the pair with `POST /api/admin/forms/:form/submissions/_bulk ·
    // at most 100 ids`. That endpoint EXISTS and it is a bulk **read** —
    // `forms-routes.ts:380` documents it as "bulk read by id array", and there
    // is no bulk delete beside it. So *Delete* is drawn against a route that
    // would answer the wrong verb, and it ships as nothing rather than as a
    // control that fails on click.
    //
    // *Export selection* needs no endpoint at all: the island exports the rows
    // it already holds. That was inferred from the records grid when this was
    // written and is now measured HERE, on this inbox: "Export selected" is
    // `disabled` at rest and arms on the first tick, so it is a live control
    // rather than a permanently grey one.
    //
    // A checkbox column on a grid that already has `onRowClick` is the same
    // coexistence question [internal ref]'s row-action regression asked, so it was
    // measured rather than assumed: ticking a checkbox leaves the drawer shut
    // (0 dialogs), and a click anywhere else on the row still opens it.
    selection: { mode: 'multiple' },
    emptyMessage: 'No submissions yet',
    noMatchMessage: 'No submission matches “{query}”',
    onRowClick: { action: 'openDrawer', component: DETAIL_DRAWER_ID },
  }) as PageComponent

/**
 * The READ-ONLY per-submission detail drawer.
 *
 * A SYSTEM-detail source, so `recordFields` describes the endpoint envelope
 * rather than a declared table — there is no table to derive from, and none to
 * PATCH, which is why the drill-down is `canEdit: false`.
 *
 * `:id` and `$param.form` are two different grammars in one string: the first is
 * the endpoint's id slot, filled client-side from the clicked row; the second is
 * a route segment, substituted server-side. Neither sees the other.
 */
const detailDrawer = (): PageComponent =>
  ({
    type: 'drawer',
    id: DETAIL_DRAWER_ID,
    dataSource: { system: { endpoint: `${SUBMISSIONS_ENDPOINT}/:id` } },
    canEdit: false,
    recordFields: [
      { name: 'status', type: 'single-line-text' },
      { name: 'submittedAt', type: 'single-line-text' },
    ],
  }) as PageComponent

/**
 * The toolbar: out to the live form, then the CSV export.
 *
 * The export `filename` carries `$param.form` too. The reference grammar ends at
 * the first character that cannot continue an identifier, so
 * `$param.form-submissions.csv` resolves to `contact-submissions.csv` rather
 * than swallowing the suffix.
 */
const toolbar = (): PageComponent =>
  toolbarRow([
    {
      type: 'link',
      content: '$t:admin.forms.openForm',
      props: {
        href: '$app.origin/forms/$param.form',
        target: '_blank',
        rel: 'noopener noreferrer',
        'aria-label': '$t:admin.forms.openForm',
        className: TOOLBAR_BTN,
      },
    } as PageComponent,
    {
      type: 'button',
      label: 'Export to CSV',
      props: { 'aria-label': '$t:admin.forms.export.region', className: TOOLBAR_BTN },
      action: {
        type: 'fetch',
        mode: 'download',
        url: `${SUBMISSIONS_ENDPOINT}/export?format=csv`,
        filename: '$param.form-submissions.csv',
      },
    } as PageComponent,
  ])

/**
 * The submissions count over the read window.
 *
 * One of the two figures this endpoint actually measures — see {@link gapCard}
 * for the four it does not, and why they are words rather than tiles.
 */
const submissionsKpi = (): PageComponent =>
  ({
    type: 'kpi',
    label: 'Submissions',
    dataSource: { system: { endpoint: FORM_ANALYTICS_ENDPOINT, valuePath: 'totalCount' } },
    kpiFormat: { type: 'number' },
  }) as PageComponent

/**
 * The read-window statement, directly beneath the grid.
 *
 * The fetch returns at most 25 submissions and the surface cannot page past
 * them, so the window is DECLARED rather than inferred from a row count. The
 * second sentence names the affordance that does reach older submissions and
 * admits it carries the same cap — otherwise removing the pager would relocate
 * the wrong answer one interaction later rather than remove it.
 */
const readWindowNote = (): PageComponent =>
  ({
    type: 'text',
    element: 'p',
    props: { className: 'text-foreground-subtle mt-2 text-md' },
    content: '$t:admin.forms.scope',
  }) as PageComponent

/** The whole-page empty state for an app that declares no forms. */
const noFormsState = (): PageComponent =>
  ({
    type: 'container',
    element: 'section',
    props: {
      'aria-label': '$t:admin.forms.empty.heading',
      className:
        'border-border bg-background-raised flex min-h-64 flex-col items-center justify-center gap-2 rounded-lg border p-10 text-center',
    },
    children: [
      {
        type: 'text',
        element: 'p',
        props: { className: 'text-foreground text-md font-medium' },
        content: '$t:admin.forms.empty.heading',
      },
      {
        type: 'text',
        element: 'p',
        props: { className: 'text-foreground-muted max-w-md text-md leading-relaxed' },
        content: '$t:admin.forms.empty.body',
      },
      {
        type: 'text',
        element: 'p',
        props: { className: 'text-foreground-subtle mt-1 max-w-md text-md italic' },
        content: '$t:admin.forms.empty.hint',
      },
    ],
  }) as PageComponent

/**
 * The form list `redirectToFirst` reads its first row from.
 *
 * The same endpoint and key the sidebar's Submissions disclosure lazy-loads, so
 * the bare path can never land on a form the picker does not offer.
 */
const formDirectory = (): PageComponent =>
  ({
    type: 'list',
    props: { 'data-testid': 'admin-forms-directory', className: 'flex flex-col gap-1' },
    dataSource: { system: { endpoint: FORMS_ENDPOINT, rowsKey: 'items' } },
    listDisplay: {
      itemTemplate: { title: '{name}' },
      emptyMessage: 'No forms',
    },
  }) as PageComponent

/** `/forms` — the bare collection. */
const directoryPage: PageConfig = withShell(
  {
    id: 'dashboard-data-forms',
    name: 'dashboard-data-forms',
    path: '/forms',
    meta: { title: '$t:admin.meta.forms', lang: 'en-US' },
    redirectToFirst: { hrefTemplate: '/forms/{name}' },
    components: [
      pageHeading('$t:admin.forms.heading', '$t:admin.forms.blurb'),
      noFormsState(),
      formDirectory(),
    ],
  } as PageConfig,
  { breadcrumb: BREADCRUMB }
)

/**
 * The two halves of this route, and the `?tab=` value that addresses each.
 *
 * INBOX FIRST: an operator opens a form's surface to read what came in. The
 * metrics sat ABOVE that inbox and pushed it below the fold on every visit,
 * which is the wrong trade for a figure most readings do not need.
 */
const TABS = [
  { id: 'inbox', label: 'Inbox' },
  { id: 'insights', label: 'Insights' },
] as const

/**
 * A card stating that one figure is NOT MEASURED, and why.
 *
 * ─── WHY THESE ARE NOT KPI TILES READING ZERO ──────────────────────────────
 *
 * `/api/admin/forms/:formName/analytics` returns six figures and only three of
 * them are measured. `averageCompletionTime` is a literal `0` in the handler,
 * `attachmentCount` is a deliberate placeholder the source itself comments as
 * "intentionally zero — we don't fetch `data` for the aggregate query", and
 * `dropOffByStep` returns one entry per declared step with `droppedCount: 0` on
 * every one. A tile rendering any of those prints a NUMBER, and a number is a
 * claim: "the average form takes zero seconds" and "no attachment was ever
 * uploaded" are both false, and neither is distinguishable from a true zero.
 *
 * This is the footprint page's own rule applied one surface over — a blank cell
 * beside a named instrument means nobody measured it; a `0` beside one means it
 * was measured and found empty. So the unmeasured three are named in words with
 * no figure at all, next to the two that are real.
 *
 * They are kept on the page rather than deleted because their absence is itself
 * operational information: an operator asking "how long does my form take?" gets
 * "that is not measured yet" instead of concluding the console has no answer
 * because they missed it.
 */
const gapCard = (heading: string, why: string): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: {
      className: 'border-border bg-background-raised flex flex-col gap-1 rounded-lg border p-4',
    },
    children: [
      {
        type: 'text',
        element: 'span',
        props: { className: 'text-foreground-subtle text-sm font-medium tracking-wide uppercase' },
        content: heading,
      },
      {
        type: 'text',
        element: 'span',
        props: { className: 'text-foreground-muted text-md' },
        content: '$t:admin.forms.metric.unmeasured',
      },
      {
        type: 'text',
        element: 'span',
        props: { className: 'text-foreground-subtle text-md italic' },
        content: why,
      },
    ],
  }) as PageComponent

/**
 * The completion rate — the share of submissions that reached `done` or
 * `processed`.
 *
 * `scale: '100'` is the combinator that renders a 0–1 RATIO as a whole percent,
 * which is what this endpoint returns (`doneCount / totalCount`, so `0.42`)
 * where the analytics readers return an already-scaled percentage. Two
 * endpoints, two conventions; the formatter is where they are reconciled, and
 * reading `scale` as "the value is already scaled" inverts it — `1` then prints
 * as `1%` rather than `100%`, silently, on a perfect score.
 */
const completionKpi = (): PageComponent =>
  ({
    type: 'kpi',
    label: 'Completion rate',
    dataSource: {
      system: { endpoint: FORM_ANALYTICS_ENDPOINT, valuePath: 'completionRate' },
    },
    kpiFormat: { type: 'percentage', options: { scale: '100' } },
  }) as PageComponent

/**
 * Submissions over the window, one point per day.
 *
 * `rowsKey` is a PLAIN key and never a dotted path, which is why the series has
 * to live at the top level of the envelope — it does. The empty state says "no
 * submissions in this period" rather than drawing a flat line at zero, which
 * would read as "measured, and it was none" — a stronger claim than the data
 * supports on a form that may simply not have been reached.
 */
const submissionsChart = (): PageComponent =>
  ({
    type: 'chart',
    props: { 'aria-label': '$t:admin.forms.trend.region' },
    dataSource: { system: { endpoint: FORM_ANALYTICS_ENDPOINT, rowsKey: 'submissionsPerDay' } },
    chartType: 'area',
    xAxis: { field: 'date', format: 'date' },
    series: [{ field: 'count', label: 'Submissions' }],
    emptyState: { role: 'region', name: 'No data', title: 'No submissions in this period' },
  }) as PageComponent

/** The Inbox panel: the controls, the feed, its read window, and the drawer. */
const inboxPanel = (): PageComponent =>
  tabPanel([toolbar(), submissionsGrid(), readWindowNote(), detailDrawer()])

/**
 * The Insights panel: what the analytics endpoint measures, and what it does not.
 *
 * Two real figures and a real series, then the four gaps — conversion (no view
 * counter exists to divide by), completion time, attachments, and per-step
 * drop-off. Reading the panel top to bottom tells an operator exactly how much
 * of this form's behaviour is instrumented.
 */
const insightsPanel = (): PageComponent =>
  tabPanel(
    [
      {
        type: 'container',
        element: 'section',
        props: { 'aria-label': '$t:admin.forms.metrics.region', className: 'flex flex-col gap-4' },
        children: [
          {
            type: 'container',
            props: { className: 'grid grid-cols-1 gap-4 sm:grid-cols-2' },
            children: [submissionsKpi(), completionKpi()],
          },
          submissionsChart(),
        ],
      } as PageComponent,
      {
        type: 'container',
        element: 'section',
        props: {
          'aria-label': '$t:admin.forms.gaps.region',
          className: 'flex flex-col gap-4',
        },
        children: [
          {
            type: 'text',
            element: 'h3',
            props: { className: 'text-foreground text-md font-medium' },
            content: '$t:admin.forms.gaps.heading',
          },
          {
            type: 'container',
            props: { className: 'grid grid-cols-1 gap-4 sm:grid-cols-2' },
            children: [
              gapCard('$t:admin.forms.conversion.heading', '$t:admin.forms.conversion.why'),
              gapCard('$t:admin.forms.duration.heading', '$t:admin.forms.duration.why'),
              gapCard('$t:admin.forms.attachments.heading', '$t:admin.forms.attachments.why'),
              gapCard('$t:admin.forms.dropOff.heading', '$t:admin.forms.dropOff.why'),
            ],
          } as PageComponent,
        ],
      } as PageComponent,
    ],
    { scroll: true }
  )

/** `/forms/:form` — one form's inbox, with what is measured about it beside. */
const inboxPage: PageConfig = withShell(
  {
    id: 'dashboard-data-forms-form',
    name: 'dashboard-data-forms-form',
    path: '/forms/:form',
    meta: { title: '$t:admin.meta.forms', lang: 'en-US' },
    // `?tab=` is the address of each half. Without this block `$query.tab` is
    // left verbatim and the strip silently opens on Inbox for every link.
    query: tabQuery(TABS),
    components: [
      pageHeading('$t:admin.forms.heading', '$t:admin.forms.blurb'),
      fillHost([
        tabbedBody('$t:admin.forms.tabs.region', TABS, [inboxPanel(), insightsPanel()], {
          fill: true,
        }),
      ]),
    ],
  } as PageConfig,
  { breadcrumb: BREADCRUMB, fill: true }
)

/** Both pages, directory first — see `tables.ts` for why the order is written down. */
export default [directoryPage, inboxPage] satisfies readonly PageConfig[]
