/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// The console's root — Welcome, the landing page an operator arrives on.
//
// PATHS ARE MOUNT-RELATIVE. This page is `/`, not `/_admin`: the console is
// served at one fixed base, `/_admin`, and the mount primitive prefixes every
// intra-app path with it at render time. Writing `/_admin` here would double the
// prefix rather than confirm it.
//
// ─── WHAT IT SHOWS, IN THE ORDER A PERSON ARRIVING READS IT ───────────────
//
// A greeting and one sentence; then what needs attention, one row per thing
// with the one action that answers it, the assistant beside it; four headline
// figures, and the runs of the last seven days under them; and what the configuration declares, one row per kind of object
// with the console page that answers it. The `id`, the `name` and the sidebar
// row's `data-nav-overview` testid are unchanged: a testid is an address, and
// the route is still the console's front page.
//
// ─── ONE READ, NO ISLANDS, FOR EVERYTHING THAT VARIES ──────────────────────
//
// `dataSource` at PAGE level binds a RECORD (the same binding one level down is
// a ROWS binding), so every `$record.*` below resolves SERVER-SIDE and ships as
// text: the attention rows' counts AND details, and the breakdowns beside the
// declarations, for one fetch and zero client bytes.
//
// The head counts are the honest exception: `GET /api/admin/attention` carries
// each declaration's breakdown and none of their head COUNTS, which live on
// `/api/admin/config/reflection`, `/api/admin/links`, `/api/admin/overview` and
// `/api/admin/roles`. A page has exactly one record, so the head counts stay
// `kpi` islands — four shared fetches, since the system-value hook keys its
// query on the endpoint.

import dashboardOverview from './dashboard-overview.page.json'
import type { Page as PageConfig } from '@/domain/models/app'

export default dashboardOverview as PageConfig
