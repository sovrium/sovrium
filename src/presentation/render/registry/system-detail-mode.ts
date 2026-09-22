/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * CAP-2 "system DETAIL self-binding" predicates.
 *
 * A `record-field` or a record-bound `drawer` whose OWN `dataSource` carries a `system`
 * binding (`SystemDetailSourceSchema`) self-binds to a single-record system DETAIL
 * endpoint and must be fetched CLIENT-side rather than resolved server-side. Both
 * predicates share that one condition (`dataSource.system !== undefined`) and only
 * differ by the component type they gate on — so the condition lives once in
 * `hasOwnSystemDetailSource` and each predicate keeps its own type guard.
 *
 * The type guard is load-bearing: `selfNeedsIslands` (render-page) and `DynamicPage`'s
 * island detection deliberately fire for a `record-field` but NOT a record-bound `drawer`
 * (the drawer is an overlay component hydrated via a separate path), so collapsing
 * to a single type-agnostic predicate would be a behavior change.
 *
 * The CAP-1 `isListIslandMode` predicate is NOT part of this family — it checks
 * `mode`/`listDisplay.itemTemplate` and fires for DB-table bindings too — so it
 * stays in its own module (`list-island-mode.ts`).
 */

import type { Component } from '@/domain/models/app/pages/components'

/**
 * True when a component's OWN `dataSource` carries a `system` DETAIL binding
 * (`SystemDetailSourceSchema`) — the shared condition both self-binding predicates
 * below build on. A component WITHOUT a `dataSource`, or one whose `dataSource` is a
 * DB-table binding, returns false (backward compatible).
 */
function hasOwnSystemDetailSource(component: Component): boolean {
  const dataSource = component.dataSource as { readonly system?: unknown } | undefined
  return dataSource?.system !== undefined
}

/**
 * True when a `record-field` SELF-binds to a system DETAIL endpoint (CAP-2) and
 * must therefore hydrate the `record-field-system` island CLIENT-side rather than
 * resolve its value server-side.
 *
 * Trigger: a `record-field` whose OWN `dataSource` carries a `system` binding
 * (`SystemDetailSourceSchema`). A record-field WITHOUT a `dataSource` (the
 * original inherit-from-container path) and the DB-table self-binding variant
 * (`{ table, mode: single, param }`) are server-resolved — they are NOT island
 * mode, so this returns false for them (backward compatible).
 *
 * Shared by THREE call-sites that must agree (otherwise the island bundle is
 * built without a script tag, or vice-versa) — mirrors `isListIslandMode`:
 *  - the data-source resolver (stamps the `_recordFieldSystem*` island props and
 *    skips server-side resolution / app.tables cross-validation for the binding);
 *  - the page renderer's `selfNeedsIslands` (BUILD the island bundle);
 *  - `DynamicPage`'s island detection (INJECT the hydration `<script>`).
 */
export function isRecordFieldSystemMode(component: Component): boolean {
  return component.type === 'record-field' && hasOwnSystemDetailSource(component)
}

/**
 * True when a `drawer` binds to a system DETAIL endpoint (CAP-2) and must
 * therefore be left to the CLIENT island rather than server-resolved.
 *
 * Trigger: a `drawer` whose `dataSource` carries a `system` binding
 * (`SystemDetailSourceSchema`). The DB-table drawer variant
 * (`{ table }` — fetch / PATCH `/api/tables/:t/records/:id`) is left untouched and
 * returns false here (backward compatible).
 *
 * A system-detail drawer opens from a system-source `table` row click: its
 * record id arrives on the dispatched `sovrium:open-drawer` event (the row's
 * normalized `id`), NOT a route param — so there is no server-side prop to stamp.
 * The data-source resolver short-circuits this binding to:
 *  - SKIP server-side records resolution (there is no records table to read), and
 *  - SKIP app.tables cross-validation (the drawer's `recordFields` describe the
 *    endpoint envelope, not a declared table — the SYSTEM-004 contract).
 * The record-bound drawer's SSR renderer reads `dataSource.system` and the island then
 * fetches the detail endpoint on row-click.
 */
export function isRecordDrawerSystemMode(component: Component): boolean {
  return component.type === 'drawer' && hasOwnSystemDetailSource(component)
}
