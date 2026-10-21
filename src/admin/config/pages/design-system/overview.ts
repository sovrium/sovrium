/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// The section root — and the one page that answers "how much of this system is
// MINE", then hands the whole of it over.
//
// The `h1` is exactly `Design system`, matching the sidebar row a reader
// arrives from. `[internal ref]` and `-008` resolve it by role at
// level 1 with `exact: true` on every one of the six pages, so the heading is
// the section's NAME rather than a framing of it; the "what is yours" framing
// belongs to the deck below it, where it costs nothing to say.
//
// ─── ONE ENDPOINT, READ THREE TIMES, FOR THREE DIFFERENT QUESTIONS ────────
//
// `GET /api/admin/design-system/coverage` publishes one row per layer:
// `{ key, label, declared, count, configPath, state }`, and a tally of the
// three states beside them. The page binds it three times because a reader asks
// three things of it in different registers:
//
//   The SUMMARY   — "what is this system made of": the count beside its own
//                   noun, so `2` and `font families` read as one phrase. The
//                   `label` is the product's only name for a layer, which is
//                   why the page prints it rather than choosing its own.
//   The TALLY     — "what shape is my config in", before a single row is read.
//                   The four counts beside the rows, bound as the PAGE's own
//                   record. A headline typed beside a list is the drift this
//                   console exists to remove, and a rows template cannot count
//                   itself — so the endpoint publishes the counts and the page
//                   reads them, server-side and with no island.
//   The LEDGER    — "which of it did I choose": the same rows, each stating
//                   which of the three states it is in, and each UNDECLARED one
//                   naming the key that would change that.
//
// ─── THE THIRD STATE IS THE POINT ─────────────────────────────────────────
//
// `declared` was a boolean, so it read every key the operator did not write as
// the same thing. It is not. A key the platform SUPPLIES — the colour roles,
// the type steps, the spacing ladder — is answered, working, and needs nothing;
// a key nobody supplies is a gap. Marking both "not declared" tells an author
// they have twelve problems when they have three, which is worse than saying
// nothing, because it is confidently wrong.
//
// So `configPath` is published on EVERY row and the page decides where it is
// worth showing: only on a row nothing supplies. A declared layer has nothing
// to offer, and neither does an inherited one — pointing at documentation for a
// key the reader does not need to write is the same noise in a different place.
//
// [internal ref] keeps this console read-only, so the affordance is NAVIGATION to the
// key rather than a control that writes it.
//
// ─── THE SEVENTH PAGE IS HERE, NOT BESIDE THIS ONE ────────────────────────
//
// `/design-system/agents` is retired. What it carried — the share link, the
// export documents and the CLI block — is the `Share and export` section at the
// foot of this page, because a hand-over is what a reader does AFTER reading
// what they have, and a page of its own put it somewhere nobody arrived at. The
// route is gone rather than redirected: a page nothing links to is not a page
// nobody opens, it is an unaudited one still serving a second copy of the
// affordances to whoever bookmarked it.

import designSystemOverview from './design-system-overview.page.json'
import type { Page as PageConfig } from '@/domain/models/app'

export default designSystemOverview as PageConfig
