/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// The design-system console, as config.
//
// ONE area module rather than a page-by-page list in `app.ts`, for the reason
// the Data area module gives: several pages land at different times, and a per-page
// import list makes every landing a diff on `app.ts`.
//
// ─── EVERY PAGE HERE IS SERVED; THERE IS NOTHING LEFT TO FLIP ──────────────
//
// This note used to describe a page as inert until its slug was added to
// `PRESET_SERVED_CONSOLE_PAGES` — the flip list that let a builder keep claiming
// a path while its replacement was authored beside it. That list is gone, with
// the builders and the whole of `dashboard-surfaces/`: the design-system console
// is entirely config, and a page added to the list below is served the moment
// it lands. Nothing intercepts these paths any more.
//
// One thing to know before reading a page here as broken. In the STANDALONE
// preview these surfaces need a SESSION, because the data behind them comes from
// `/api/admin/*`. `bun run app:admin` boots `../../../preview.ts` — `app.ts` plus
// an `auth:` block — precisely so there is something to sign into; sign in at
// `/login` with the `AUTH_ADMIN_*` credentials from `.env.example`. Booting
// `app.ts` directly instead gives pages that render 200 and read 404 underneath.

import brand from './brand'
import componentsIndex, { componentDetail } from './components'
import foundations from './foundations'
import overview from './overview'
import typePage from './type-page'
import uiKit from './ui-kit'
import voice from './voice'

/**
 * Every design-system page the preset carries, in reading order.
 *
 * SEVEN pages. `/design-system/agents` is retired: the share link, the
 * two export documents and the CLI block are the `Share and export` section at
 * the foot of the Overview, because a hand-over is what a reader does after
 * reading what they have. The route is gone rather than redirected — a page
 * nothing links to is not a page nobody opens, it is an unaudited one.
 *

 * `typePage` is last because it is not a console page at all: it is the
 * per-TYPE family — one route per catalogued type, all served by one
 * declaration whose `:type` segment is vouched for by `page.params`. It rides
 * in this module for the module's own reason, that a per-page import list makes
 * every landing a diff on `app.ts`.
 */
export const designSystemPages = [
  overview,
  foundations,
  uiKit,
  brand,
  voice,
  componentsIndex,
  componentDetail,
  typePage,
]
