/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// Submissions — what your forms received, one inbox per form.
//
//   `/submissions`        the bare collection, which 302s to the first form.
//   `/submissions/:form`  that form's metrics, toolbar, inbox and detail drawer.
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

import { sectionCard } from '../../components/dashboard-blocks'
import {
  consolePage,
  emptyState,
  fillHost,
  tabbedBody,
  tabPanel,
  tabQuery,
  toolbarRow,
} from '../../components/data-page'
import {
  dataTable,
  recordSheet,
  STATUS_BADGE,
  toolbarSearch,
} from '../../components/data-table-blocks'
import { FORMS_ENDPOINT } from '../../system-sources'
import type { Page as PageConfig } from '@/domain/models/app'

/** One node of a page's component tree, as the config type expresses it. */
type PageComponent = NonNullable<PageConfig['components']>[number]

/** Drawer id the inbox opens on a row click (the list → detail drill-down). */
const DETAIL_DRAWER_ID = 'form-submission-detail'

/** The Submissions crumb label, shared by both pages of the surface. */
const BREADCRUMB = { submissions: '$t:admin.crumb.submissions' } as const

/** Outline toolbar-button chrome, shared by the export button and the form link. */
const TOOLBAR_BTN =
  'border-border text-foreground-subtle hover:text-foreground inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-md'

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
/** The channel the submissions' search box publishes on and its grid listens to. */
const SUBMISSIONS_CHANNEL = 'submissions-filter'

const submissionsGrid = (): PageComponent =>
  dataTable({
    props: { 'aria-label': '$t:admin.forms.submissions.region' },
    dataSource: {
      system: {
        endpoint: SUBMISSIONS_ENDPOINT,
        rowsKey: 'items',
        idKey: 'id',
        bindTo: SUBMISSIONS_CHANNEL,
        sharedFilter: {},
        // Every submission the filters match, not the rows this page holds.
        totalKey: 'total',
      },
    },
    // One column per question of the form the address names, after the
    // envelope's two. They fill only when the list carries the answers — an
    // admin turned Reveal answers on, on an instance that allows it — and
    // otherwise there is no answer column at all.
    columnsFrom: { form: '$param.form' },
    columns: [
      {
        field: 'status',
        label: '$t:admin.common.status',
        valueLabels: STATUS_LABELS,
        cellStyle: Object.keys(STATUS_LABELS).map((value) => ({
          when: { eq: value },
          className: value === 'failed' ? STATUS_BADGE.loud : STATUS_BADGE.quiet.neutral,
        })),
      },
      { field: 'submittedAt', label: '$t:admin.forms.received', format: 'datetime' },
    ],
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
    emptyMessage: '$t:admin.forms.noneYet',
    noMatchMessage: '$t:admin.forms.noMatch',
    onRowClick: { action: 'openSheet', component: DETAIL_DRAWER_ID },
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
  recordSheet({
    id: DETAIL_DRAWER_ID,
    dataSource: { system: { endpoint: `${SUBMISSIONS_ENDPOINT}/:id` } },
    canEdit: false,
    recordFields: [
      { name: 'status', type: 'single-line-text' },
      { name: 'submittedAt', type: 'single-line-text' },
    ],
  }) as PageComponent

/**
 * The toolbar: the search box, out to the live form, then the CSV export.
 *
 * The export `filename` carries `$param.form` too. The reference grammar ends at
 * the first character that cannot continue an identifier, so
 * `$param.form-submissions.csv` resolves to `contact-submissions.csv` rather
 * than swallowing the suffix.
 */
/**
 * Reveal answers: the one way the inbox shows what people wrote.
 *
 * Off by default, so opening the inbox is never a reveal. While on it
 * publishes `reveal=true` on the grid's channel and the list read carries the
 * answers — which the instance answers only to an admin, only where it allows
 * capturing them, and records in the audit log. A role that could never see
 * them is not offered the switch at all.
 */
const revealSwitch = (): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    visibility: { capability: 'administer-accounts' },
    props: { className: 'flex items-center gap-2' },
    children: [
      {
        type: 'switch',
        props: { id: 'submissions-reveal', 'aria-label': '$t:admin.forms.reveal' },
        publishes: { bindTo: SUBMISSIONS_CHANNEL, param: 'reveal' },
      },
      { type: 'label', for: 'submissions-reveal', text: '$t:admin.forms.reveal' },
    ],
  }) as PageComponent

const toolbar = (): PageComponent =>
  toolbarRow([
    toolbarSearch(SUBMISSIONS_CHANNEL, '$t:admin.forms.search'),
    revealSwitch(),
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
      label: '$t:admin.forms.exportCsv',
      // Outline, like the link beside it: the default fill is the primary
      // colour, which the toolbar's muted text cannot be read against.
      variant: 'outline',
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
  sectionCard({
    label: '$t:admin.forms.submissions',
    endpoint: FORM_ANALYTICS_ENDPOINT,
    valuePath: 'totalCount',
  })

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
  emptyState(
    '$t:admin.forms.empty.heading',
    '$t:admin.forms.empty.body',
    '$t:admin.forms.empty.hint'
  )

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
      emptyMessage: '$t:admin.forms.none',
    },
  }) as PageComponent

/** `/submissions` — the bare collection. */
const directoryPage: PageConfig = consolePage({
  id: 'dashboard-data-forms',
  path: '/submissions',
  title: '$t:admin.meta.forms',
  heading: ['$t:admin.forms.heading', '$t:admin.forms.blurb'],
  page: {
    requires: ['forms'],
    redirectToFirst: { hrefTemplate: '/submissions/{name}' },
  },
  shell: { breadcrumb: BREADCRUMB },
  body: [noFormsState(), formDirectory()],
})

/**
 * The two halves of this route, and the `?tab=` value that addresses each.
 *
 * INBOX FIRST: an operator opens a form's surface to read what came in. The
 * metrics sat ABOVE that inbox and pushed it below the fold on every visit,
 * which is the wrong trade for a figure most readings do not need.
 */
const TABS = [
  { id: 'inbox', label: '$t:admin.forms.inbox' },
  { id: 'insights', label: '$t:admin.forms.insights' },
] as const

/**
 * Drop-off, answered for what the form IS.
 *
 * A single-page form has no step to drop off at, so the figure is not
 * applicable — the read returns no steps, and the list's empty line says so.
 * A multi-step form lists its steps. Per-step abandonment itself is not
 * measured yet, and an unmeasured figure is not drawn: a `0` beside a step
 * would claim nobody left there.
 */
const dropOffSection = (): PageComponent =>
  ({
    type: 'container',
    element: 'section',
    props: { 'aria-label': '$t:admin.forms.dropOff.heading', className: 'flex flex-col gap-2' },
    children: [
      {
        type: 'text',
        element: 'h3',
        props: { className: 'text-foreground text-md font-medium' },
        content: '$t:admin.forms.dropOff.heading',
      },
      {
        type: 'list',
        props: { className: 'text-muted-foreground flex flex-col gap-1 text-sm' },
        dataSource: { system: { endpoint: FORM_ANALYTICS_ENDPOINT, rowsKey: 'dropOffByStep' } },
        listDisplay: {
          itemTemplate: { title: '{stepName}' },
          emptyMessage: '$t:admin.forms.dropOff.singlePage',
        },
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
  sectionCard({
    label: '$t:admin.forms.completion',
    endpoint: FORM_ANALYTICS_ENDPOINT,
    valuePath: 'completionRate',
    kpiFormat: { type: 'percentage', options: { scale: '100' } },
  })

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
    series: [{ field: 'count', label: '$t:admin.forms.submissions' }],
    emptyState: {
      role: 'region',
      name: '$t:admin.common.noData',
      title: '$t:admin.forms.noPeriod',
    },
  }) as PageComponent

/** The Inbox panel: the controls, the feed, its read window, and the drawer. */
const inboxPanel = (): PageComponent =>
  tabPanel([toolbar(), submissionsGrid(), readWindowNote(), detailDrawer()])

/**
 * The Insights panel: what the analytics endpoint measures, and what it does not.
 *
 * The two figures the endpoint measures and their series, then drop-off for
 * what the form is. Nothing the endpoint does not measure is on the page —
 * not as a tile reading zero, and not as a word either.
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
      dropOffSection(),
    ],
    { scroll: true }
  )

/** `/submissions/:form` — one form's inbox, with what is measured about it beside. */
const inboxPage: PageConfig = consolePage({
  id: 'dashboard-data-forms-form',
  path: '/submissions/:form',
  title: '$t:admin.meta.forms',
  heading: ['$t:admin.forms.heading', '$t:admin.forms.blurb'],
  page: {
    requires: ['forms'],
    // `?tab=` is the address of each half. Without this block `$query.tab` is
    // left verbatim and the strip silently opens on Inbox for every link.
    query: tabQuery(TABS),
  },
  shell: { breadcrumb: BREADCRUMB, fill: true },
  body: [
    fillHost([
      tabbedBody('$t:admin.forms.tabs.region', TABS, [inboxPanel(), insightsPanel()], {
        fill: true,
      }),
    ]),
  ],
})

/** Both pages, directory first — see `tables.ts` for why the order is written down. */
export default [directoryPage, inboxPage] satisfies readonly PageConfig[]
