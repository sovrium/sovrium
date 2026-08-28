/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The reclaimed dashboard ROOT — the "Dashboard" overview
 *.
 *
 * `/_admin` opens a cross-domain KPI overview — NOT the retired "Data"
 * card-grid landing (the [internal ref] flat Data-nav sidebar is now the full
 * navigation, so a separate card-grid landing is redundant).
 *
 * DOGFOODING: the overview is now built from the GENERIC `kpi`
 * component bound to the EXISTING cross-domain roll-up (`GET /api/admin/overview`)
 * via the `dataSource.system` value-path binding — NOT a bespoke `admin-overview`
 * island. Each headline figure (Records / Submissions / Runs (24h) /
 * Users / Storage / Connections / Success rate) is one `kpi` tile
 * reading its scalar (or a `valueTemplate` for the composite healthy/total
 * Connections tile) out of the same shared envelope. The 7 tiles share ONE fetch
 * (the `useKpiSystemValue` queryKey is keyed on the endpoint, so TanStack Query
 * dedupes them) over no new backend.
 *
 * The body is a page intro (heading + one-liner), a labelled
 * `<section aria-label="Overview">` region wrapping a responsive grid of
 * `kpi` components, and a `<section aria-label="Recent activity">` panel
 * reading the audit log. Each tile's `kpi` SSR skeleton paints its label as
 * visible text pre-hydration, so `getByRole('region', { name: 'Overview' })`
 * and the per-tile `getByText('<label>', { exact: true })` both resolve before
 * the shared endpoint fetch settles. Wrapped in the persistent shell so the
 * Data-nav sidebar + breadcrumb frame it. The overview IS home, so the breadcrumb
 * is the brand home crumb only (no leaf).
 *
 * The KPIs answer "how much"; the activity panel answers "what just happened,
 * and who did it" — together the two questions an operator opens a console with.
 */

import { homeCrumb, wrapInShell } from './dashboard-shell-surface'
import { dataPageIntro } from './data-object-rail'
import type { DataShellOptions } from './data-landing-surface'
import type { Page } from '@/domain/models/app/pages'
import type { Component } from '@/domain/models/app/pages/components'

/** The cross-domain roll-up endpoint every overview tile reads from. */
const OVERVIEW_ENDPOINT = '/api/admin/overview'

/** The canonical audit-log read endpoint backing the recent-activity panel. */
const ACTIVITY_ENDPOINT = '/api/admin/audit-log'

/** The page intro: heading + orienting one-liner (the h2 the spec resolves). */
function intro(): Component {
  return dataPageIntro(
    'Dashboard',
    'An overview of your app: records, submissions, runs, accounts, storage, and connections, at a glance.'
  )
}

/** A single overview KPI tile reading a scalar at `valuePath` from the roll-up. */
function valuePathTile(
  label: string,
  valuePath: string,
  kpiFormat?: { readonly type: string; readonly options?: Readonly<Record<string, string>> }
): Component {
  return {
    type: 'kpi',
    label,
    dataSource: { system: { endpoint: OVERVIEW_ENDPOINT, valuePath } },
    ...(kpiFormat ? { kpiFormat } : {}),
  } as unknown as Component
}

/**
 * The overview body: a labelled `<section aria-label="Overview">` region
 * (the landmark the spec resolves) wrapping a responsive grid of generic `kpi`
 * tiles bound to the cross-domain roll-up via `dataSource.system`.
 *
 * One tile per headline figure:
 *  - Records / Submissions / Runs (24h) / Users → number
 *  - Storage → bytes (compact B/KB/MB/GB — see the shared kpi formatter)
 *  - Connections → a `valueTemplate` composite "healthy/total"
 *  - Success rate → percentage of a 0–1 fraction (`scale: '100'` → "NN%")
 *
 * Every tile reads the SAME `/api/admin/overview` envelope; the system-value hook
 * dedupes them into ONE shared fetch.
 */
function overviewBody(): Component {
  return {
    type: 'container',
    element: 'section',
    props: {
      className: 'pt-2',
      'aria-label': 'Overview',
    },
    children: [
      {
        type: 'container',
        props: { className: 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3' },
        children: [
          valuePathTile('Records', 'records.total', { type: 'number' }),
          valuePathTile('Submissions', 'submissions.total', { type: 'number' }),
          valuePathTile('Runs (24h)', 'runs.recent', { type: 'number' }),
          valuePathTile('Users', 'users.total', { type: 'number' }),
          valuePathTile('Storage', 'storage.totalBytes', { type: 'bytes' }),
          {
            type: 'kpi',
            label: 'Connections',
            dataSource: {
              system: {
                endpoint: OVERVIEW_ENDPOINT,
                valueTemplate: '{connections.healthy}/{connections.total}',
              },
            },
          } as unknown as Component,
          valuePathTile('Success rate', 'runs.successRate', {
            type: 'percentage',
            options: { scale: '100' },
          }),
        ],
      } as unknown as Component,
    ],
  } as unknown as Component
}

/**
 * The recent-activity columns, read straight off the canonical audit-log entry.
 *
 * `actor.email` and `resource.type` are dot paths into the entry's nested
 * `actor` / `resource` blocks — the column accessor resolves them.
 *
 * `result` is rendered as PLAIN TEXT, deliberately. It is a run outcome on an
 * admin surface, which [internal ref] A7 classes as chrome: the retired
 * `success` / `warning` ramps "do not return through a chip-shaped door". An
 * operator scanning for failures reads the word, not a hue.
 */
const ACTIVITY_COLUMNS = [
  { field: 'timestamp', label: 'When', format: 'datetime' },
  { field: 'action', label: 'Action' },
  { field: 'actor.email', label: 'Actor' },
  { field: 'resource.type', label: 'Resource' },
  {
    field: 'transport',
    label: 'Channel',
    valueLabels: {
      'config-file': 'Config file',
      env: 'Environment',
      api: 'API',
      mcp: 'MCP',
      restore: 'Restore',
    },
  },
  { field: 'result', label: 'Result', valueLabels: { success: 'Success', failure: 'Failed' } },
] as const

/**
 * The recent-activity panel: the audit log an operator scans to answer "what
 * just happened, and who did it?" — the one question a KPI tile cannot answer.
 *
 * A generic system-source `data-table` over the EXISTING
 * `GET /api/admin/audit-log` (`{ items: [...] }`, keyed on `id`) — no bespoke
 * island and no new backend, per the dogfooding rule.
 *
 * NO `pagination` block, deliberately. The system fetch already sends
 * `?page=N&limit=N` (`use-system-source-fetch.ts:157-158`) and the grid runs
 * `manualPagination: true` (`use-table.ts:125`), so it renders exactly what the
 * server returned. But this endpoint's Phase-0 handler parses only `actorId` /
 * `action` / `transport` / `resourceType` and returns EVERY entry
 * (`routes/admin/audit-log.ts:46-57`). Declaring a page size therefore produced
 * a pager reading "1–8 of 10" above all ten rows — the same wrong-answer shape
 * as a search box that filters nothing. Until the endpoint honours `limit` /
 * `cursor`, the panel shows the log unpaged rather than claiming a page it does
 * not have.
 */
function activityPanel(): Component {
  return {
    type: 'container',
    element: 'section',
    props: { className: 'flex flex-col gap-3 pt-4', 'aria-label': 'Recent activity' },
    children: [
      {
        type: 'text',
        element: 'h3',
        props: { className: 'text-lg font-semibold tracking-tight' },
        content: 'Recent activity',
      } as unknown as Component,
      {
        type: 'data-table',
        props: { id: 'overview-activity-grid', 'aria-label': 'Recent activity' },
        dataSource: { system: { endpoint: ACTIVITY_ENDPOINT, rowsKey: 'items', idKey: 'id' } },
        columns: ACTIVITY_COLUMNS,
        emptyMessage: 'No activity yet. Operator actions are recorded here as they happen.',
      } as unknown as Component,
    ],
  } as unknown as Component
}

/**
 * Build the dashboard root overview page (`/_admin`), wrapped in the persistent
 * shell. The breadcrumb is the brand home crumb only — the overview IS home.
 */
export function buildOverviewPage(options: DataShellOptions): Page {
  return {
    id: 'dashboard-overview',
    name: 'dashboard-overview',
    path: '/',
    meta: { title: 'Sovrium — Dashboard' },
    components: wrapInShell([intro(), overviewBody(), activityPanel()], {
      canEdit: options.canEdit,
      appName: options.appName,
      appVersion: options.appVersion,
      breadcrumb: [homeCrumb(options.appName)],
    }),
  } as Page
}
