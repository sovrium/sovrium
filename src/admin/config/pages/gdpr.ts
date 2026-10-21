/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// My data (GDPR) — the DATA half of the operator's own account: what this
// instance holds about you, and how to take it out or erase it. The IDENTITY
// half (name / email / password / picture / language) is `profile.ts`.
//
// ─── IT IS THE SAME LIST AS `/profile`, AND THAT IS THE POINT ──────────────
//
// Four rows on the shared `settings-row` grid, under the same identity header.
// The two pages are one cluster split across two routes; a reader crossing
// between them should not have to re-learn where a control lives. What this
// replaces stacked a bordered section per control, and a second tinted one
// inside the page column for erasure.
//
// The tint went with them, deliberately. Erasure is the one irreversible thing
// here, and it says so on the CONTROL — a destructive button, then a
// type-to-confirm dialog — rather than by tinting a container. Colour is
// reserved for consequence ([internal ref] D3), and a filled panel spends it on a
// region that is mostly prose.
//
// ─── EVERY CONTROL IS GENERIC CONFIG; THE BESPOKE ISLAND IS GONE ───────────
//
//   EXPORT  → a `mode: download` button over `GET /api/account/export`, saving
//             `my-account.json` natively, with a persistent `onSuccess.status`.
//   ERASE   → a destructive button whose object `confirm` is a type-to-confirm
//             `alertdialog`: the affordance stays disabled until the operator
//             retypes their OWN email (`matchValue: '$session.email'`, resolved
//             client-side). On confirm it POSTs `{ confirm: true }`.
//   PENDING → a system-source `table` over `GET /api/account/pending-erasure`
//             with a per-row cancel that `refetch`es the grid back to empty.
//
// ─── WHY ERASE HAS NO `refetch` AND CANCEL DOES ────────────────────────────
//
// Scheduling an erasure REVOKES the session by design, so a refetch after it
// would be an unauthenticated read — the status line is the whole feedback, and
// that is deliberate rather than an omission. Cancelling revokes nothing, so its
// refetch-to-empty is valid and is what clears the row.
//
// ─── THE TWO CONFIRM DIALOGS CARRY DIFFERENT NAMES ON PURPOSE ──────────────
//
// The pending row's trigger is "Cancel"; its confirm dialog is titled "Confirm
// cancellation" and its affirm button repeats that title rather than saying
// "Cancel" — two buttons reading "Cancel" one dialog apart, meaning opposite
// things, is the ambiguity the longer label buys out of.

import dashboardGdpr from './dashboard-gdpr.page.json'
import type { Page as PageConfig } from '@/domain/models/app'

export default dashboardGdpr as PageConfig
