/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The rules every agent tool call is judged by, on every surface ([internal ref] D2).
 *
 * Pure decisions only: whether the agent's allowlist and role permit a call,
 * whether its approval rule holds the call for a human, and what its declared
 * limits resolve to. The counters those limits are checked against are process
 * state and live behind the `AgentGuard` port.
 */

import {
  hasCreatePermissionForRoles,
  hasDeletePermissionForRoles,
  hasReadPermissionForRoles,
  hasUpdatePermissionForRoles,
} from '@/domain/models/app/auth/permission-evaluator-service'
import { checkPermissionWithAdminOverride } from '@/domain/models/app/auth/permissions'
import { isAdminEquivalent } from '@/domain/models/app/auth/roles/role'
import type { App } from '@/domain/models/app'
import type { Agent } from '@/domain/models/app/agents/agent'

/**
 * Does the agent's approval rule hold this action for a human?
 *
 * `mode: 'all'` holds every action, `mode: 'selective'` the actions it lists,
 * `mode: 'none'` (the default) none. The rule is per TOOL CALL: the action is
 * the call's name (`record.create`), on every surface alike.
 */
export const requiresApproval = (agent: Agent, action: string): boolean => {
  const mode = agent.approval?.mode ?? 'none'
  if (mode === 'all') return true
  if (mode === 'selective') return (agent.approval?.required ?? []).includes(action)
  return false
}

/**
 * The CRUD verb each record action needs on its table.
 *
 * Every record action MUST appear here: an unmapped action has no verb to
 * check, so an omission would skip the table-permission gate rather than
 * fail closed. `record.list` reads many rows, so it needs `read`.
 */
export const RECORD_ACTION_TO_PERMISSION: Readonly<
  Record<string, 'read' | 'create' | 'update' | 'delete'>
> = {
  'record.read': 'read',
  'record.list': 'read',
  'record.create': 'create',
  'record.update': 'update',
  'record.delete': 'delete',
}

/**
 * Does an explicit table permission deny the role this record action?
 *
 * `false` when the action is not a record action or no rule constrains it.
 * The built-in `admin` and the app's top role outrank any rule.
 */
export const isRoleDeniedTableAction = (
  input: { readonly role: string; readonly table: string; readonly action: string },
  app: App | undefined
): boolean => {
  const permission = RECORD_ACTION_TO_PERMISSION[input.action]
  if (permission === undefined) return false
  const rule = app?.tables?.find((candidate) => candidate.name === input.table)?.permissions?.[
    permission
  ]
  if (rule === undefined) return false
  return !checkPermissionWithAdminOverride(
    isAdminEquivalent(input.role, app ?? {}),
    rule,
    input.role
  )
}

/**
 * The person a chat agent answers, as the gates judge her: her account role,
 * the records route's effective roles on the table the call names, and
 * whether she is signed in at all.
 */
export interface AgentCallerGrant {
  readonly role: string
  readonly effectiveRoles: readonly string[]
  readonly signedOut: boolean
}

/** The records API's own table gate for one record verb, over `roles`. */
const recordsApiAdmits = (
  table: NonNullable<App['tables']>[number],
  verb: 'read' | 'create' | 'update' | 'delete',
  roles: readonly string[],
  app: App
): boolean => {
  if (verb === 'create') return hasCreatePermissionForRoles(table, roles, app)
  if (!hasReadPermissionForRoles(table, roles, app)) return false
  if (verb === 'read') return true
  return verb === 'update'
    ? hasUpdatePermissionForRoles(table, roles, app)
    : hasDeletePermissionForRoles(table, roles, app)
}

/**
 * Does the person a chat agent answers lack the standing to make this call
 * herself? An agent's reach is a ceiling on her, never a grant: a record action
 * passes only where the records API would let HER perform it on that table, an
 * `auth.*` action only for an admin-equivalent caller (the admin API's own
 * bar), and a visitor signed in to nothing makes no record or `auth.*` action
 * through an agent at all — there is no one to judge her rows for.
 *
 * The row-level rules and field write audiences are judged again at execution,
 * as the caller, by the record actions themselves.
 */
export const isCallerDeniedAgentAction = (
  input: {
    readonly action: string
    readonly table: string | undefined
    readonly caller: AgentCallerGrant
  },
  app: App | undefined
): boolean => {
  const { action, caller } = input
  if (action.startsWith('auth.')) {
    return caller.signedOut || !isAdminEquivalent(caller.role, app ?? {})
  }
  const verb = RECORD_ACTION_TO_PERMISSION[action]
  if (verb === undefined) return false
  if (caller.signedOut) return true
  const table = app?.tables?.find((candidate) => candidate.name === input.table)
  if (app === undefined || table === undefined) return false
  return !recordsApiAdmits(table, verb, caller.effectiveRoles, app)
}

/** Why an agent may not make a call; `undefined` when it may. */
export type AgentToolRefusal = 'action-not-allowed' | 'table-not-allowed' | 'role-denied'

/**
 * The allowlist-and-role double gate for one agent action.
 *
 * Both must allow the call: the action and its table must be in the agent's
 * `tools` allowlist (an agent with no `tools` has no access at all), and the
 * agent's role must hold the table permission the action needs. The allowlist
 * can therefore only ever narrow a role, never widen it.
 */
export const agentToolRefusal = (
  agent: Agent,
  call: { readonly action: string; readonly table: string | undefined },
  app: App | undefined
): AgentToolRefusal | undefined => {
  const { tools } = agent
  if (tools === undefined) return 'action-not-allowed'
  if (!(tools.actions as readonly string[]).includes(call.action)) return 'action-not-allowed'
  if (call.table === undefined) return undefined
  if (!tools.tables.includes(call.table)) return 'table-not-allowed'
  return isRoleDeniedTableAction({ role: agent.role, table: call.table, action: call.action }, app)
    ? 'role-denied'
    : undefined
}

/** System default operational limits applied when a field is omitted. */
export const DEFAULT_AGENT_LIMITS = {
  maxActionsPerMinute: 30,
  maxTokensPerDay: 200_000,
  maxConcurrentTasks: 5,
} as const

/** Fully-resolved limits — every field present after default merging. */
export interface ResolvedAgentLimits {
  readonly maxActionsPerMinute: number
  readonly maxTokensPerDay: number
  readonly maxConcurrentTasks: number
}

/** Merge an agent's declared `limits` with the system defaults. */
export const resolveAgentLimits = (
  declared: Partial<ResolvedAgentLimits> | undefined
): ResolvedAgentLimits => ({
  maxActionsPerMinute: declared?.maxActionsPerMinute ?? DEFAULT_AGENT_LIMITS.maxActionsPerMinute,
  maxTokensPerDay: declared?.maxTokensPerDay ?? DEFAULT_AGENT_LIMITS.maxTokensPerDay,
  maxConcurrentTasks: declared?.maxConcurrentTasks ?? DEFAULT_AGENT_LIMITS.maxConcurrentTasks,
})

/**
 * Actions per minute an agent may take for the role it acts under — the same
 * proportion a person with that role is held to. An unknown role gets the most
 * restrictive ceiling.
 */
export const roleActionCeiling = (role: string): number =>
  ({ admin: 60, member: 30, viewer: 10 })[role] ?? 10
