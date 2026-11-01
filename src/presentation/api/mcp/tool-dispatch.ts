/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The tools/call dispatch of the MCP endpoint: parse the call, then route it
 * to the config tools, the admin reads, the internal tools or the compiled
 * table tools, under the caller it was authenticated as.
 */

import { resolveAdminReadOperation } from '@/application/use-cases/admin/admin-read-registry'
import { isConfigToolName } from '@/application/use-cases/config/config-mcp-tools'
import { resolveAnalyticsProfile } from '@/domain/models/app/analytics/analytics-profile-service'
import { handleAdminReadToolCall } from '@/presentation/api/mcp/admin-reads'
import {
  auditedToolsCallDispatch,
  handleAuditListCall,
  isInternalAuditListTool,
} from '@/presentation/api/mcp/audit'
import {
  handleHttpConfigToolCall,
  type HttpConfigToolsDeps,
} from '@/presentation/api/mcp/config-tools'
import { handleInternalToolCall, resolveInternalTool } from '@/presentation/api/mcp/internals'
import { handleToolsCall } from '@/presentation/api/mcp/tool-call'
import { refuseHeldAdminTool } from '@/presentation/api/mcp/tool-visibility'
import type { AdminReadHostFactory } from '@/application/ports/services/admin-read-host'
import type { App } from '@/domain/models/app'
import type { DomainContext } from '@/infrastructure/logging/request-effect'
import type { McpCaller } from '@/presentation/api/mcp/auth'
import type { McpToolResult } from '@/presentation/api/mcp/tool-call-helpers'
import type { CompiledTool } from '@/presentation/api/mcp/tool-compiler'

// ---------------------------------------------------------------------------
// Request handling pipeline
// ---------------------------------------------------------------------------

/**
 * The SDK's `Implementation` argument — deliberately NOT the `McpServerInfo`
 * of `@/domain/models/api/admin/mcp/tool-definition`.
 *
 * The two names describe different objects. This one is the FIRST argument to
 * `new Server(...)`, which takes identity only; capabilities travel in the
 * second argument (`{ capabilities: { tools: { listChanged: false } } }`
 * below). The domain schema describes the `initialize` handshake RESULT, where
 * identity and `capabilities` are one object. Substituting it here is a type
 * error — `Property 'capabilities' is missing` — because the value at this
 * position genuinely does not carry them.
 */
interface McpServerInfo {
  readonly name: string
  readonly version: string
}

export interface McpDispatchContext {
  readonly tools: ReadonlyArray<CompiledTool>
  readonly serverInfo: McpServerInfo
  readonly app: App
  readonly auditEnabled: boolean
  /**
   * `MCP_EXPOSE_INTERNALS` — re-checked at call time by every family it gates:
   * the internal tools, the audit-list tool and the admin read tools.
   */
  readonly exposeInternals: boolean
  /**
   * The server's resolved domain services, captured at MOUNT time.
   *
   * An MCP tool call runs inside the SDK's own handler, so there is no Hono
   * context underneath it to read the per-request services off. The mount has
   * one, and the services are constant for the life of the server, so carrying
   * them here is the same value every request would have been handed.
   */
  readonly domainContext: DomainContext
  /** Builds the host an admin read tool answers against. */
  readonly makeAdminReadHost: AdminReadHostFactory
  /** What the four A8 config tools read, bound to the booted instance. */
  readonly configToolsDeps: HttpConfigToolsDeps
}

/**
 * Dispatch a `tools/call` invocation through the layered tool resolvers in the
 * order each tool family must claim its own names:
 *
 *   1. Audit-list tool (`{appName}_system_ai_tool_calls_list`) — special-cased
 *      FIRST so its explicit 12-column projection claims the name before the
 *      generic dispatcher can. Tier 2 answers `SELECT *`, and `ai_tool_calls`
 *      declares `denylistFields: []`, so letting it claim this tool would put
 *      `session_id` and `request_id` on the wire. The ordering is a
 *      DATA-EXPOSURE constraint, pinned by an AI MCP audit spec.
 *
 *      It is NOT an anti-recursion gate: whichever tier claimed the name, the
 *      audit-list tool is kept out of the ledger, so "no new row after an
 *      audit-read" cannot motivate the ordering. Reading the constraint as
 *      bookkeeping makes it look droppable; dropping it leaks two columns.
 *   2. The admin read tools (`{appName}_admin_*`, by EXACT name) — the admin
 *      API's reads, which also write the admin audit event their route writes.
 *   3. M-14 registry-driven internals dispatcher — every other
 *      `{appName}_{auth|system}_{table}_{list|read}` tool flows through the
 *      generic SELECT-and-strip handler.
 *   4. User-defined tools.
 *
 * Tiers 2–4 are wrapped in `auditedToolsCallDispatch`, so every call to them —
 * failures included — lands in `system.ai_tool_calls`; for tiers 2–3 the row
 * keeps the call's shape and answer size, never its values or answer. Only the
 * audit-list tool stays out, so reading the trail does not grow it.
 */
interface DispatchToolsCallInput {
  readonly params: unknown
  readonly dispatch: McpDispatchContext
  readonly caller: McpCaller
}

export const dispatchToolsCall = (input: DispatchToolsCallInput): Promise<McpToolResult> => {
  const { params, dispatch, caller } = input
  const parsed = parseToolsCallParams(params)
  // The passkey hold is answered first, so a held admin never learns the switch.
  // Config next: a table named `config` is refused at mount time
  // (`assertNoConfigToolCollision`); reading it touches no database or audit row.
  refuseHeldAdminTool(caller, dispatch.app.name, parsed.toolName)
  if (isConfigToolName(dispatch.app.name, parsed.toolName)) {
    return handleHttpConfigToolCall({
      caller,
      toolName: parsed.toolName,
      args: parsed.args,
      deps: dispatch.configToolsDeps,
    })
  }
  // What every switch-gated family re-checks at call time: who is calling, and
  // whether `MCP_EXPOSE_INTERNALS` is on.
  const gated = {
    caller,
    args: parsed.args,
    exposeInternals: dispatch.exposeInternals,
    domainContext: dispatch.domainContext,
    analyticsProfile: resolveAnalyticsProfile(dispatch.app.analytics),
    app: dispatch.app,
  }
  if (isInternalAuditListTool(parsed.toolName, dispatch.app.name)) {
    return handleAuditListCall(gated)
  }
  const adminRead = resolveAdminReadOperation(dispatch.app.name, parsed.toolName)
  const internalResolved = resolveInternalTool(dispatch.app.name, parsed.toolName)
  const audited = (run: () => Promise<McpToolResult>): Promise<McpToolResult> =>
    auditedToolsCallDispatch({
      auditEnabled: dispatch.auditEnabled,
      domainContext: dispatch.domainContext,
      caller,
      toolName: parsed.toolName,
      args: parsed.args,
      withholdAnswer: adminRead !== undefined || internalResolved !== undefined,
      dispatch: run,
    })
  if (adminRead !== undefined) {
    return audited(async () =>
      handleAdminReadToolCall({
        ...gated,
        operation: adminRead,
        makeAdminReadHost: dispatch.makeAdminReadHost,
      })
    )
  }
  if (internalResolved !== undefined) {
    return audited(async () => handleInternalToolCall({ ...gated, resolved: internalResolved }))
  }
  return audited(async () => handleToolsCall(dispatch.app, caller, parsed, dispatch.domainContext))
}

/**
 * Extract the canonical `tools/call` payload from the JSON-RPC params slot.
 * MCP wire format: `{ name: 'crm_contacts_list', arguments: { ... } }`. We
 * tolerate missing `arguments` (treats it as an empty object) so trivial
 * read tools without parameters don't require an empty `{}` payload.
 */
const parseToolsCallParams = (
  params: unknown
): { readonly toolName: string; readonly args: Record<string, unknown> } => {
  if (typeof params !== 'object' || params === null || Array.isArray(params)) {
    return { toolName: '', args: {} }
  }
  const p = params as { readonly name?: unknown; readonly arguments?: unknown }
  const toolName = typeof p.name === 'string' ? p.name : ''
  const args =
    typeof p.arguments === 'object' && p.arguments !== null && !Array.isArray(p.arguments)
      ? (p.arguments as Record<string, unknown>)
      : {}
  return { toolName, args }
}
