/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// The operator's OWN reusable templates, each drawn on its own.
//
// A shared header exists in the config exactly once and appears in the product
// only ever embedded inside a page, so reviewing it means finding a page that
// happens to use it and reading around everything else on that page. Here it is
// rendered by the same renderer, under the same theme, and nothing else.
//
// ─── THE ONE THING THIS PAGE CANNOT SUPPLY ITSELF ──────────────────────────
//
// `specimen.subject.component` resolves a name against the RENDERING app's
// `components`, and under a mount that is the console's, which declares none. So
// the mount merges the operator's templates — and their ENGLISH string table
// with them, because a real template takes its text from `$t:` lookups and an
// unresolved lookup prints its own key as body text. Both merges are scoped to
// this surface's two paths in `mount/embedded-app-mount.ts`, which is the one
// place that holds both apps.
//
// ─── TWO PAGES, AND THE SECOND IS WHAT A QUERY COULD NOT BE ────────────────
//
// A page drawing every template at full height puts the fourth below three
// screenfuls of the first three, and a site footer's own specimen is taller than
// the viewport. So a heavy template collapses to one row and offers a way in —
// and the way in is an ADDRESS rather than a toggle, because this console
// navigates rather than holding state a reader cannot bookmark.
//
// That address is a SUB-ROUTE and not `?expand=<name>`. `page.query` clamps a
// value to a declared `enum` by design — it is what keeps attacker-controlled
// text out of every substitution site — and a component NAME is open-valued, so
// there is no enum to write. `page.params` is the mechanism for an open segment
// whose domain is a read endpoint: the same declaration that admits the name
// also refuses one the operator does not declare, with a 404 rather than an
// empty card.

import designSystemComponentDetail from './design-system-component-detail.page.json'
import designSystemComponents from './design-system-components.page.json'
import type { Page as PageConfig } from '@/domain/models/app'

export const componentDetail = designSystemComponentDetail as PageConfig
export default designSystemComponents as PageConfig
