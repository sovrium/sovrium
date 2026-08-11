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
 *     read-only) with a client-side `search`, `emptyMessage` / `noMatchMessage`;
 *   - **valueLabels** to localize the raw `banned` boolean cell at render time
 *     (`false` → "actif", `true` → "banni"); the `role` cell renders raw;
 *   - the row gestures rewired onto config `fetch` actions (CAP-3): **editSelect**
 *     for "Change role" (POST `/api/auth/admin/set-role`), **visibleWhen +
 *     object confirm** for the destructive "Bannir", **visibleWhen** for "Lever le
 *     bannissement" (POST `unban-user`) — all with `responseEnvelope: better-auth`
 *     (the always-200, enumeration-safe envelope read as success/error) +
 *     `onSuccess.refetch` to refresh the grid;
 *   - a **CSV export** — the toolbar `export` affordance ("Exporter") navigates
 *     the browser (`mode: navigate`) to the system endpoint's `?format=csv`.
 *
 * The directory LOAD read is the admin-tier `GET /api/admin/users` (custom-role
 * aware; NOT Better Auth's `list-users`, which 404s for a partner-style custom
 * top role). Accounts are OBSERVED + administered here — the dashboard is a pure
 * DATA console (config code-only, [internal ref]).
 */

import { BUILT_IN_ROLES } from '@/domain/models/app/auth/roles'
import { homeCrumb, wrapInShell } from './dashboard-shell-surface'
import { dataPageIntro } from './data-object-rail'
import type { DataShellOptions } from './data-landing-surface'
import type { Page } from '@/domain/models/app/pages'
import type { Component } from '@/domain/models/app/pages/components'

/** Id of the users directory data-table component (the `onSuccess.refetch` target). */
const USERS_GRID_ID = 'admin-users-grid'

/**
 * The per-row action column. Each gesture is a config `fetch` operate action
 * dispatched through the shared action-executor (CAP-3), re-homed verbatim from
 * the retired `admin-users-directory-data.ts` helper:
 *   - "Change role" — an `editSelect` (inline `<select>` named "Role" +
 *     "Enregistrer" commit) whose picked value overrides `$record.role`, POSTing
 *     `/api/auth/admin/set-role` under the Better-Auth envelope; `onSuccess.refetch`
 *     refreshes the grid so the role cell reflects the pick.
 *   - "Bannir" — gated on `banned === false`, carrying an object `confirm`
 *     (an `alertdialog` named by its `title`) before POSTing `ban-user`.
 *   - "Lift ban" — gated on `banned === true`, POSTing `unban-user`.
 * The Better-Auth admin plugin returns an always-200 enumeration-safe envelope,
 * so each action declares `responseEnvelope: 'better-auth'` (success is read from
 * the body, not the HTTP status).
 */
const USERS_COLUMNS = [
  { field: 'email', label: 'Email' },
  { field: 'role', label: 'Role' },
  {
    field: 'banned',
    label: 'Status',
    // Render-only localization of the raw `banned` boolean — the endpoint returns
    // the raw boolean, so the relabel is client-side (never a server mutation).
    valueLabels: { false: 'actif', true: 'banni' },
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
  {
    type: 'actions',
    label: 'Actions',
    actions: [
      {
        label: 'Change role',
        editSelect: {
          field: 'role',
          label: 'Role',
          saveLabel: 'Save',
          // Derived from BUILT_IN_ROLES, never hand-listed. These three are
          // assignable in EVERY app, so the picker can never offer a role the
          // set-role write boundary will reject with a 400.
          //
          // It previously read `['member', 'editor', 'admin']` — `editor` is not
          // a built-in and is only assignable in an app that happens to declare
          // it, while the genuine built-in `viewer` was missing. Better Auth
          // stored the bad value verbatim, so the console quietly produced users
          // matching no permission rule. Custom and admin-tier roles are still
          // assignable through the admin API and the CLI; this inline picker
          // deliberately covers only the always-valid built-ins.
          options: BUILT_IN_ROLES.map((value) => ({ value })),
        },
        action: {
          type: 'fetch',
          url: '/api/auth/admin/set-role',
          method: 'POST',
          body: { userId: '$record.id', role: '$record.role' },
          responseEnvelope: 'better-auth',
          onSuccess: { type: 'toast', message: 'Role updated', refetch: USERS_GRID_ID },
        },
      },
      {
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
      },
      {
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
      },
    ],
  },
] as const

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
 * `toolbar.export` surfaces the "Exporter" CSV affordance (a `mode: navigate` to
 * the system endpoint's `?format=csv`); the `Users` table aria-label
 * preserves the live-observed landmark.
 */
function usersDataTable(): Component {
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
      },
    },
    columns: USERS_COLUMNS,
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
export function buildDataUsersPage(options: DataShellOptions): Page {
  return {
    id: 'dashboard-data-users',
    name: 'dashboard-data-users',
    path: '/users',
    meta: { title: 'Sovrium — Data · Users' },
    components: wrapInShell([intro(), kpiStrip(), usersDataTable()], {
      canEdit: options.canEdit,
      appName: options.appName,
      appVersion: options.appVersion,
      breadcrumb: [homeCrumb(options.appName), { label: 'Users', href: '/_admin/users' }],
      publishedSnapshot: options.publishedSnapshot ?? {},
    }),
  } as Page
}
