/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { isCapabilityMet } from '@/domain/models/app/pages/page-requires'
import type { App } from '@/domain/models/app'
import type { CapabilityScope } from '@/domain/models/app/pages/page-requires'
import type { PageCapability } from '@/domain/models/app/pages/requires'

/**
 * The table a node is bound to, as the scope a declaration is asked about.
 *
 * It is the node's OWN `dataSource.table`. By the time the caller-capability
 * pass runs, a `$param.table` binding has already resolved to the table the
 * address names, so one page written for every table asks the question of the
 * right one. A node bound to no table — or to a system source — asks about the
 * whole app.
 */
function boundScope(node: unknown): CapabilityScope {
  if (typeof node !== 'object' || node === null) return {}
  const { dataSource } = node as { readonly dataSource?: unknown }
  if (typeof dataSource !== 'object' || dataSource === null) return {}
  const { table } = dataSource as { readonly table?: unknown }
  return typeof table === 'string' ? { table } : {}
}

/**
 * True when the host app's declarations satisfy a node's `declares` /
 * `unlessDeclares` pair, each asked about the table the node is bound to (see
 * {@link boundScope}). A capability with no per-table reading ignores the table.
 */
export function hostDeclarationMet(
  clauses: { readonly declares?: PageCapability; readonly unlessDeclares?: PageCapability },
  hostApp: App,
  node: unknown
): boolean {
  const { declares, unlessDeclares } = clauses
  const scope = boundScope(node)
  if (declares !== undefined && !isCapabilityMet(hostApp, declares, scope)) return false
  if (unlessDeclares !== undefined && isCapabilityMet(hostApp, unlessDeclares, scope)) return false
  return true
}

/** True for an action entry carrying a `declares` clause. */
function declaresAction(entry: unknown): entry is { readonly declares: PageCapability } {
  return (
    typeof entry === 'object' &&
    entry !== null &&
    typeof (entry as { readonly declares?: unknown }).declares === 'string'
  )
}

/**
 * Drop every footer ACTION whose `declares` the host app does not meet, asked
 * about the node's own table, and strip the clause from the ones kept.
 *
 * ─── WHY EXCLUSION, AND WHY THE CLAUSE IS STRIPPED ─────────────────────────
 *
 * A sheet is an island: its actions travel in `data-island-props`, so a button
 * about grants a table cannot have would still ship its target to the browser
 * if it were merely hidden there. Removing it HERE, before the island builder
 * reads the node, keeps it out of the document — the argument the data-table
 * column gate makes. `declares` is a render-time decision and never a client
 * concern, so a kept entry loses it too.
 *
 * @param hostApp - the app the clause is evaluated AGAINST: on a mounted
 *   console, the operator's config rather than the console's own preset.
 * @returns the SAME node when no action carries a clause.
 */
export function gateDeclaredActions(node: object, hostApp: App): object {
  const { actions } = node as { readonly actions?: readonly unknown[] }
  if (!Array.isArray(actions) || !actions.some(declaresAction)) return node
  const scope = boundScope(node)
  const kept = actions.flatMap((entry) => {
    if (!declaresAction(entry)) return [entry]
    const { declares, ...rest } = entry
    return isCapabilityMet(hostApp, declares, scope) ? [rest] : []
  })
  return { ...(node as Record<string, unknown>), actions: kept }
}
