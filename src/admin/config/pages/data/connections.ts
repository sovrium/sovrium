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

import dashboardDataConnections from './dashboard-data-connections.page.json'
import type { Page as PageConfig } from '@/domain/models/app'

export default dashboardDataConnections as PageConfig
