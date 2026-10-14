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

import { sectionCard } from '../../components/dashboard-blocks'
import { emptyState, pageHeading, tabQuery, tabbedBody, tabPanel } from '../../components/data-page'
import { dataTable, STATUS_BADGE } from '../../components/data-table-blocks'
import { withShell } from '../../components/shell'
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
 * `Paused by` / `Paused at` are two columns rather than one concatenated string:
 * during an incident an operator needs both WHO stopped it and WHEN, and
 * separate columns sort and format properly. `pausedBy` is nullable — the pause
 * outlives the account that set it (`ON DELETE SET NULL`), so a deleted operator
 * leaves the pause standing with an empty actor.
 *
 * The State column carries no colour. [internal ref] A7 names this exact surface: the
 * console's own status pills are chrome, because Sovrium invented that
 * vocabulary rather than the app author, and A1 retired `success` / `warning`.
 */
const CATALOG_COLUMNS = [
  { field: 'name', label: '$t:admin.automations.catalog.col.automation' },
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
  },
  // Only a platform pause carries a `reason`; an operator pause leaves it null
  // and `Paused by` names who. So the column is sparse by design: a mark in it
  // means nobody chose this pause, which is the one thing an operator must see
  // before deciding whether Resume is safe.
  {
    field: 'reason',
    label: '$t:admin.automations.catalog.reason',
    valueLabels: { 'consecutive-failures': '$t:admin.automations.catalog.reason.automatic' },
  },
  { field: 'pausedBy', label: '$t:admin.automations.catalog.col.pausedBy' },
  { field: 'pausedAt', label: '$t:admin.automations.catalog.col.pausedAt', format: 'datetime' },
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
            message: '$t:admin.automations.catalog.pause.toast',
            refetch: CATALOG_GRID_ID,
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
    toolbar: { sort: true },
    emptyMessage: '$t:admin.automations.catalog.empty',
  }) as PageComponent

/**
 * One filter control.
 *
 * `props.className` lands on the `<label>` the native rendering wraps the
 * control in; the caption's own class list is the renderer's, so the two
 * controls cannot drift apart. `w-56` is what keeps them from stretching: the
 * control carries `w-full`, so an unbounded label would let the automation
 * filter's width follow its longest option name.
 */
const filter = (
  id: string,
  label: string,
  param: string,
  choices: Readonly<Record<string, unknown>>
): PageComponent =>
  ({
    type: 'native-select',
    props: { id, label, className: 'w-56' },
    emptyOption: { label: '$t:admin.automations.runs.filter.all' },
    publishes: { bindTo: RUNS_FILTER_CHANNEL, param },
    ...choices,
  }) as PageComponent

/**
 * The filter bar: the automation, trigger and status pickers, all publishing
 * on {@link RUNS_FILTER_CHANNEL}.
 *
 * The automation and trigger options come from the SAME endpoint the catalog
 * above binds — one projection, three consumers — because the operator's
 * `app.automations` is unreadable from a preset page. The trigger names are the
 * catalog's distinct `triggerNames`, across every automation: the channel
 * carries values, so the choices cannot follow the automation picked.
 *
 * The status list is static and its VALUES are the engine's, not the operator's:
 * a successful run persists as `completed`, so the "Success" choice carries
 * `completed`. The retired island held that mapping in TypeScript
 * (`toQueryStatus`) precisely because its option value was the operator word;
 * declaring the engine value directly deletes the mapping rather than moving it.
 *
 * The CAPTIONS are translated like everything else: the select renderer
 * resolves a `$t:` label itself, because the caption is read off the raw
 * `props` that the props translation pass never reaches.
 */
const filterBar = (): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: { className: 'mb-4 flex flex-wrap items-end gap-3' },
    children: [
      filter('automation-filter', '$t:admin.automations.runs.filter.automation', 'automationName', {
        dataSource: {
          system: { endpoint: AUTOMATIONS_ENDPOINT, rowsKey: 'items', idKey: 'name' },
          valueKey: 'name',
          labelKey: 'name',
        },
      }),
      filter('trigger-filter', '$t:admin.automations.runs.filter.trigger', 'triggerName', {
        // Its own "All": the shared one agrees with « automatisation » and
        // « exécution », and French needs the masculine for « déclencheur ».
        emptyOption: { label: '$t:admin.automations.runs.filter.allTriggers' },
        dataSource: {
          system: { endpoint: AUTOMATIONS_ENDPOINT, rowsKey: 'triggerNames', idKey: 'name' },
          valueKey: 'name',
          labelKey: 'name',
        },
      }),
      filter('status-filter', '$t:admin.automations.runs.filter.status', 'status', {
        options: [
          { value: 'completed', label: '$t:admin.automations.runs.status.success' },
          { value: 'failed', label: '$t:admin.automations.runs.status.failed' },
          { value: 'completed-with-errors', label: '$t:admin.automations.runs.status.partial' },
          { value: 'waiting-approval', label: '$t:admin.automations.runs.status.waitingApproval' },
          { value: 'waiting-delay', label: '$t:admin.automations.runs.status.waitingDelay' },
          { value: 'rejected', label: '$t:admin.automations.runs.status.rejected' },
          { value: 'cancelled', label: '$t:admin.automations.runs.status.cancelled' },
        ],
      }),
    ],
  }) as PageComponent

/**
 * The run-history grid.
 *
 * ## Why the search box needs BOTH `search` and `toolbar.search`
 *
 * The render guard is `showSearch && searchConfig` — `toolbar.search` alone
 * renders no box, and `search` alone leaves the toolbar without the affordance.
 * Declaring only one is the quiet way to ship an inert control.
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
        sharedFilter: { params: ['automationName', 'triggerName', 'status'] },
      },
    },
    columns: [
      { field: 'automationName', label: '$t:admin.automations.runs.col.automation' },
      // The entry that started the run, by name: two runs of one automation
      // that read identically otherwise are told apart here, without opening
      // either. A trigger declared without a name reads as its type.
      { field: 'triggerName', label: '$t:admin.automations.runs.col.trigger' },
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
          { when: { eq: 'Success' }, className: STATUS_BADGE.positive },
          // The error role — the one status here that has to read at a glance.
          { when: { eq: 'Failed' }, className: STATUS_BADGE.destructive },
          { when: { eq: 'Partial' }, className: STATUS_BADGE.caution },
          // Someone has to answer before the run can go on.
          { when: { eq: 'Waiting for approval' }, className: STATUS_BADGE.progress },
          // A decision, not a fault: an approver said no, or the run was
          // stopped on purpose. Neither is painted as a failure.
          { when: { in: ['Rejected', 'Cancelled'] }, className: STATUS_BADGE.neutral },
          // Every retry spent: a failure, painted as one.
          { when: { eq: 'Retries exhausted' }, className: STATUS_BADGE.destructive },
          // It ran out of time rather than broke: a warning.
          { when: { eq: 'Timed out' }, className: STATUS_BADGE.caution },
          // Not finished yet: queued, parked on a long wait (nobody has to act), or under way.
          { when: { in: ['Queued', 'Waiting to resume'] }, className: STATUS_BADGE.neutral },
          { when: { eq: 'Running' }, className: STATUS_BADGE.progress },
          // A filter stopped it, as written — not a fault.
          { when: { eq: 'Skipped' }, className: STATUS_BADGE.neutral },
        ],
      },
      { field: 'startedAt', label: '$t:admin.automations.runs.col.started', format: 'datetime' },
      { field: 'durationMs', label: '$t:admin.automations.runs.col.duration', align: 'right' },
      {
        type: 'actions',
        label: '',
        actions: [
          {
            label: '$t:admin.automations.runs.action.view',
            action: { type: 'fetch', mode: 'navigate', url: '/automations/runs/$record.id' },
          },
        ],
      },
    ],
    search: { enabled: true, placeholder: '$t:admin.automations.runs.search' },
    toolbar: { search: true, sort: true },
    // The grid owns the page's scroll on this surface: the KPI strip, the
    // filter bar and the read-window note keep their natural height above it
    // and the rows take whatever is left, so the column header stays pinned
    // and the operator never scrolls a labelled table into an unlabelled one.
    layout: 'fill',
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
  ({
    type: 'container',
    element: 'div',
    props: {
      role: 'region',
      'aria-label': '$t:admin.automations.metrics.region',
      // Two-up at the narrowest width, not one-up. This strip sits ABOVE a
      // `layout: 'fill'` grid, which takes whatever height the chrome above it
      // leaves; one-up stacked all four cards and took 376px of a 665px pinned
      // column at 375, which with the filter bar, the read-window note and the
      // gaps over-subscribed the column and squeezed the grid to its 2px
      // border. The rows were then clipped inside a zero-height scroller on a
      // page that does not scroll, so the run feed was unreachable by any
      // gesture. Four short figures read fine two-up, and it hands ~172px back.
      className: 'grid grid-cols-2 gap-4 lg:grid-cols-4',
    },
    children: [
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
    ],
  }) as PageComponent

/**
 * The History panel: the run figures, the filter bar, the run feed and its
 * read-window statement. A run opens on its own page, not over this panel.
 *
 * The `px-6` / `p-6` the two sections carried are GONE. They were the gutter of
 * a body stacked under a page title; the console's content column supplies its
 * own 16px now, and a second inset made the grid sit 24px further in than every
 * other grid in the console.
 */
const historyPanel = (): PageComponent =>
  tabPanel([
    runsKpiStrip(),
    filterBar(),
    runsGrid(),
    // The read-window statement, and the load-bearing half is the second
    // sentence: it names the affordance that DOES reach older runs (search
    // and the filters both query server-side over every run) and admits
    // that a narrowed result carries the same 25-row cap. Without it,
    // removing the pager would just relocate the wrong answer one
    // interaction later.
    {
      type: 'text',
      element: 'p',
      props: { className: 'text-foreground-subtle text-md' },
      content: '$t:admin.automations.runs.scope',
    } as PageComponent,
  ])

/**
 * The Automations panel: the catalogue, with pause and resume on each row.
 *
 * Its own `h3` is gone with the split — the tab caption above it names it, and
 * a heading directly under a trigger that says the same word is the duplication
 * the chrome bar already retired once this console.
 */
const catalogPanel = (): PageComponent => tabPanel([catalogGrid()], { scroll: true })

/**
 * Everything that needs at least one declared automation.
 *
 * `declares` EXCLUDES rather than hides, so exactly one of this and the empty
 * state below reaches the document. The predicate is the same one the retired
 * builder tested — a non-empty `app.automations` — expressed as a capability
 * rather than recomputed here.
 *
 * The GATE is on the strip, not inside it: an app declaring no automations gets
 * the empty state and NO tab bar, rather than two triggers over two empty
 * tables. A strip is an offer of two answers, and there are none to offer.
 */
const liveBody = (): PageComponent =>
  ({
    ...(tabbedBody('$t:admin.automations.tabs.region', TABS, [historyPanel(), catalogPanel()], {
      fill: true,
    }) as Record<string, unknown>),
    visibility: { declares: 'automations' },
  }) as PageComponent

/**
 * The whole-page empty state.
 *
 * With no automations declared there is nothing to catalogue AND nothing to run,
 * so one region stands in for both sections.
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

const runsPage: PageConfig = withShell(
  {
    id: 'dashboard-data-automations',
    name: 'dashboard-data-automations',
    path: '/automations',
    meta: { title: '$t:admin.meta.automations', lang: 'en-US' },
    // `?tab=` is the address of each half. Without this block `$query.tab` is
    // left verbatim and the strip silently opens on History for every link.
    query: tabQuery(TABS),
    components: [
      pageHeading('$t:admin.automations.heading', '$t:admin.automations.blurb'),
      liveBody(),
      noAutomations(),
    ],
  } as PageConfig,
  { breadcrumb: { automations: '$t:admin.crumb.automations' }, fill: true }
)

export const automationPages: readonly PageConfig[] = [runsPage, runPage]
