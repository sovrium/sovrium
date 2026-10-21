/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// Templates — the template assets the app ships, each previewed with its
// sample data. Read-only, like every surface here: a template
// changes in the config, never in the console.
//
// TWO pages:
//
//   `/templates`         every template asset, in declaration order.
//   `/templates/:path*`  one of them rendered with its `sampleData`.
//
// `:path*` and not `:path`: an asset path has slashes in it
// (`templates/invoice.html`), and a named wildcard is the one route segment
// that captures them. The directory is listed FIRST because route matching
// takes the first pattern that matches — `/templates` does not match
// `:path*` (the wildcard is non-empty), but every other multi-page surface
// keeps the literal first and this one is not the place to re-derive why.
//
// ─── THE PREVIEW IS A RENDER IN A FRAME THAT GRANTS NOTHING ────────────────
//
// The detail page binds its record to `GET /api/admin/templates/preview`,
// resolved on the render path with the caller's session, so the rendered
// markup is in the first response and a path naming no template is the page's
// own 404. The markup goes into an `iframe` as `srcdoc`, with `sandbox` EMPTY:
// no scripts, no same-origin, no forms, no navigation of the console. A
// template is the app author's markup filled with data, and the console must
// never run either.
//
// `sandbox` does not stop a frame loading pictures, and a frame written with
// `srcdoc` inherits the console's policy, which says nothing about images. So
// the frame opens with its own policy, `default-src 'none'`, before the
// template's first byte: an `<img src="https://…">` in a template is refused
// by the browser rather than fetched — no tracking pixel ever learns that an
// operator opened the preview. `data:` pictures (an inlined logo) and inline
// styles are what a filled template legitimately carries, and stay allowed.
//
// ─── THE PAPER IS WHITE ON PURPOSE ─────────────────────────────────────────
//
// The frame's ground is white in both schemes. It is not a colour choice of
// the console's: it is the ground the template will be read on — a PDF page,
// a mail client, a printed label — and a template drawn on the console's dark
// ground would preview black text on near-black, which is a preview of
// nothing. Everything around the frame follows the scheme.
//
// ─── THREE STATES, EACH A GATE ON ONE FIELD OF THE PREVIEW ─────────────────
//
//   `rendersAs: none`        Word, Excel, PowerPoint — they render to a FILE,
//                            so the page names the `sovrium render` command
//                            instead of drawing a frame.
//   `usedSampleData: false`  the asset declares no `sampleData`: the preview
//                            is drawn with empty values, and the page says so
//                            and says how to fix it.
//   `rendersAs: email`       the HTML exactly as `email/send` delivers it, and
//                            the page says that too — inlined styles look like
//                            a rendering quirk unless someone tells you why.
//
// `visibility.record` takes ONE field, so a gate needing two (an Office kind
// AND its extension) is two nested nodes, the outer on `rendersAs`.

import dashboardDataTemplatePreview from './dashboard-data-template-preview.page.json'
import dashboardDataTemplates from './dashboard-data-templates.page.json'
import type { Page as PageConfig } from '@/domain/models/app'

export default [
  dashboardDataTemplates as PageConfig,
  dashboardDataTemplatePreview as PageConfig,
] satisfies readonly PageConfig[]
