/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// Users — the account directory, and the invitation lifecycle beside it.
//
// TWO pages, because they answer two questions that must not share a table:
//
//   `/users`              every account this app has, with the account
//                         writes an administrator may make on one.
//   `/users/invitations`  who has been invited and has not accepted yet.
//
// ─── WHY INVITATIONS IS A TAB AND NO LONGER A SEPARATE DESTINATION ─────────
//
// It WAS a sibling page, and the argument for that was sound: `invite-user`
// mints the `auth.user` row immediately and only then sends the token, so an
// invited-but-unaccepted person is ALREADY in the directory above. Rendering
// the pending list BESIDE that grid would show the same address twice, in two
// tables, meaning two different things — "this account exists" and "this
// invitation is outstanding" — with no way to tell which row a control
// belonged to.
//
// That argument is against showing them SIMULTANEOUSLY, and a tab strip is
// precisely the arrangement that does not: exactly one of the two tables is in
// the document at a time, each under a caption naming which question it
// answers. What the split cost was the comparison — an operator asking "did
// this person accept?" read the directory, navigated away, lost their filter,
// and read the other list. One route, two tabs, one breadcrumb.
//
// `/users/invitations` REMAINS A ROUTE. It is the same page opened on the other
// tab, so every bookmark and every link into it still lands where it did. It is
// not a redirect: `redirects[]` is inert under the console mount — it decodes,
// ships inside the preset, and both `/_admin/<from>` and `/<from>` answer 404 —
// so a 301 was never available here and a retained page is what replaces it.
//
// ─── WHAT IT TOOK TO WRITE THIS AS CONFIG ──────────────────────────────────
//
// Two things, and both were platform gaps rather than authoring problems.
//
// The row action column and the Invite affordance are painted only for a caller
// who is admin-EQUIVALENT: every endpoint behind them lives on
// `/api/auth/admin/*`, which 404s an admin-TIER-but-not-equivalent operator, so
// painting them for an `admin-viewer` would be three controls their own backend
// refuses. `capability` on the action column and `visibility.capability` on the
// button say that — but both derive the caller's powers from a session, and a
// MOUNTED page renders session-less, so both were inert here and inert in the
// direction that hid the affordance from the administrator it was written for.
// The mount now states the caller's POWERS (`callerCapabilities`) rather than
// handing over the session; see `holdsCapability` in
// `presentation/rendering/visibility-filter.ts` for why that distinction is the
// whole design.
//
// And both role pickers offer `assignableRoleNames(app)` — the built-ins, the
// admin-tier names, and every name the OPERATOR declared. That set is computed
// from the auth config and stored in no table, so a literal list cannot reach
// it: narrowing this picker to the built-ins was measured on a partner-shaped
// app to share ZERO members with the roles that app declares. `optionsSource`
// over `GET /api/admin/roles` is what makes the affordance and the write
// boundary one set, which is the only arrangement under which they cannot
// disagree.
//
// Accounts are OBSERVED and administered here; creating one goes through the
// admin API (Developers → API), which is why there is no create form.

import dashboardDataUsers from './dashboard-data-users.page.json'
import { accountPage } from './users-account'
import type { Page as PageConfig } from '@/domain/models/app'

export default [
  dashboardDataUsers as PageConfig,
  accountPage as PageConfig,
] satisfies readonly PageConfig[]
