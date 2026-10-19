/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// Automations — the catalog of what the operator declared, and the history of
// what it did.
//
// ─── TWO SELECT MODES THIS SURFACE NEEDS ───────────────────────────────────
//
// `select.native`: the specs drive each filter as a browser `<select>`
// (`selectOption(…)`, `toHaveValue('')`), so the server-rendered element is
// left enabled rather than replaced by a Base UI listbox.
//
// `select.emptyOption`: the options come from `dataSource.system` (a preset page
// cannot read the OPERATOR's `app.automations`), which replaces `options`
// outright, so the "All" row that submits nothing is folded into the resolved
// list. Without it a native select picks its FIRST option and the surface opens
// pre-filtered, contradicting the unfiltered count printed beside it.
//
// ─── THE FILTER BAR IS PUBLISHERS, NOT AN ISLAND ───────────────────────────
//
// `select.publishes` declares the dispatch a bespoke island once made: each
// control names the channel and the request-param key it contributes, the
// grid's `bindTo` + `sharedFilter` names the same channel, and the vanilla
// runtime binds the `change` listener. No hydration at all. The native control
// takes its accessible name from the visible caption it wraps, so the caption
// IS the name the specs address — "Filter by automation", "… trigger", "… status".
// Drawn as toolbar facets (`toolbar-facet.ts`), the caption is screen-reader only.

import { sectionCard } from '../../components/dashboard-blocks'
import { consolePage, emptyState, kpiStrip, tabPanel, toolbarRow } from '../../components/data-page'
import { dataTable, STATUS_BADGE, toolbarSearch } from '../../components/data-table-blocks'
import { toolbarFacet } from '../../components/toolbar-facet'
import {
  AUTOMATION_RUNS_ENDPOINT,
  AUTOMATIONS_ENDPOINT,
  AUTOMATIONS_OVERVIEW_ENDPOINT,
} from '../../system-sources'
import { runPage } from './automation-run'
import type { Page as PageConfig } from '@/domain/models/app'

/** One node of a page's component tree, as the config type expresses it. */
type PageComponent = NonNullable<PageConfig['components']>[number]

/**
 * Id of the catalog grid. Doubles as the `onSuccess.refetch` target, so a pause
 * or resume re-queries this same table and the State cell reconciles without a
 * page reload.
 */
const CATALOG_GRID_ID = 'automations-catalog-grid'

/** Id of the run-history grid — addressed directly by the surface's own specs. */
const RUNS_GRID_ID = 'automation-runs-grid'

/**
 * The shared-filter CHANNEL both selects publish on and the runs grid subscribes
 * to.
 *
 * It was the bespoke publisher island's `sourceId`; under `publishes` it is a
 * plain channel name that no element has to own. Kept spelled the same so the
 * before/after of this migration is a change of mechanism and not of address.
 */
const RUNS_FILTER_CHANNEL = 'automation-runs-filter'

/**
 * Catalog columns.
 *
 * `valueLabels` is render-time only: the endpoint contract keeps the raw
 * `'active' | 'paused' | 'disabled'` enum, and its response schema is strict, so
 * relabelling server-side is impossible by design.
 *
 * `Paused` is ONE column: three sparse columns (reason, by, at) stood empty on
 * every running row. The endpoint composes the reading (`pausedLabel`), so the
 * actor of a platform pause, a deleted operator and the operator's clock are
 * the server's to word.
 *
 * The State column is the console's one status badge (`STATUS_BADGE`), the
 * same outline-and-dot cell the run history's Status column draws: the word is
 * the reading, the dot the kind. [internal ref] A7 names this exact surface: the
 * console's own status pills are chrome, because Sovrium invented that
 * vocabulary rather than the app author, so the dot is a chrome hue, never one
 * the app declares.
 *
 * The Automation column reads the label the platform resolved (the declared
 * one, else the name made readable); the name stays the row's id, which every
 * pause and resume addresses.
 */
const CATALOG_COLUMNS = [
  { field: 'label', label: '$t:admin.automations.catalog.col.automation' },
  // Every entry the automation starts on, by name: `trigger` is the first
  // entry's type alone, which reads « nightly and on demand » as `cron`.
  { field: 'triggers', label: '$t:admin.automations.catalog.col.trigger' },
  {
    field: 'state',
    label: '$t:admin.automations.catalog.col.state',
    valueLabels: {
      active: '$t:admin.automations.catalog.state.active',
      paused: '$t:admin.automations.catalog.state.paused',
      disabled: '$t:admin.automations.catalog.state.disabled',
    },
    // Running is the expected state; a pause stops new runs, so it is a caution;
    // disabled in config is a fact of the file, not an alarm.
    cellStyle: [
      { when: { eq: 'active' }, className: STATUS_BADGE.quiet.positive },
      { when: { eq: 'paused' }, className: STATUS_BADGE.quiet.caution },
      { when: { eq: 'disabled' }, className: STATUS_BADGE.quiet.neutral },
    ],
  },
  // Who stopped it and when, as one reading the server phrases in the console
  // language: `Camille Martin · Oct 9, 10:12`, or `System · Oct 13, 16:40` when
  // the platform paused it after repeated failures — the one thing an operator
  // must see before deciding whether Resume is safe. A running row reads the
  // grid's empty dash.
  { field: 'pausedLabel', label: '$t:admin.automations.catalog.col.paused' },
  {
    type: 'actions',
    label: '',
    capability: 'edit-operations',
    actions: [
      {
        label: '$t:admin.automations.catalog.action.pause',
        visibleWhen: { field: 'state', eq: 'active' },
        // Both labels EXPLICIT: the confirm-gate runtime falls back to FRENCH
        // ('Confirmer' / 'Annuler'). Do not drop these: the default is wrong.
        //
        // The message's second sentence is a factual claim, verified before it
        // shipped: every gate is consulted at dispatch/resolve time, nothing
        // re-checks inside the run loop, and there is no delayed-resume path.
        confirm: {
          title: '$t:admin.automations.catalog.pause.title',
          message: '$t:admin.automations.catalog.pause.message',
          confirmLabel: '$t:admin.automations.catalog.action.pause',
          cancelLabel: '$t:admin.automations.cancel',
        },
        action: {
          type: 'fetch',
          method: 'POST',
          // Automation names are constrained to /^[a-z][a-z0-9-]*$/ by AppSchema,
          // so they are URL-safe unencoded — the same property the webhook routes
          // already rely on.
          url: '/api/admin/automations/$record.name/pause',
          // `type` + `message` are REQUIRED on a fetch `onSuccess`, so the
          // refetch cannot ride alone. The retired builder declared a bare
          // `{ refetch }` and got away with it only because a synthesised page
          // is never decoded; expressed as config it has to say what the
          // operator is told, which is the users directory's pattern too.
          onSuccess: {
            type: 'toast',
            variant: 'success',
            message: '$t:admin.automations.catalog.pause.toast',
            refetch: CATALOG_GRID_ID,
          },
          // A refused pause is SAID, naming the automation, and the row is left
          // as it was: still Active, still offering Pause. Retry (an actionLabel
          // with no actionUrl) pauses again without asking a second time.
          onError: {
            type: 'toast',
            variant: 'destructive',
            message: '$t:admin.automations.catalog.pause.failed',
            actionLabel: '$t:admin.automations.catalog.pause.retry',
          },
        },
      },
      {
        // No confirm gate: resume is the reversal of a reversible action, so a
        // gate here is friction without consequence. Confirmation is reserved
        // for the direction that stops production work.
        label: '$t:admin.automations.catalog.action.resume',
        visibleWhen: { field: 'state', eq: 'paused' },
        action: {
          type: 'fetch',
          method: 'POST',
          url: '/api/admin/automations/$record.name/resume',
          onSuccess: {
            type: 'toast',
            message: '$t:admin.automations.catalog.resume.toast',
            refetch: CATALOG_GRID_ID,
          },
        },
      },
      // A `state: 'disabled'` row satisfies NEITHER predicate, so no control
      // renders on it. Configuration is code-only ([internal ref] D2) and the console
      // must never offer to change it; a Resume button that cannot work would be
      // the same class of lie as a search box returning wrong answers.
    ],
  },
]

/**
 * The catalog grid, with NO heading and NO gutter of its own.
 *
 * The "Automations" tab caption names it, so a heading here would restate it
 * — the ornament [internal ref] D4 cuts. And it sits flush with the content column,
 * as the run history does: a `px-6` wrapper once set it 24px further in than
 * every other grid in the console.
 */
const catalogGrid = (): PageComponent =>
  dataTable({
    props: { id: CATALOG_GRID_ID, 'aria-label': '$t:admin.automations.region' },
    dataSource: {
      system: { endpoint: AUTOMATIONS_ENDPOINT, rowsKey: 'items', idKey: 'name' },
    },
    columns: CATALOG_COLUMNS,
    emptyMessage: '$t:admin.automations.catalog.empty',
  }) as PageComponent

/**
 * The control row: the search box, then the automation, trigger and status
 * facets, all publishing on {@link RUNS_FILTER_CHANNEL}.
 *
 * Facets rather than labelled selects (`toolbarFacet`): a caption above every
 * control grew the row a second line and read as a form to fill in. Each facet
 * keeps its caption as its accessible name — "Filter by automation", "… trigger",
 * "… status" — and reads its resting choice ("All automations") instead.
 *
 * The automation and trigger options come from the SAME endpoint the catalog
 * binds — one projection, three consumers — because the operator's
 * `app.automations` is unreadable from a preset page. The trigger names are the
 * catalog's distinct `triggerNames`, across every automation: the channel
 * carries values, so the choices cannot follow the automation picked.
 *
 * The status VALUES are the engine's, not the operator's: a successful run
 * persists as `completed`, so the "Success" choice carries `completed`.
 *
 * Not a `filter-bar`: it publishes ONE `filter` JSON param, which the runs read
 * does not parse; these facets publish the three params it does.
 */
const filterBar = (): PageComponent =>
  toolbarRow([
    // The search box first, on the same channel: it publishes `q`, and the
    // endpoint applies it over every run.
    toolbarSearch(RUNS_FILTER_CHANNEL, '$t:admin.automations.runs.search'),
    toolbarFacet({
      id: 'automation-filter',
      label: '$t:admin.automations.runs.filter.automation',
      allLabel: '$t:admin.automations.runs.filter.allAutomations',
      publishes: { bindTo: RUNS_FILTER_CHANNEL, param: 'automationName' },
      choices: {
        dataSource: {
          system: { endpoint: AUTOMATIONS_ENDPOINT, rowsKey: 'items', idKey: 'name' },
          // The option reads the automation's label; its value stays the name
          // the endpoint filters on.
          valueKey: 'name',
          labelKey: 'label',
        },
      },
    }),
    toolbarFacet({
      id: 'trigger-filter',
      label: '$t:admin.automations.runs.filter.trigger',
      // Each facet names its own resting choice: with the caption hidden, three
      // controls reading « All » would not say which filter they are.
      allLabel: '$t:admin.automations.runs.filter.allTriggers',
      publishes: { bindTo: RUNS_FILTER_CHANNEL, param: 'triggerName' },
      choices: {
        dataSource: {
          system: { endpoint: AUTOMATIONS_ENDPOINT, rowsKey: 'triggerNames', idKey: 'name' },
          // The option reads the trigger as the catalogue and a run read it
          // ("Quotes · status → Signed"); its value stays the name the
          // endpoint filters on.
          valueKey: 'name',
          labelKey: 'label',
        },
      },
    }),
    toolbarFacet({
      id: 'status-filter',
      label: '$t:admin.automations.runs.filter.status',
      allLabel: '$t:admin.automations.runs.filter.allStatuses',
      publishes: { bindTo: RUNS_FILTER_CHANNEL, param: 'status' },
      choices: {
        options: [
          { value: 'completed', label: '$t:admin.automations.runs.status.success' },
          { value: 'failed', label: '$t:admin.automations.runs.status.failed' },
          { value: 'completed-with-errors', label: '$t:admin.automations.runs.status.partial' },
          { value: 'waiting-approval', label: '$t:admin.automations.runs.status.waitingApproval' },
          { value: 'waiting-delay', label: '$t:admin.automations.runs.status.waitingDelay' },
          { value: 'rejected', label: '$t:admin.automations.runs.status.rejected' },
          { value: 'cancelled', label: '$t:admin.automations.runs.status.cancelled' },
        ],
      },
    }),
  ])

/**
 * The run-history grid.
 *
 * ## Search rides the filter channel
 *
 * The search box sits in the filter bar above and publishes `q` on
 * {@link RUNS_FILTER_CHANNEL}, beside the three selects; the grid forwards it.
 *
 * The term goes to the SERVER, which applies it over every run and echoes
 * `appliedQuery` — the signal that tells the grid to stand down from filtering
 * the page it holds. Without that echo a client narrows an already-narrowed page
 * and hides matches living past it, and only on fields that happen to be
 * rendered columns, which is how that class of bug stays invisible.
 */
const runsGrid = (): PageComponent =>
  dataTable({
    props: { id: RUNS_GRID_ID, 'aria-label': '$t:admin.automations.runs.heading' },
    dataSource: {
      system: {
        endpoint: AUTOMATION_RUNS_ENDPOINT,
        rowsKey: 'items',
        idKey: 'id',
        bindTo: RUNS_FILTER_CHANNEL,
        sharedFilter: { params: ['q', 'automationName', 'triggerName', 'status'] },
        // Every run the filters match, so the pager numbers its pages; the
        // endpoint's own `resultSummary` stands in for the pager's range.
        totalKey: 'total',
      },
    },
    pagination: { pageSize: 25 },
    // Below `sm` each run is one item: the automation as its title, the trigger
    // and the status on the line beneath, and a tap opens the run as the row does.
    phoneLayout: 'rows',
    columns: [
      // The label the platform resolved (declared, else the name made readable).
      { field: 'automationLabel', label: '$t:admin.automations.runs.col.automation' },
      // What started the run, in words the server composed (`Schedule · daily
      // 06:00`); the trigger filter still takes the trigger's name.
      { field: 'triggerLabel', label: '$t:admin.automations.runs.col.trigger' },
      {
        field: 'status',
        label: '$t:admin.automations.runs.col.status',
        // The platform has already turned the engine's word into the operator's
        // (`completed` → `Success`, `waiting-approval` → `Waiting for approval`,
        // see `automation-run-status.ts`) before a row reaches the grid, so the
        // map is keyed on THAT word, and so is `cellStyle`, which reads the
        // value and never the label.
        valueLabels: {
          Success: '$t:admin.automations.runs.status.success',
          Failed: '$t:admin.automations.runs.status.failed',
          Partial: '$t:admin.automations.runs.status.partial',
          'Waiting for approval': '$t:admin.automations.runs.status.waitingApproval',
          'Waiting to resume': '$t:admin.automations.runs.status.waitingDelay',
          Rejected: '$t:admin.automations.runs.status.rejected',
          Cancelled: '$t:admin.automations.runs.status.cancelled',
          'Retries exhausted': '$t:admin.automations.runs.status.retriesExhausted',
          'Timed out': '$t:admin.automations.runs.status.timedOut',
          Queued: '$t:admin.automations.runs.status.queued',
          Running: '$t:admin.automations.runs.status.running',
          Skipped: '$t:admin.automations.runs.status.skipped',
        },
        // One outline-dot badge per status (`STATUS_BADGE`, shadcn's data-table
        // status cell): the word stays the reading and the dot marks the kind.
        cellStyle: [
          { when: { eq: 'Success' }, className: STATUS_BADGE.quiet.positive },
          // The error role — the one status here that has to read at a glance.
          { when: { eq: 'Failed' }, className: STATUS_BADGE.loud },
          { when: { eq: 'Partial' }, className: STATUS_BADGE.quiet.caution },
          // Someone has to answer before the run can go on.
          { when: { eq: 'Waiting for approval' }, className: STATUS_BADGE.quiet.progress },
          // A decision, not a fault: an approver said no, or the run was
          // stopped on purpose. Neither is painted as a failure.
          { when: { in: ['Rejected', 'Cancelled'] }, className: STATUS_BADGE.quiet.neutral },
          // Every retry spent: a failure, painted as one.
          { when: { eq: 'Retries exhausted' }, className: STATUS_BADGE.loud },
          // It ran out of time rather than broke: a warning.
          { when: { eq: 'Timed out' }, className: STATUS_BADGE.quiet.caution },
          // Not finished yet: queued, parked on a long wait (nobody has to act), or under way.
          { when: { in: ['Queued', 'Waiting to resume'] }, className: STATUS_BADGE.quiet.neutral },
          { when: { eq: 'Running' }, className: STATUS_BADGE.quiet.progress },
          // A filter stopped it, as written — not a fault.
          { when: { eq: 'Skipped' }, className: STATUS_BADGE.quiet.neutral },
        ],
      },
      // Relative to the reader's day: `Today 06:00`, then `Oct 13, 07:30`.
      {
        field: 'startedAt',
        label: '$t:admin.automations.runs.col.started',
        format: 'day-relative-time',
      },
      // The record the run concerns, by the name its sheet heads itself with.
      { field: 'recordLabel', label: '$t:admin.automations.runs.col.record' },
      {
        field: 'durationMs',
        label: '$t:admin.automations.runs.col.duration',
        align: 'right',
        format: 'duration',
      },
      // How far the run got, as one reading: the server writes "2 of 3" in the
      // page language from the run's step rows and the automation's declared
      // steps, and just "2" once the automation has left the config.
      { field: 'stepsLabel', label: '$t:admin.automations.runs.col.stepCount', align: 'right' },
      { field: 'attempt', label: '$t:admin.automations.runs.col.attempt', align: 'right' },
      { field: 'error', label: '$t:admin.automations.runs.col.error', format: 'truncate' },
      {
        type: 'actions',
        label: '',
        actions: [
          {
            label: '$t:admin.automations.runs.action.view',
            action: { type: 'fetch', mode: 'navigate', url: '/runs/$record.id' },
          },
          // The record the run acted on, when it acted on one. Two flat
          // fields rather than one object, so the address writes itself.
          {
            label: '$t:admin.automations.runs.action.record',
            visibleWhen: { field: 'recordId', isNotEmpty: true },
            action: {
              type: 'fetch',
              mode: 'navigate',
              url: '/records/$record.recordTable?record=$record.recordId',
            },
          },
        ],
      },
    ],
    // The grid owns the page's scroll on this surface: the KPI strip and the
    // filter bar keep their natural height above it
    // and the rows take whatever is left, so the column header stays pinned
    // and the operator never scrolls a labelled table into an unlabelled one.
    layout: 'fill',
    onRowClick: { type: 'navigate', path: '/runs/$record.id' },
    emptyMessage: '$t:admin.automations.runs.empty',
    noMatchMessage: '$t:admin.automations.runs.noMatch',
  }) as PageComponent

/**
 * The two halves of this route, and the `?tab=` value that addresses each.
 *
 * HISTORY FIRST, and that is the whole point of the reorder. An operator opens
 * this surface because something ran — or did not — so the run feed is the
 * answer they came for; the catalogue is what they consult once they know which
 * automation to look at. It was the other way round, with the catalogue on top
 * and the feed below a heading, so reading the last failure meant scrolling
 * past a directory every time.
 */
const TABS = [
  { id: 'history', label: '$t:admin.automations.tabs.history' },
  { id: 'automations', label: '$t:admin.automations.tabs.automations' },
] as const

/**
 * One run figure, read as a pre-computed scalar from the automations-overview
 * envelope.
 *
 * All four tiles share ONE request: the system-value hook keys its cache on the
 * endpoint AND the query and deliberately not on the value path.
 */
const overviewKpi = (
  label: string,
  valuePath: string,
  kpiFormat: Readonly<Record<string, unknown>>
): PageComponent =>
  sectionCard({ label, endpoint: AUTOMATIONS_OVERVIEW_ENDPOINT, valuePath, kpiFormat })

/**
 * The run figures, which shipped in `/api/admin/automations/overview` and were
 * drawn by nothing.
 *
 * ─── WHY HERE AND NOT IN THE CHROME BAR ────────────────────────────────────
 *
 * The canvas puts these four in the 48px bar as a count and a facts line — a
 * row of plain text, not cards. Config cannot express that: a system-bound
 * scalar is a `kpi`, `kpi` is a lazy island, and an island in the chrome paints
 * a skeleton inside the bar on every load. There is no `text` that binds a
 * system value, so the bar placement is a PLATFORM gap rather than an authoring
 * choice, and it is filed as one. A strip at the top of the panel is what
 * config does support, and it is what every sibling data surface already does.
 *
 * `success_rate` formats with `scale: '100'`, which is the combinator that
 * renders a 0–1 RATIO as a whole percent — the endpoint returns `1` for "every
 * run succeeded". Read as "the number is already a percentage, leave it alone"
 * it goes the other way and prints `1%` over a perfect record; measured, and
 * that is what it printed before this line was corrected.
 */
const runsKpiStrip = (): PageComponent =>
  kpiStrip('$t:admin.automations.metrics.region', [
    overviewKpi('$t:admin.automations.metrics.automations', 'totals.automations', {
      type: 'number',
    }),
    overviewKpi('$t:admin.automations.metrics.runs24h', 'totals.runs_24h', { type: 'number' }),
    overviewKpi('$t:admin.automations.metrics.failures24h', 'totals.failures_24h', {
      type: 'number',
    }),
    overviewKpi('$t:admin.automations.metrics.successRate', 'totals.success_rate', {
      type: 'percentage',
      options: { scale: '100' },
    }),
  ])

/**
 * The History panel: the run figures, the filter bar and the run feed, paged
 * by number over every matching run. A run opens on its own page, not over
 * this panel.
 *
 * The `px-6` / `p-6` the two sections carried are GONE. They were the gutter of
 * a body stacked under a page title; the console's content column supplies its
 * own 16px now, and a second inset made the grid sit 24px further in than every
 * other grid in the console.
 */
const historyPanel = (): PageComponent => tabPanel([runsKpiStrip(), filterBar(), runsGrid()])

/**
 * The Automations panel: the catalogue, with pause and resume on each row.
 *
 * Its own `h3` is gone with the split — the tab caption above it names it, and
 * a heading directly under a trigger that says the same word is the duplication
 * the chrome bar already retired once this console.
 */
const catalogPanel = (): PageComponent => tabPanel([catalogGrid()], { scroll: true })

/**
 * The page without a single declared automation: the empty state, and no tabs.
 *
 * The strip itself carries `declares: 'automations'` (see `runsPage`). It
 * EXCLUDES rather than hides, so exactly one of the strip and this empty state
 * reaches the document. The predicate is the same one the retired
 * builder tested — a non-empty `app.automations` — expressed as a capability
 * rather than recomputed here.
 *
 * The GATE is on the strip, not inside it: an app declaring no automations gets
 * the empty state and NO tab bar, rather than two triggers over two empty
 * tables. A strip is an offer of two answers, and there are none to offer.
 */
const noAutomations = (): PageComponent =>
  ({
    ...(emptyState(
      '$t:admin.automations.empty.heading',
      '$t:admin.automations.empty.body',
      '$t:admin.automations.empty.hint'
    ) as Record<string, unknown>),
    visibility: { unlessDeclares: 'automations' },
  }) as PageComponent

const runsPage: PageConfig = consolePage({
  id: 'dashboard-data-automations',
  path: '/runs',
  title: '$t:admin.meta.automations',
  heading: ['$t:admin.automations.heading', '$t:admin.automations.blurb'],
  tabs: {
    label: '$t:admin.automations.tabs.region',
    specs: TABS,
    panels: [historyPanel(), catalogPanel()],
    fill: true,
    visibility: { declares: 'automations' },
  },
  body: [noAutomations()],
  page: { requires: ['automations'] },
  shell: { breadcrumb: { runs: '$t:admin.crumb.runs' }, fill: true },
})

export const automationPages: readonly PageConfig[] = [runsPage, runPage]
