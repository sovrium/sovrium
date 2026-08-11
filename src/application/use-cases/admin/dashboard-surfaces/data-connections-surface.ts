/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The Data-tab **Connections** page — the
 * flagship Consoles-as-Config conversion ([internal ref] dogfooding).
 *
 * `/_admin/connections` opens a flat Stripe-Dashboard directory of the app's
 * external connections. It was a bespoke island (`admin-connections-directory`);
 * it is now a generic, config-driven `data-table` bound via `dataSource.system`
 * to the admin read endpoint (`GET /api/admin/connections`) — the dashboard
 * dogfoods its own components instead of bespoke UI. This single surface exercises
 * ALL the new data-table vocabulary at once:
 *
 *   - a **system-source** data-table (a read endpoint, not a DB table — read-only,
 *     no record-write affordances);
 *   - **valueLabels** to localize the raw enum cells (`status` / `type` /
 *     `tokenCount`) at render time — the endpoint is `.strict()` and returns the
 *     raw enums, so the relabel is render-only (never a server mutation);
 *   - **visibleWhen** to gate the per-row connect / reconnect / disconnect actions
 *     on the server-computed `rowAction` field (the config predicate tests ONE
 *     field; the compound rule — type + token/expiry state — is computed
 *     server-side into `rowAction`, NOT smuggled into config);
 *   - a **`mode: 'oauth'`** fetch action for "Connecter" / "Reconnecter" (POST the
 *     authorize endpoint, then navigate the browser to the returned provider URL);
 *   - a **`confirm`**-gated fetch action for the destructive "Disconnect".
 *
 * The conversion preserves the live baseline verbatim (the "Connections" table —
 * one row per connection: name, provider, type, status pill, token count, soonest
 * expiry, created date — the localized cell values, and the type/token-gated
 * connect/reconnect/disconnect affordances) and GAINS column sort + pagination
 * over the bespoke island. Connections are OBSERVED here, not configured (the
 * dashboard is a pure DATA console, config code-only, [internal ref]).
 */

import { homeCrumb, wrapInShell } from './dashboard-shell-surface'
import { dataPageIntro } from './data-object-rail'
import type { DataShellOptions } from './data-landing-surface'
import type { Page } from '@/domain/models/app/pages'
import type { Component } from '@/domain/models/app/pages/components'

/** Id of the connections directory data-table component. */
const CONNECTIONS_GRID_ID = 'admin-connections-grid'

/**
 * The shared `mode: 'oauth'` authorize action used by both "Connecter" and
 * "Reconnecter": a fetch-then-redirect round-trip. The client POSTs the
 * id-keyed authorize endpoint (`$record.id` resolves to the clicked connection),
 * which returns the provider consent URL as DATA at `authorizationUrl`; the
 * runtime then navigates the browser to it so the OAuth flow begins.
 * `callbackPath` is the provider's registered redirect_uri (name-keyed, config
 * metadata — no client navigation of its own).
 */
const oauthAuthorizeAction = {
  type: 'fetch',
  mode: 'oauth',
  method: 'POST',
  url: '/api/admin/connections/$record.id/authorize',
  redirectKey: 'authorizationUrl',
  callbackPath: '/api/admin/connections/$record.name/callback',
} as const

/**
 * The per-row connect / reconnect / disconnect action column. Each affordance is
 * gated by the server-computed `rowAction` via `visibleWhen`:
 *   - "Connecter"   — `rowAction === 'connect'`   (oauth2, no tokens);
 *   - "Reconnecter" — `rowAction === 'reconnect'` (oauth2, expiring/expired);
 *   - "Disconnect" — `rowAction ∈ {disconnect, reconnect}` (oauth2 with tokens);
 *     a `none` (non-oauth2) row renders no action at all.
 * "Disconnect" is destructive, so it carries a `confirm` gate (an inline
 * `alertdialog`) before POSTing the id-keyed disconnect endpoint.
 */
const CONNECTIONS_COLUMNS = [
  { field: 'name', label: 'Connection' },
  { field: 'provider', label: 'Provider' },
  {
    field: 'type',
    label: 'Type',
    valueLabels: { oauth2: 'OAuth2', apiKey: 'API key', basic: 'Basic', bearer: 'Bearer' },
  },
  {
    field: 'status',
    label: 'Status',
    valueLabels: { active: 'Active', 'expiring-soon': 'Expiring soon', expired: 'Expired' },
    cellStyle: [
      {
        when: { eq: 'active' },
        className: 'bg-success-bg text-success-fg rounded-full px-2 py-0.5 text-xs',
      },
      {
        when: { eq: 'expiring-soon' },
        className: 'bg-warning-bg text-warning-fg rounded-full px-2 py-0.5 text-xs',
      },
      {
        when: { eq: 'expired' },
        className: 'bg-error-bg text-error-fg rounded-full px-2 py-0.5 text-xs',
      },
    ],
  },
  {
    field: 'tokenCount',
    label: 'Tokens',
    // Render-only relabel of the raw token count. valueLabels is a static map, so
    // the 0 / 1 / 2 forms are mapped explicitly; higher counts fall through to the
    // raw number (a known limitation of static valueLabels vs the bespoke island's
    // dynamic "{n} users" pluralization).
    valueLabels: { '0': 'No tokens', '1': '1 user', '2': '2 users' },
  },
  { field: 'expiresAt', label: 'Expiration', format: 'datetime' },
  { field: 'createdAt', label: 'Created', format: 'datetime' },
  {
    type: 'actions',
    label: 'Actions',
    actions: [
      {
        label: 'Connect',
        visibleWhen: { field: 'rowAction', eq: 'connect' },
        action: oauthAuthorizeAction,
      },
      {
        label: 'Reconnect',
        visibleWhen: { field: 'rowAction', eq: 'reconnect' },
        action: oauthAuthorizeAction,
      },
      {
        label: 'Disconnect',
        visibleWhen: { field: 'rowAction', in: ['disconnect', 'reconnect'] },
        confirm: 'Revoke this connection’s tokens?',
        action: {
          type: 'fetch',
          method: 'POST',
          url: '/api/admin/connections/$record.id/disconnect',
        },
      },
    ],
  },
] as const

/** The page intro: heading + orienting one-liner. */
function intro(): Component {
  return dataPageIntro(
    'Connections',
    'Inspect your app’s connections to external services and the state of their tokens: active, expiring soon, or expired. Connections are declared in config — here you observe their real state.'
  )
}

/**
 * The connections directory as a system-source `data-table`. Bound to
 * `GET /api/admin/connections` (the `{ connections: [...] }` envelope, rows keyed
 * on `id`); columns + localized labels + per-row actions come from
 * {@link CONNECTIONS_COLUMNS}. The `Connections` table aria-label preserves the
 * live-observed landmark.
 */
function connectionsDataTable(): Component {
  return {
    type: 'data-table',
    props: {
      id: CONNECTIONS_GRID_ID,
      'aria-label': 'Connections',
    },
    dataSource: {
      system: {
        endpoint: '/api/admin/connections',
        rowsKey: 'connections',
        idKey: 'id',
      },
    },
    columns: CONNECTIONS_COLUMNS,
    toolbar: { sort: true },
    pagination: { pageSize: 25 },
    emptyMessage: 'No connections',
  } as unknown as Component
}

/**
 * Build the Connections page (`/_admin/connections`), wrapped in the persistent
 * shell. The breadcrumb anchors it under Console / Data.
 */
export function buildDataConnectionsPage(options: DataShellOptions): Page {
  return {
    id: 'dashboard-data-connections',
    name: 'dashboard-data-connections',
    path: '/connections',
    meta: { title: 'Sovrium — Data · Connections' },
    components: wrapInShell([intro(), connectionsDataTable()], {
      canEdit: options.canEdit,
      appName: options.appName,
      appVersion: options.appVersion,
      breadcrumb: [
        homeCrumb(options.appName),
        { label: 'Connections', href: '/_admin/connections' },
      ],
      publishedSnapshot: options.publishedSnapshot ?? {},
    }),
  } as Page
}
