/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// Organisation — who can reach what, and through which grant.
//
// The one question no other console surface answers. Every other data page is
// about the app's CONTENTS; this one is about its SHAPE.
//
// ─── WHAT SHIPS HERE, AND WHAT DELIBERATELY DOES NOT ───────────────────────
//
// The canvas draws five lenses — Map, Matrix, Reach, Processes, Agents — over
// one access graph, plus a findings list headed "What the map found". TWO of
// them ship: the findings, and the Matrix.
//
// The findings came first, and the order was right rather than a concession:
// the drawings are how an operator finds a structural exposure by looking, and
// the findings list is the same exposure already found and ranked, so an
// operator who reads three sentences has the answer the drawings exist to lead
// them to. The Matrix is what they open next — to see WHY a finding is true,
// and to see the thing no check looks for, which is a resource nobody has been
// granted at all. A list reports what IS exposed; only a grid shows an absence.
//
// The remaining three lenses (Map, Reach, Processes/Agents) need the `graph`
// component type, which the engine does not have. That is a core product
// update and is gated as its own slice.
//
// What is NOT here, named so nobody reads the omission as an oversight:
//
//   - The pulse strip and the nine count tiles. They live on the console's `/`
//     and are bound to `/api/admin/attention` + `/api/admin/overview`. Two
//     pages must not both answer "how big is this instance?".
//   - `nodes` and `edges` as a flat table. That would ship the Reach lens under
//     another name. The Matrix reads both, but crosses them rather than listing
//     them.
//   - `degraded`'s member NAMES. `string[]` is unbindable as rows (a system
//     source reads an array of objects), so the notice below says a source failed and cannot
//     yet say which. Stated in the copy rather than silently omitted.
//
// ─── THE PRESENCE GATES ────────────────────────────────────────────────────
//
// `findings`, `degraded` and `exceptions` are REQUIRED arrays on the graph
// body, so each state on this page is a presence test on one of them:
// `isNotEmpty: true` draws the list, `isEmpty: true` draws the empty state, and
// the two are mutually exclusive by construction. Presence is the engine's one
// empty rule — missing, `null`, `''`, `[]` and `{}` are empty, nothing else is —
// the same rule a table filter compiles, so these gates say what they mean
// rather than riding on how a list happens to stringify.
//
// They used to be `eq: ''` / `neq: ''`, which worked only because
// `String([])` is the empty string. That spelling also calls a MISSING field
// present, which a required array never is here, so the swap changed no
// rendered state.
//
// ─── SEVERITY IS TYPOGRAPHY, WITH ONE COLOUR ───────────────────────────────
//
// Three ranks, rendered as a weight-and-ink gradient rather than as three
// pills. `critical` — a write path reachable without signing in — takes the
// error role, because that is a CONSEQUENCE and consequence is the one thing
// colour is reserved for in this console (`BRAND.md` §3). `warning` and
// `notice` recede into the ordinary foreground ramp. A console that paints
// three severities three colours has spent the channel that makes the first one
// legible at a glance.
//
// The message is the DATA and the severity is its LABEL, so the label is never
// the heavier of the two (`BRAND.md` §4).

import dashboardOrganisation from './dashboard-organisation.page.json'
import type { Page as PageConfig } from '@/domain/models/app'

export default dashboardOrganisation as PageConfig
