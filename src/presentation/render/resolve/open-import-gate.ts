/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { hasCreatePermissionForRoles } from '@/domain/models/app/auth/permission-evaluator-service'
import { resolveTableImportFields } from '@/presentation/render/props/resolve-type-specific-inputs'
import { writeGateRoles } from './write-permission-gates'
import type { App } from '@/domain/models/app'
import type { SessionInfo } from '@/domain/models/app/auth/session-info'
import type { CallerCapability } from '@/domain/models/app/pages/components/visibility'

/**
 * The render-time gate of an `openImport` button: drawn only for a reader the
 * table lets create records, and stamped with the fields the import dialog maps
 * a CSV onto.
 *
 * An import writes records, so it follows the create gate a grid's add-row
 * follows: ABSENT, never disabled, for a reader who may not create — a disabled
 * control still tells the reader the table exists and what it would accept, and
 * offering a control the records API would refuse is a dead end. A mounted
 * console page renders without a session, so there the caller's stated powers
 * decide: no `edit-operations`, no import.
 */

/** The facts the gate reads about the request. */
export interface OpenImportGateContext {
  readonly session: SessionInfo | undefined
  readonly app: App
  /** The caller's powers on a mount; absent everywhere else. */
  readonly granted?: ReadonlySet<CallerCapability>
}

/** The table an `openImport` action names, or `undefined` when the node holds none. */
export function openImportTable(node: unknown): string | undefined {
  const { action } = (node ?? {}) as { readonly action?: unknown }
  if (typeof action !== 'object' || action === null) return undefined
  const { action: kind, table } = action as { readonly action?: unknown; readonly table?: unknown }
  return kind === 'openImport' && typeof table === 'string' ? table : undefined
}

/** Whether the caller may create in `tableName`, the way the records API will judge it. */
function mayCreate(tableName: string, ctx: OpenImportGateContext): boolean {
  if (ctx.granted !== undefined && !ctx.granted.has('edit-operations')) return false
  if (!ctx.app.auth) return true
  if (ctx.session === undefined) return false
  const table = ctx.app.tables?.find((candidate) => candidate.name === tableName)
  return hasCreatePermissionForRoles(table, writeGateRoles(ctx.session), ctx.app)
}

/** Keep every node but an `openImport` button its reader may not use. */
export function isOpenImportAdmitted(node: unknown, ctx: OpenImportGateContext): boolean {
  const table = openImportTable(node)
  return table === undefined || mayCreate(table, ctx)
}

/**
 * An `openImport` button with the fields of its table stamped under
 * `props._import`, which the button renderer hands to the import island. Any
 * other node is returned untouched.
 */
export function stampOpenImportFields(node: object, app: App): object {
  const tableName = openImportTable(node)
  if (tableName === undefined) return node
  const table = app.tables?.find((candidate) => candidate.name === tableName)
  if (table === undefined) return node
  const { props } = node as { readonly props?: Record<string, unknown> }
  return {
    ...node,
    props: { ...props, _import: resolveTableImportFields(table, app.tables) },
  }
}
