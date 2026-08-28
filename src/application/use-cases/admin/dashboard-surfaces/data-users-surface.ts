/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The Data-tab **Users** page — the
 * global account directory at `/_admin/users`, converted onto generic config
 * (Consoles-as-Config, [internal ref] dogfooding).
 *
 * `/_admin/users` opens a flat Stripe-Dashboard account directory. It was a
 * bespoke island (`admin-users-directory`); it is now a generic, config-driven
 * `data-table` bound via `dataSource.system` to Sovrium's admin-tier directory
 * endpoint (`GET /api/admin/users`) — the dashboard dogfoods its own components
 * instead of bespoke UI. The in-dashboard create form is DROPPED by design: the
 * create path persists via the Better Auth admin API / MCP
 * (`POST /api/auth/admin/create-user`), documented on the Developers → API
 * page.
 *
 * The converted surface composes (mirroring `data-connections-surface.ts`):
 *   - a **KPI strip** — three sibling system-source `kpi` cards over the
 *     users-overview endpoint (`totals.users` / `active_24h` / `new_in_period`);
 *   - a **system-source** `data-table` (a read endpoint, not a DB table —
 *     read-only) with a SERVER-side `search` — the grid forwards its box as
 *     `?q=` over `email` + `name`, and the response's `appliedQuery` tells it
 *     the narrowing already ran so it must not repeat it in memory — plus
 *     `emptyMessage` / `noMatchMessage`;
 *   - **valueLabels** to localize the raw `banned` boolean cell at render time
 *     (`false` → "active", `true` → "banned"); the `role` cell renders raw;
 *   - the row gestures rewired onto config `fetch` actions (CAP-3): **editSelect**
 *     for "Change role" (POST `/api/auth/admin/set-role`), **visibleWhen +
 *     object confirm** for the destructive "Ban", **visibleWhen** for "Lift ban"
 *     (POST `unban-user`) — all with `responseEnvelope: better-auth`
 *     (the always-200, enumeration-safe envelope read as success/error) +
 *     `onSuccess.refetch` to refresh the grid;
 *   - a **CSV export** — the toolbar `export` affordance ("Export") navigates
 *     the browser (`mode: navigate`) to the system endpoint's `?format=csv`.
 *
 * The directory LOAD read is the admin-tier `GET /api/admin/users` (custom-role
 * aware; NOT Better Auth's `list-users`, which 404s for a partner-style custom
 * top role). Accounts are OBSERVED + administered here — the dashboard is a pure
 * DATA console (config code-only, [internal ref]).
 */

import { assignableRoleNames } from '@/domain/models/app/auth/roles'
import { homeCrumb, wrapInShell } from './dashboard-shell-surface'
import { dataPageIntro } from './data-object-rail'
import type { DataShellOptions } from './data-landing-surface'
import type { App } from '@/domain/models/app'
import type { Page } from '@/domain/models/app/pages'
import type { Component } from '@/domain/models/app/pages/components'

/** Id of the users directory data-table component (the `onSuccess.refetch` target). */
const USERS_GRID_ID = 'admin-users-grid'

/**
 * The always-visible directory columns — the READ half of the surface, painted
 * for every caller who reaches the console ([internal ref]: it is a read-only
 * operational data console before it is anything else).
 */
const USERS_READ_COLUMNS = [
  { field: 'email', label: 'Email' },
  // The account display name — one of the two `?q=` search keys, so it has to be
  // VISIBLE. A row that matches on a field the operator cannot see is a quieter
  // version of the bug this column exists to fix: a result with no legible reason
  // why it matched. Email stays the leading column — it is the directory's
  // primary key in practice and is always present, whereas `name` is coalesced
  // to '' for an account created without one.
  { field: 'name', label: 'Name' },
  { field: 'role', label: 'Role' },
  {
    field: 'banned',
    label: 'Status',
    // Render-only localization of the raw `banned` boolean — the endpoint returns
    // the raw boolean, so the relabel is client-side (never a server mutation).
    valueLabels: { false: 'active', true: 'banned' },
    cellStyle: [
      {
        when: { eq: false },
        className: 'bg-success-bg text-success-fg rounded-full px-2 py-0.5 text-xs',
      },
      {
        when: { eq: true },
        className: 'bg-error-bg text-error-fg rounded-full px-2 py-0.5 text-xs',
      },
    ],
  },
] as const

/**
 * The per-row action column. Each gesture is a config `fetch` operate action
 * dispatched through the shared action-executor (CAP-3), re-homed verbatim from
 * the retired `admin-users-directory-data.ts` helper:
 *   - "Change role" — an `editSelect` (inline `<select>` named "Role" +
 *     "Save" commit) whose picked value overrides `$record.role`, POSTing
 *     `/api/auth/admin/set-role` under the Better-Auth envelope; `onSuccess.refetch`
 *     refreshes the grid so the role cell reflects the pick.
 *   - "Ban" — gated on `banned === false`, carrying an object `confirm`
 *     (an `alertdialog` named by its `title`) before POSTing `ban-user`.
 *   - "Lift ban" — gated on `banned === true`, POSTing `unban-user`.
 * The Better-Auth admin plugin returns an always-200 enumeration-safe envelope,
 * so each action declares `responseEnvelope: 'better-auth'` (success is read from
 * the body, not the HTTP status).
 *
 * Painted ONLY for a caller who is admin-EQUIVALENT for this app
 * (`ConsolePosture.canAdministerAccounts`). Every endpoint below lives on
 * `/api/auth/admin/*`, which 404s an admin-TIER-but-not-equivalent operator, so
 * rendering these for an `admin-viewer` would paint three controls their own
 * backend refuses.
 *
 * ROLE PICKER — the option set is `assignableRoleNames(app)`, the SAME set the
 * set-role write boundary accepts (`validateAssignableRole`,
 * `admin-role-guards.ts`) and the same set that boundary already enumerates back
 * to the caller in its own 400 message. Making the affordance and the permission
 * one set is the only arrangement under which they cannot disagree.
 *
 * It previously read `BUILT_IN_ROLES` — safe, because those three are assignable
 * in every app, but it purchased that safety by hiding every role an app
 * actually declares. On partner the picker offered `admin` / `member` / `viewer`
 * while the app declares `engineer` / `customer-admin` / `customer-member`: ZERO
 * overlap. The operator could not express `customer-member`, their own default
 * role, and was offered three roles the app never assigns. A picker NARROWER
 * than the write boundary hides legitimate roles; a picker WIDER offers a value
 * guaranteed to 400.
 */
const changeRoleAction = (app: Readonly<App>) =>
  ({
    label: 'Change role',
    editSelect: {
      field: 'role',
      label: 'Role',
      saveLabel: 'Save',
      options: [...assignableRoleNames(app)].toSorted().map((value) => ({ value })),
    },
    action: {
      type: 'fetch',
      url: '/api/auth/admin/set-role',
      method: 'POST',
      body: { userId: '$record.id', role: '$record.role' },
      responseEnvelope: 'better-auth',
      onSuccess: { type: 'toast', message: 'Role updated', refetch: USERS_GRID_ID },
    },
  }) as const

const BAN_ACTION = {
  label: 'Ban',
  visibleWhen: { field: 'banned', eq: false },
  confirm: {
    title: 'Confirm ban',
    message: 'This account loses access immediately. You can lift the ban later.',
    role: 'alertdialog',
    confirmLabel: 'Confirm ban',
    cancelLabel: 'Cancel',
  },
  action: {
    type: 'fetch',
    url: '/api/auth/admin/ban-user',
    method: 'POST',
    body: { userId: '$record.id' },
    responseEnvelope: 'better-auth',
    onSuccess: { type: 'toast', message: 'Account banned', refetch: USERS_GRID_ID },
  },
} as const

const LIFT_BAN_ACTION = {
  label: 'Lift ban',
  visibleWhen: { field: 'banned', eq: true },
  action: {
    type: 'fetch',
    url: '/api/auth/admin/unban-user',
    method: 'POST',
    body: { userId: '$record.id' },
    responseEnvelope: 'better-auth',
    onSuccess: { type: 'toast', message: 'Ban lifted', refetch: USERS_GRID_ID },
  },
} as const

const usersActionColumn = (app: Readonly<App>) =>
  ({
    type: 'actions',
    label: 'Actions',
    actions: [changeRoleAction(app), BAN_ACTION, LIFT_BAN_ACTION],
  }) as const

/**
 * The directory columns for this caller: the read columns always, plus the
 * account-write action column only when the admin plane will honour those
 * writes. Omitting the whole column (rather than disabling its buttons) is what
 * makes "no affordance without capability" observable — a disabled control still
 * advertises a capability the caller does not have.
 */
const usersColumns = (app: Readonly<App>, canAdministerAccounts: boolean) =>
  canAdministerAccounts ? [...USERS_READ_COLUMNS, usersActionColumn(app)] : USERS_READ_COLUMNS

/** The page intro: heading + orienting one-liner. */
function intro(): Component {
  return dataPageIntro(
    'Users',
    'Manage your app’s accounts: search for a user, adjust their role, or suspend access. Account creation goes through the admin API (see Developers → API).'
  )
}

/**
 * One system-source `kpi` card reading a pre-computed scalar from the
 * users-overview endpoint at `valuePath`. A failed read degrades calmly to the
 * neutral em-dash placeholder.
 */
function overviewKpi(label: string, valuePath: string): Component {
  return {
    type: 'kpi',
    label,
    dataSource: {
      system: {
        endpoint: '/api/admin/users/overview',
        valuePath,
      },
    },
    kpiFormat: { type: 'number' },
  } as unknown as Component
}

/**
 * The KPI strip — a named `region` wrapping the three account figures
 * (Comptes / Actifs (24 h) / New (period)) as sibling system-source `kpi`
 * cards over `GET /api/admin/users/overview`.
 */
function kpiStrip(): Component {
  return {
    type: 'container',
    element: 'div',
    props: {
      role: 'region',
      'aria-label': 'User metrics',
      className: 'grid grid-cols-1 gap-4 sm:grid-cols-3',
    },
    children: [
      overviewKpi('Accounts', 'totals.users'),
      overviewKpi('Active (24h)', 'totals.active_24h'),
      overviewKpi('New (period)', 'totals.new_in_period'),
    ],
  } as unknown as Component
}

/**
 * The account directory as a system-source `data-table`. Bound to
 * `GET /api/admin/users` (the `{ users: [...] }` envelope, rows keyed on `id`);
 * columns + localized labels + per-row actions come from {@link USERS_COLUMNS}.
 * `toolbar.export` surfaces the "Export" CSV affordance (a `mode: navigate` to
 * the system endpoint's `?format=csv`); the `Users` table aria-label
 * preserves the live-observed landmark.
 */
function usersDataTable(app: Readonly<App>, canAdministerAccounts: boolean): Component {
  return {
    type: 'data-table',
    props: {
      id: USERS_GRID_ID,
      'aria-label': 'Users',
    },
    dataSource: {
      system: {
        endpoint: '/api/admin/users',
        rowsKey: 'users',
        idKey: 'id',
        // Without this the grid counts the rows it was handed, so a page of 25
        // out of 33 accounts reported "1-25 of 25" with Next disabled over the
        // eight it was hiding. The endpoint reports how many accounts MATCH;
        // the pager needs that number, not this page's length.
        totalKey: 'total',
      },
    },
    columns: usersColumns(app, canAdministerAccounts),
    search: { enabled: true, placeholder: 'Search users' },
    toolbar: { search: true, export: true, sort: true },
    pagination: { pageSize: 25 },
    emptyMessage: 'No users yet',
    noMatchMessage: 'No user matches “{query}”',
  } as unknown as Component
}

/**
 * Build the Users page (`/_admin/users`), wrapped in the persistent shell.
 * The breadcrumb anchors it under Console / Data.
 */
export function buildDataUsersPage(options: DataShellOptions, app: Readonly<App>): Page {
  return {
    id: 'dashboard-data-users',
    name: 'dashboard-data-users',
    path: '/users',
    meta: { title: 'Sovrium — Data · Users' },
    components: wrapInShell(
      [intro(), kpiStrip(), usersDataTable(app, options.canAdministerAccounts)],
      {
        canEdit: options.canEdit,
        appName: options.appName,
        appVersion: options.appVersion,
        breadcrumb: [homeCrumb(options.appName), { label: 'Users', href: '/_admin/users' }],
      }
    ),
  } as Page
}
