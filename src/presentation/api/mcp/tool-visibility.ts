/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Which compiled MCP tools a caller is OFFERED over `tools/list`.
 *
 * Offering is not the enforcement — every admin-only family re-checks the
 * caller when it is called by name — but it is what keeps a credential from
 * being told a tool exists that it may not use.
 */

import { adminReadToolNames } from '@/application/use-cases/admin/admin-read-registry'
import { isConfigToolName } from '@/application/use-cases/config/config-mcp-tools'
import { isAdminTierCaller, type McpCaller } from '@/presentation/api/mcp/auth'
import { automationToolIsOffered } from '@/presentation/api/mcp/automation-call'
import { toolFailure } from '@/presentation/api/mcp/tool-call-helpers'
import type { App } from '@/domain/models/app'
import type { CompiledTool } from '@/presentation/api/mcp/tool-compiler'

/**
 * Filter the compiled tool catalog to what the caller's role is allowed to
 * see. Viewers never see mutating tools (`_create / _update / _delete` on
 * tables and any action template — action templates are always considered
 * mutating because they execute side-effecting workflows). Members and
 * admins see the full catalog of user-defined tools; finer per-field RBAC
 * for member is the subject of M-6, not this discovery spec.
 *
 * Internal tools (`_auth_*`, `_system_*` infixes) are admin-only — both
 * member and viewer roles never see them, regardless of operation type.
 * The `MCP_EXPOSE_INTERNALS=false` switch upstream removes the tools
 * entirely; this filter is the per-role gate for the remaining surface.
 *
 * Manual automations are offered by the run's own role decision rather than by
 * tier ({@link automationToolIsOffered}): a role sees exactly the automations
 * `tools/call` would run for it — a viewer the ones naming `viewer`, a member
 * none it would be refused.
 *
 * The app is threaded through for the config family (decided by an EXACT name
 * rather than an infix) and for the automation decision, which reads the
 * automation's trigger and the app's connections.
 */
export const filterToolsForRole = (
  tools: ReadonlyArray<CompiledTool>,
  caller: Readonly<McpCaller>,
  app: App,
  pausedNames: ReadonlySet<string>
): ReadonlyArray<CompiledTool> => {
  const { role } = caller
  const offered = tools.filter(
    (tool) =>
      (isAdminTierCaller(caller) || !isInternalTool(tool.name, app.name)) &&
      automationToolIsOffered(app, tool.name, caller, pausedNames)
  )
  if (role !== 'viewer') return offered
  return offered.filter((tool) => !isMutatingTool(tool.name))
}

/**
 * Refuse an admin-only tool called by an admin-tier credential the admin plane
 * holds for a passkey ({@link McpCaller.heldForPasskey}), naming the tool and
 * the requirement — the refusal every admin-only family shares, so the four
 * cannot drift apart. It runs BEFORE the `MCP_EXPOSE_INTERNALS` switch and
 * before any read: a held credential never learns how the switch is set, and
 * no admin audit event is written. Every other caller and tool passes through.
 */
export const refuseHeldAdminTool = (
  caller: Readonly<Pick<McpCaller, 'heldForPasskey'>>,
  appName: string,
  toolName: string
): void => {
  if (caller.heldForPasskey !== true || !isInternalTool(toolName, appName)) return
  toolFailure(
    -32_603,
    `Tool ${toolName} requires an administrator passkey: this app requires administrators ` +
      'to sign in with a passkey, and an API key never satisfies it. Authorise this client ' +
      'through OAuth from a session you opened with a passkey.'
  )
}

const isInternalTool = (toolName: string, appName: string): boolean => {
  // Tool naming convention: `{appName}_auth_{table}_{op}` and
  // `{appName}_system_{table}_{op}`. The infixes are unambiguous because
  // user-defined tables cannot be named `auth_*` or `system_*` — the
  // cross-validator rejects those at decode time.
  //
  // The config family ([internal ref] A8 surface 9) is gated HERE rather than in
  // `isMutatingTool`: `{app}_config_read` ends in `_read`, so the viewer
  // mutating-tool filter never catches it, and without this a member-role
  // caller would see the whole configuration surface.
  //
  // It is matched by EXACT NAME rather than by a `_config_` infix, because the
  // two namespaces above are not comparable to this one. `auth_*` and
  // `system_*` are refused as table-name PREFIXES, so no user-defined table can
  // ever produce those infixes. Only the exact name `config` is refused here,
  // so a table legitimately called `config_backup` compiles to
  // `{app}_config_backup_list` — which carries the infix while being an
  // ordinary data tool. An infix match hid that operator's own table from every
  // non-admin role, with nothing said and the call still succeeding by name.
  return (
    toolName.includes('_auth_') ||
    toolName.includes('_system_') ||
    isConfigToolName(appName, toolName) ||
    adminReadToolNames(appName).has(toolName)
  )
}

const isMutatingTool = (toolName: string): boolean => {
  if (toolName.endsWith('_create')) return true
  if (toolName.endsWith('_update')) return true
  if (toolName.endsWith('_delete')) return true
  // Action templates are never read-only by definition (they execute a
  // workflow); withhold from viewer until per-template annotations are
  // honored in M-6.
  if (toolName.includes('_action_')) return true
  return false
}
