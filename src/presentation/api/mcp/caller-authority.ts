/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The permission identity of an MCP caller, resolved ONCE per `tools/call`.
 *
 * `McpCaller.role` is the three-tier MCP view (`admin | member | viewer`) that
 * decides which tools are LISTED. It is the wrong input for anything a table
 * declares: a custom `editor` collapses to `member`, so a table granting
 * `editor` refused its own editors, and a custom role ranked BELOW `member`
 * was promoted to it and passed checks that name `member`. Every permission
 * evaluation on the `tools/call` path therefore reads this value instead —
 * the account role exactly as the records API resolves it, plus the caller's
 * group memberships — and hands it to the SAME evaluators the records API
 * calls, never a re-implementation of them.
 */

import {
  buildEffectiveRoles,
  tableEffectiveRoles,
} from '@/application/use-cases/tables/user-groups'
import { extractGroupNames } from '@/domain/models/app/auth/groups/group-reference'
import {
  hasCreatePermissionForRoles,
  hasDeletePermissionForRoles,
  hasReadPermissionForRoles,
  hasUpdatePermissionForRoles,
} from '@/domain/models/app/auth/permission-evaluator-service'
import { validateFieldWritePermissions } from '@/presentation/api/runtime/field-permission-validator'
import type { McpCaller } from './auth'
import type { App, Table } from '@/domain/models/app'
import type { AiAccessOperation } from '@/domain/models/app/auth/ai-access'
import type { TableGateScope } from '@/domain/models/app/auth/permission-evaluator-service'

export interface CallerAuthority {
  /** The account role the records API would see for this user. */
  readonly role: string
  /** `role` plus one `group:<name>` entry per membership (`buildEffectiveRoles`). */
  readonly effectiveRoles: readonly string[]
  /** The group memberships themselves (un-prefixed), empty when none could matter. */
  readonly groups: readonly string[]
  /**
   * Every `user_access` role the caller holds — counted, as on the records
   * route, only on a table with row-level rules.
   */
  readonly accessRoles: readonly string[]
}

/** Table-level operations whose grants may name a group. */
const GROUP_BEARING_OPERATIONS = ['read', 'create', 'update', 'delete'] as const

/** The table's own grants, those of its `override` block, and its field read grants. */
const grantsOf = (table: Table): readonly unknown[] => {
  const permissions = table.permissions as Readonly<Record<string, unknown>> | undefined
  if (permissions === undefined) return []
  const override = permissions['override'] as Readonly<Record<string, unknown>> | undefined
  const fieldGrants = (
    (permissions['fields'] as readonly Readonly<Record<string, unknown>>[] | undefined) ?? []
  ).map((entry) => entry['read'])
  return [
    ...GROUP_BEARING_OPERATIONS.flatMap((operation) => [
      permissions[operation],
      override?.[operation],
    ]),
    // A field read grant may name a group too, and the records the tools hand
    // back are filtered by it.
    ...fieldGrants,
  ]
}

/**
 * True when some table-level or field read grant anywhere in the app names a group. Scanning
 * every table rather than the called one keeps an `inherit`ed grant covered
 * without re-resolving the inheritance chain. When nothing names a group, the
 * memberships cannot change any answer and the lookup is skipped.
 */
export const appGrantsReferenceGroups = (app: Readonly<App>): boolean =>
  (app.tables ?? []).some((table) =>
    grantsOf(table).some((grant) => extractGroupNames(grant).length > 0)
  )

/**
 * Resolve the caller's permission identity. `lookupGroups` runs at most once,
 * and only when the caller is a real user AND some grant could name a group;
 * `lookupAccessRoles` at most once, and only for a real user. Both are read
 * for THIS call, never cached, so a withdrawn membership or assignment counts
 * no more on the next one.
 */
export const resolveCallerAuthority = async (input: {
  readonly app: Readonly<App>
  readonly caller: McpCaller
  readonly lookupGroups: (userId: string) => Promise<readonly string[]>
  readonly lookupAccessRoles?: (userId: string) => Promise<readonly string[]>
}): Promise<CallerAuthority> => {
  const { app, caller, lookupGroups, lookupAccessRoles } = input
  const role = caller.accountRole ?? caller.role
  const groups =
    caller.userId !== undefined && appGrantsReferenceGroups(app)
      ? await lookupGroups(caller.userId)
      : []
  const accessRoles =
    caller.userId !== undefined && lookupAccessRoles !== undefined
      ? await lookupAccessRoles(caller.userId)
      : []
  return { role, effectiveRoles: buildEffectiveRoles(role, groups), groups, accessRoles }
}

const TABLE_PERMISSION_CHECKS: Readonly<
  Record<
    AiAccessOperation,
    (table: Table, effectiveRoles: readonly string[], scope: TableGateScope) => boolean
  >
> = {
  read: hasReadPermissionForRoles,
  list: hasReadPermissionForRoles,
  create: hasCreatePermissionForRoles,
  update: hasUpdatePermissionForRoles,
  delete: hasDeletePermissionForRoles,
}

/**
 * The table's own `permissions` for the operation a tool performs — read and
 * list against `permissions.read`, the three writes against their own grant —
 * evaluated by the records API's evaluator over the records API's own
 * effective roles (`tableEffectiveRoles`: assignment roles count on a table
 * with row-level rules). `aiAccess.operations` decides which tools EXIST; this
 * decides who may call them.
 */
export const passesTablePermission = (
  app: Readonly<App>,
  table: Table,
  operation: AiAccessOperation,
  authority: CallerAuthority
): boolean => TABLE_PERMISSION_CHECKS[operation](table, tableEffectiveRoles(table, authority), app)

/**
 * The first field in `fields` the caller may not write, through the same
 * `validateFieldWritePermissions` the records API's create and update paths
 * call — admin-equivalent bypass included, and a field the caller may not read
 * refused unless its `write` grant names her — or `undefined` when all are
 * writable.
 */
export const findFirstFieldWriteViolation = (
  app: App,
  table: Table,
  authority: CallerAuthority,
  fields: Readonly<Record<string, unknown>>
): string | undefined =>
  validateFieldWritePermissions(
    app,
    table.name,
    { role: authority.role, groups: authority.groups },
    fields
  )[0]
