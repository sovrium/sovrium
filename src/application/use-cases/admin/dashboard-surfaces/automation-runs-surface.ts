/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Dashboard automation run-history surface ([internal ref]
 * + the -DATATABLE conversion).
 *
 * The read-only Runs directory is the FIRST proof of the reusable system
 * read-endpoint binding: the
 * run-history LIST is a config `data-table` bound via `dataSource.system` to
 * `GET /api/admin/automations/runs` — the dashboard dogfoods its own components
 * instead of a bespoke run-list island. The conversion preserves the live
 * baseline verbatim (the "Run history" table with columns
 * Automation · Status · Started · Duration, the status pill, the two
 * server-side filters, and the "No runs" empty state) and GAINS column
 * sort + pagination over the old list. Runs are OBSERVED here, not triggered
 * (the dashboard is a pure DATA console, config code-only, [internal ref]).
 *
 * The body composes three parts:
 *  1. a shared-filter PUBLISHER (`shared-filter-select` island) — the
 *     "Filter by automation" / "Filter by status" comboboxes that publish
 *     their `{ automationName, status }` selection on the shared-filter bus; the
 *     grid declares `dataSource.system.bindTo` + `sharedFilter` so the runtime
 *     forwards it to the runs endpoint as `?automationName=` / `?status=`
 * ([internal ref] — the config expression
 *     of -DATATABLE-004, no bespoke event-bus island);
 *  2. the config `data-table` (system source) — the run-history list;
 * 3. the run-detail drill-down as the GENERIC `record-drawer` ([internal ref]
 *     over `dataSource.system`) — opened on demand from the data-table's action
 *     column (`openDrawer`), binding via `dataSource.system` to the per-run detail
 *     endpoint `GET /api/admin/automations/runs/:runId` (the clicked row id injected
 *     into the `:runId` slot). It presents as a named `region "Run details"`
 *     (CAP-2), renders `steps` as a structured list + the top-level error blob as a
 *     code block (CAP-3), and offers a confirm-gated "Retry" footer `fetch` action
 *     POSTing the run-retry endpoint (CAP-1) — dogfooding the record-drawer instead of
 *     the bespoke `admin-automation-runs-detail` + `-retry` islands (now dropped).
 */

import type { Component } from '@/domain/models/app/pages/components'

/**
 * Id of the run-history data-table component. Doubles as its `searchSourceId`
 * and as the `openDrawer` target id the action column fires (the detail island
 * listens for the matching `sovrium:open-drawer`).
 */
const RUNS_GRID_ID = 'automation-runs-grid'

/**
 * Id of the shared-filter PUBLISHER (the automation + status comboboxes). The
 * grid's `dataSource.system.bindTo` references this id so the runtime subscribes
 * the grid to the publisher's `{ automationName, status }` selection.
 */
const RUNS_FILTER_ID = 'automation-runs-filter'

/**
 * Id of the run-detail `record-drawer` — the `openDrawer` target the run-history
 * grid's action column fires (`onRowClick`/action → `{ action: 'openDrawer',
 * component: RUNS_DETAIL_ID }` → `sovrium:open-drawer` event). The drawer's own
 * `id` matches it so only that drawer opens, populated by the clicked row's id.
 */
const RUNS_DETAIL_ID = 'automation-runs-detail'

/**
 * Run-history grid columns. The Status column maps the localized run-status label
 * (Success/Failed/Partial — the query layer maps the engine status for the
 * runs endpoint) to a status-pill className via conditional `cellStyle`; the
 * trailing action column fires `openDrawer` to load the run-detail pane.
 */
const RUNS_COLUMNS = [
  { field: 'automationName', label: 'Automation' },
  {
    field: 'status',
    label: 'Status',
    cellStyle: [
      {
        when: { eq: 'Success' },
        className: 'bg-success-bg text-success-fg rounded-full px-2 py-0.5 text-xs',
      },
      {
        when: { eq: 'Failed' },
        className: 'bg-danger-bg text-danger-fg rounded-full px-2 py-0.5 text-xs',
      },
      {
        when: { eq: 'Partial' },
        className: 'bg-warning-bg text-warning-fg rounded-full px-2 py-0.5 text-xs',
      },
    ],
  },
  { field: 'startedAt', label: 'Started', format: 'datetime' },
  { field: 'durationMs', label: 'Duration', align: 'right' },
  {
    type: 'actions',
    label: '',
    actions: [
      {
        label: 'View run',
        action: { action: 'openDrawer', component: RUNS_DETAIL_ID },
      },
    ],
  },
] as const

/**
 * The system-source `data-table` for the run-history list. Bound to
 * `GET /api/admin/automations/runs` (the `{ items: [...] }` envelope, rows
 * keyed on `id`); columns + status pill come from {@link RUNS_COLUMNS}.
 */
function runsDataTable(): Component {
  return {
    type: 'data-table',
    props: {
      id: RUNS_GRID_ID,
      'aria-label': 'Run history',
    },
    dataSource: {
      system: {
        endpoint: '/api/admin/automations/runs',
        rowsKey: 'items',
        idKey: 'id',
        // Config shared-filter binding:
        // subscribe this grid to the sibling filter publisher and merge its
        // `{ automationName, status }` selection into every runs request. The
        // dynamic counterpart to the static `query` — no bespoke filter island.
        bindTo: RUNS_FILTER_ID,
        sharedFilter: { params: ['automationName', 'status'] },
      },
    },
    columns: RUNS_COLUMNS,
    toolbar: { sort: true },
    pagination: { pageSize: 25 },
    emptyMessage: 'No runs',
  } as unknown as Component
}

/**
 * The automation + status shared-filter PUBLISHER island host. Carries the
 * operator's automation NAMES (the automation filter options) and its OWN
 * publisher id (`RUNS_FILTER_ID`) — the id the grid's `bindTo` references. The
 * island publishes its selection on the shared-filter bus tagged with this id.
 */
function runsFiltersBar(automationNames: ReadonlyArray<string>): Component {
  return {
    type: 'container',
    element: 'div',
    props: {
      id: RUNS_FILTER_ID,
      className: 'mb-4',
      'data-island': 'shared-filter-select',
      'data-island-props': JSON.stringify({ sourceId: RUNS_FILTER_ID, automationNames }),
    },
  } as unknown as Component
}

/**
 * The run-detail drill-down as the GENERIC `record-drawer`
 * ([internal ref] over `dataSource.system`). Opened on demand from the
 * data-table action column's `openDrawer` (the dispatched `sovrium:open-drawer`
 * event id matches this drawer's {@link RUNS_DETAIL_ID}), it binds via
 * `dataSource.system` to the per-run detail endpoint
 * `GET /api/admin/automations/runs/:runId` — the clicked row's id is injected
 * into the `:runId` slot, so the GET only fires on a row-click (not on page
 * load). It is READ-ONLY (`canEdit: false` — a system source has no records
 * table to PATCH).
 *
 * The three drawer capabilities express the bespoke pane's behaviour as config:
 *  - CAP-2 `role: 'region'` + `props.title` → the surface announces as
 *    `region "Run details"` (the same named landmark the spec resolves);
 *  - CAP-3 `recordFields[].renderAs` → `steps` renders as a structured list (one
 *    item per step, its Input/Output/error key/values readable) and the run's
 *    top-level `error` renders as a code/log block instead of mangling to
 *    `[object Object]`;
 *  - CAP-1 `actions` → a confirm-gated "Retry" footer `fetch` action POSTing
 *    `…/runs/$record.id/retry` (`$record.id` resolved at click time against the
 *    loaded run). The `confirm` prompt surfaces the inline
 *    `alertdialog "Confirm retry"` whose confirm affordance
 *    reuses the action's "Retry" label.
 *
 * `recordFields` describe the run-detail endpoint ENVELOPE (a run row + `steps`),
 * NOT a declared table — the system-detail drawer skips `app.tables`
 * cross-validation.
 */
function runDetailDrawer(): Component {
  return {
    type: 'record-drawer',
    id: RUNS_DETAIL_ID,
    role: 'region',
    props: { title: 'Run details' },
    dataSource: {
      system: { endpoint: '/api/admin/automations/runs/:runId', param: 'runId' },
    },
    canEdit: false,
    recordFields: [
      { name: 'automationName', type: 'single-line-text' },
      { name: 'status', type: 'single-line-text' },
      { name: 'startedAt', type: 'single-line-text' },
      { name: 'durationMs', type: 'single-line-text' },
      { name: 'steps', type: 'json', renderAs: 'list' },
      { name: 'error', type: 'long-text', renderAs: 'code' },
    ],
    actions: [
      {
        label: 'Retry',
        confirm: 'Confirm retry',
        action: {
          type: 'fetch',
          method: 'POST',
          url: '/api/admin/automations/runs/$record.id/retry',
        },
      },
    ],
  } as unknown as Component
}

/**
 * The converted run-history directory body: the external filter bar, the
 * system-source `data-table` run list, and the on-demand run-detail
 * `record-drawer` (opened from the grid's action column).
 *
 * @param automationNames - The operator's automation names (the automation
 * filter options — [internal ref] defaults to ALL runs and filters by
 *   automation rather than picking one in a left rail).
 */
export function automationRunsBody(automationNames: ReadonlyArray<string>): Component {
  return {
    type: 'container',
    element: 'div',
    props: { className: 'p-6' },
    children: [runsFiltersBar(automationNames), runsDataTable(), runDetailDrawer()],
  } as unknown as Component
}
