/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// API — the auto-generated reference for THIS app's REST API.
//
// ─── WHY IT WAS A BUILDER, AND WHY IT IS NOT ANY MORE ──────────────────────
//
// Every address this page prints is a function of the running app: the base URL
// is the instance's resolved origin, the example lines name the operator's own
// tables, and the API-keys pointer exists only when they opted in. A preset page
// could compute none of that, so the surface was 406 lines of TypeScript.
//
// Two mechanisms closed the gap, and neither is a rendered string crossing the
// wire — an endpoint publishes facts, and the words stay in config:
//
//   - the page-level `{ system }` record resolves `/api/admin/instance`
//     SERVER-side on the caller's own credentials, so `$record.origin` and
//     `$record.exampleTable` are in the first response rather than filled in by
//     an island after the document shipped;
//   - `code.contentFrom` folds that same endpoint's `tables` ROWS into ONE code
//     block — one `GET` line per declared table, in declaration order, joined
//     and highlighted as a single copyable artifact.
//
// The endpoint publishes the origin and the table names. The comment lines, the
// column padding and the quotes are this page's, and they live in the copy
// catalogue so they follow the reader's language: a translation may carry
// `$record.*` references, which are filled after it is translated — the row
// template of the fold included.
//
// ─── THE ONE THING THE FOLD CANNOT DO ──────────────────────────────────────
//
// NEEDS: a trailing-literal slot on `code.contentFrom`. The retired builder put
// the four `GET` lines and one `POST` line in a SINGLE `<pre>`. A fold emits one
// line per row and has no way to append a fixed line derived from the page
// record: `template` is substituted per ROW, and `substituteRecordInComponent`
// deliberately does not walk `contentFrom`, so the two `$record` namespaces
// cannot meet. Declaring `content` beside `contentFrom` is refused at decode by
// design ("two answers to what the block holds").
//
// So the HTTP tab holds TWO code blocks — the folded list calls, and the create
// call — inside one container carrying `data-testid="api-docs-examples"`. Every
// assertion still holds and both blocks stay copyable and highlighted, but the
// operator now copies two artifacts where they copied one. That is a UX delta,
// not a migration, and it belongs to `[internal ref]` to accept or
// replace; the platform fix is a `contentFrom.append` slot, which is
// `[internal ref]`'s surface.

import dashboardApiDocs from './dashboard-api-docs.page.json'
import type { Page as PageConfig } from '@/domain/models/app'

export default dashboardApiDocs as PageConfig
