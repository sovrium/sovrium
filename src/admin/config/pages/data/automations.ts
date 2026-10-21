/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// Automations — the catalog of what the operator declared, and the history of
// what it did.
//
// ─── TWO SELECT MODES THIS SURFACE NEEDS ───────────────────────────────────
//
// `select.native`: the specs drive each filter as a browser `<select>`
// (`selectOption(…)`, `toHaveValue('')`), so the server-rendered element is
// left enabled rather than replaced by a Base UI listbox.
//
// `select.emptyOption`: the options come from `dataSource.system` (a preset page
// cannot read the OPERATOR's `app.automations`), which replaces `options`
// outright, so the "All" row that submits nothing is folded into the resolved
// list. Without it a native select picks its FIRST option and the surface opens
// pre-filtered, contradicting the unfiltered count printed beside it.
//
// ─── THE FILTER BAR IS PUBLISHERS, NOT AN ISLAND ───────────────────────────
//
// `select.publishes` declares the dispatch a bespoke island once made: each
// control names the channel and the request-param key it contributes, the
// grid's `bindTo` + `sharedFilter` names the same channel, and the vanilla
// runtime binds the `change` listener. No hydration at all. The native control
// takes its accessible name from the visible caption it wraps, so the caption
// IS the name the specs address — "Filter by automation", "… trigger", "… status".
// Drawn as toolbar facets (`toolbar-facet.ts`), the caption is screen-reader only.

import { runPage } from './automation-run'
import dashboardDataAutomations from './dashboard-data-automations.page.json'
import type { Page as PageConfig } from '@/domain/models/app'

export const automationPages: readonly PageConfig[] = [
  dashboardDataAutomations as PageConfig,
  runPage as PageConfig,
]
