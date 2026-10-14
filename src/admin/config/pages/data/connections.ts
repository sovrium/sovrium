/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// Connections — the app's links to external services, and the state of their
// tokens.
//
// This was the flagship dogfooding conversion: a bespoke
// `admin-connections-directory` island became a generic `table` bound
// through `dataSource.system` to `GET /api/admin/connections`. Moving it to
// config is the last step of that same argument — the surface exercises the
// whole table vocabulary at once and needed a builder for nothing but the
// shell:
//
//   - a SYSTEM-SOURCE table (a read endpoint, not a DB table — read-only,
//     no record-write affordances);
//   - `valueLabels` to relabel the raw enum cells at RENDER time (the endpoint
//     is strict and returns raw enums, so the relabel is never a mutation);
//   - `visibleWhen` to gate the per-row affordances on the server-computed
//     `rowAction` field. The config predicate tests ONE field; the compound rule
//     — type × token/expiry state — is computed server-side into `rowAction`
//     rather than smuggled into config;
//   - a `mode: 'oauth'` fetch for Connect / Reconnect (POST the authorize
//     endpoint, then navigate to the provider URL it returns as data);
//   - a `confirm`-gated fetch for the destructive Disconnect.
//
// Connections are OBSERVED here, never configured ([internal ref]: the console is a
// pure DATA console; connections are declared in the config file).

import { pageHeading } from '../../components/data-page'
import { dataTable, STATUS_BADGE } from '../../components/data-table-blocks'
import { withShell } from '../../components/shell'
import type { Page as PageConfig } from '@/domain/models/app'

/**
 * The shared `mode: 'oauth'` authorize action behind both Connect and
 * Reconnect: a fetch-then-redirect round trip. The client POSTs the id-keyed
 * authorize endpoint (`$record.id` resolves to the clicked connection), which
 * returns the provider consent URL as DATA at `authorizationUrl`; the runtime
 * then navigates the browser there so the OAuth flow begins.
 *
 * `callbackPath` is the provider's registered redirect_uri — name-keyed config
 * metadata, with no client navigation of its own.
 *
 * Both are `/api/` addresses, so the mount's href walk leaves them alone: the
 * JSON API is mounted once for the whole server, outside any console base.
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
 * The directory's columns, and the per-row connect / reconnect / disconnect
 * column. Each affordance is gated on the server-computed `rowAction`:
 *
 *   Connect     — `rowAction === 'connect'`   (oauth2, no tokens)
 *   Reconnect   — `rowAction === 'reconnect'` (oauth2, expiring, expired or
 *                 reconnect-needed)
 *   Disconnect  — `rowAction ∈ {disconnect, reconnect}` (oauth2 with tokens)
 *
 * A `none` row (a non-oauth2 connection) renders no action at all. Disconnect is
 * destructive, so it carries a `confirm` gate before POSTing.
 *
 * Every caption here is a `$t:` key: the component translation pass resolves a
 * table's column and action labels, `valueLabels`, placeholders and empty copy
 * before the island props are built, so the whole directory speaks the
 * console's language.
 */
const CONNECTIONS_COLUMNS = [
  { field: 'name', label: '$t:admin.connections.col.connection' },
  { field: 'provider', label: '$t:admin.connections.col.provider' },
  {
    field: 'type',
    label: '$t:admin.connections.col.type',
    valueLabels: {
      oauth2: 'OAuth2',
      apiKey: '$t:admin.connections.type.apiKey',
      basic: 'Basic',
      bearer: 'Bearer',
    },
  },
  {
    field: 'status',
    label: '$t:admin.connections.col.status',
    valueLabels: {
      active: '$t:admin.connections.status.active',
      'expiring-soon': '$t:admin.connections.status.expiringSoon',
      expired: '$t:admin.connections.status.expired',
      'reconnect-needed': '$t:admin.connections.status.reconnectNeeded',
    },
    cellStyle: [
      { when: { eq: 'active' }, className: STATUS_BADGE.positive },
      { when: { eq: 'expiring-soon' }, className: STATUS_BADGE.caution },
      { when: { eq: 'expired' }, className: STATUS_BADGE.destructive },
      // A token the provider gave no refresh token for (LinkedIn, Meta): it
      // lapses and nothing but a new authorization restores it. That is the
      // one status that is ALWAYS a call to action — `expired` heals itself on
      // the next call — so it takes the consequence tone, and the row offers
      // Reconnect (`rowAction === 'reconnect'`).
      { when: { eq: 'reconnect-needed' }, className: STATUS_BADGE.destructive },
    ],
  },
  {
    field: 'tokenCount',
    label: '$t:admin.connections.col.tokens',
    // Render-only relabel of the raw count. `valueLabels` is a STATIC map, so
    // the 0 / 1 / 2 forms are mapped explicitly and higher counts fall through
    // to the raw number — a known limit of static labels against the bespoke
    // island's dynamic "{n} users" pluralization.
    valueLabels: {
      '0': '$t:admin.connections.tokens.none',
      '1': '$t:admin.connections.tokens.one',
      '2': '$t:admin.connections.tokens.two',
    },
  },
  { field: 'expiresAt', label: '$t:admin.connections.col.expiration', format: 'datetime' },
  { field: 'createdAt', label: '$t:admin.connections.col.created', format: 'datetime' },
  {
    type: 'actions',
    label: '$t:admin.connections.col.actions',
    // Authorize and disconnect are editor-only writes: the read-only tier gets no column.
    capability: 'edit-operations',
    // ─── THE MAINTENANCE GESTURES RECEDE; THE ONE THAT SETS UP DOES NOT ──────
    //
    // The reference draws this column with `Reconnect` and `Disconnect` quiet
    // and `Connect` prominent, and the reasoning survives translation: on a
    // CONNECTED row there is nothing to do, and two filled buttons offering to
    // undo or redo a working credential read as work waiting. `ghost` is the
    // tone for exactly that — an affordance that is present without asking to
    // be used.
    //
    // `Connect` keeps the NEUTRAL default rather than taking the reference's
    // primary fill, and that is a deliberate deviation. The drawing's fixture
    // holds a handful of connections with one unconnected among them, where a
    // single filled button is the obvious next step. A real app declares as
    // many providers as it uses and a FRESH instance has none of them
    // connected, so a primary tone here paints a whole COLUMN of filled
    // buttons — the same "everything shouts, so nothing does" that the
    // destructive default next door exists to avoid. Beside two ghosts, a
    // neutral `Connect` is already the loudest thing in the cell, which is all
    // the drawing is asking for.
    //
    // `Disconnect` is NOT `destructive`, and the reference agrees. Its
    // consequence is real — tokens are revoked and the automations using them
    // fail at their next run — but it is recovered by reconnecting, and the
    // drawing keeps the danger weight for the confirm inside the dialog, which
    // is the last thing standing between a click and a revoked token.
    actions: [
      {
        label: '$t:admin.connections.action.connect',
        icon: 'plug',
        visibleWhen: { field: 'rowAction', eq: 'connect' },
        action: oauthAuthorizeAction,
      },
      {
        label: '$t:admin.connections.action.reconnect',
        icon: 'refresh-cw',
        visibleWhen: { field: 'rowAction', eq: 'reconnect' },
        action: oauthAuthorizeAction,
      },
      {
        label: '$t:admin.connections.action.disconnect',
        icon: 'unplug',
        variant: 'destructive',
        visibleWhen: { field: 'rowAction', in: ['disconnect', 'reconnect'] },
        confirm: '$t:admin.connections.action.disconnectConfirm',
        action: {
          type: 'fetch',
          method: 'POST',
          url: '/api/admin/connections/$record.id/disconnect',
        },
      },
    ],
  },
] as const

export default withShell(
  {
    id: 'dashboard-data-connections',
    name: 'dashboard-data-connections',
    path: '/connections',
    meta: { title: '$t:admin.meta.connections', lang: 'en-US' },
    components: [
      pageHeading('$t:admin.connections.heading', '$t:admin.connections.blurb'),
      dataTable({
        props: { id: 'admin-connections-grid', 'aria-label': '$t:admin.connections.region' },
        dataSource: {
          system: { endpoint: '/api/admin/connections', rowsKey: 'connections', idKey: 'id' },
        },
        columns: CONNECTIONS_COLUMNS,
        search: { enabled: true, placeholder: '$t:admin.connections.search' },
        noMatchMessage: '$t:admin.connections.noMatch',
        emptyMessage: '$t:admin.connections.empty',
      }),
    ],
  } as PageConfig,
  { breadcrumb: { connections: '$t:admin.crumb.connections' } }
) satisfies PageConfig
