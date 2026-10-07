/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * MCP admin read tools — compile, handle, refuse collisions.
 *
 * Each tool is one entry of the admin read-operation registry
 * (`src/application/use-cases/admin/admin-read-registry.ts`), the same entry the
 * mirrored `GET /api/admin/*` route is mounted from. The tool therefore decodes
 * through the SAME request schema, runs the SAME use-case, answers the SAME JSON
 * body and writes the SAME admin audit event as the route — not by discipline
 * but by construction: nothing in this module names an operation. A filter the
 * route honours and this tool drops is no longer expressible.
 *
 * Names are reserved EXACTLY (`{app}_admin_<suffix>`), never by an `_admin_`
 * infix, so a table of the operator's called `admin_notes` keeps ordinary data
 * tools every allowed role sees.
 *
 * Two gates, like the internals family whose switch this one shares
 * (`MCP_EXPOSE_INTERNALS`): the tools are offered only to an admin-tier
 * credential, and a call by name from any other role — or with the switch off,
 * admins included — is refused here. Hiding a tool is not what protects it.
 *
 * Two trails, independent of each other. The tool-call ledger row is written by
 * `auditedToolsCallDispatch`, which wraps this handler in `routes.ts` (failures
 * included). The admin audit event is written by the operation itself, on a
 * successful read and only where the route writes one, recorded with the `mcp`
 * transport. A not-found read writes none, as the route's anti-enumeration 404
 * writes none.
 */

import { Effect } from 'effect'
import { AdminReadHost } from '@/application/ports/services/admin-read-host'
import { ServerOrigin } from '@/application/ports/services/server-origin'
import { isAdminReadText } from '@/application/use-cases/admin/admin-read-operation'
import {
  ADMIN_READ_OPERATIONS,
  adminReadToolNames,
} from '@/application/use-cases/admin/admin-read-registry'
import {
  adminReadToolName,
  findAdminReadToolCollision,
} from '@/domain/models/app/admin/admin-mcp-read-tools'
import { logError } from '@/infrastructure/logging/logger'
import { runOnDomain } from '@/infrastructure/logging/request-effect'
import { isAdminTierCaller } from '@/presentation/api/mcp/auth'
import { toolFailure, toolSuccess, type McpToolResult } from './tool-call-helpers'
import type { AdminReadHostFactory } from '@/application/ports/services/admin-read-host'
import type {
  AdminReadOperation,
  AdminReadResult,
} from '@/application/use-cases/admin/admin-read-operation'
import type { App } from '@/domain/models/app'
import type { DomainContext } from '@/infrastructure/logging/request-effect'
import type { McpCaller } from '@/presentation/api/mcp/auth'
import type { CompiledTool } from '@/presentation/api/mcp/tool-compiler'

// ---------------------------------------------------------------------------
// Compile
// ---------------------------------------------------------------------------

/**
 * The admin read tools `tools/list` may offer, or none when
 * `MCP_EXPOSE_INTERNALS=false`. The role filter downstream keeps them
 * admin-only.
 */
export const compileAdminReadTools = (input: {
  readonly appName: string
  readonly exposeInternals: boolean
}): ReadonlyArray<CompiledTool> => {
  if (!input.exposeInternals) return []
  return ADMIN_READ_OPERATIONS.map((operation) => ({
    name: adminReadToolName(input.appName, operation.tool.suffix),
    description: operation.tool.description,
    inputSchema: operation.tool.inputSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  }))
}

// ---------------------------------------------------------------------------
// Handle
// ---------------------------------------------------------------------------

export interface AdminReadCallInput {
  readonly caller: McpCaller
  readonly operation: AdminReadOperation
  readonly args: Record<string, unknown>
  readonly app: App
  readonly exposeInternals: boolean
  readonly domainContext: DomainContext
  /** Builds the read's host — supplied by the composition root with the mount. */
  readonly makeAdminReadHost: AdminReadHostFactory
}

/**
 * Handle a `tools/call` against an admin read tool.
 *
 * Every refusal THROWS a JSON-RPC protocol error (see `toolFailure`) BEFORE any
 * read, so a refused call carries no row and writes no admin audit event.
 */
export const handleAdminReadToolCall = async (
  input: AdminReadCallInput
): Promise<McpToolResult> => {
  const { operation, caller } = input
  // Same refusal whether the switch is off or the role is wrong, so a refused
  // caller learns nothing about which of the two it ran into.
  if (!input.exposeInternals || !isAdminTierCaller(caller) || caller.userId === undefined) {
    return toolFailure(
      -32_603,
      `Tool ${adminReadToolName(input.app.name, operation.tool.suffix)} is admin-only`
    )
  }
  // The tool's arguments, projected onto the parameters the route reads — the
  // same allow-list, so a key the route never sees never reaches the decoder.
  const raw = Object.fromEntries(
    operation.parameterNames.map((name) => [name, input.args[name]] as const)
  )
  const result = await runOperation(input, operation, {
    app: input.app,
    raw,
    actorUserId: caller.userId,
    transport: 'mcp',
  })
  return answerResult(operation, result)
}

/**
 * Run the operation on the server's domain services. A store failure (or an
 * unreadable actor) becomes a redacted `-32603`, never the driver's text; the
 * cause is logged here.
 *
 * The read's host is the origin this instance BOUND: a JSON-RPC dispatch has
 * no request of its own to read an address off, and the bound origin is the
 * one every background program already reports.
 */
const runOperation = async (
  input: Pick<AdminReadCallInput, 'domainContext' | 'makeAdminReadHost'>,
  operation: AdminReadOperation,
  request: Parameters<AdminReadOperation['run']>[0]
): Promise<AdminReadResult> => {
  try {
    return await runOnDomain(
      input.domainContext,
      Effect.gen(function* () {
        const origin = yield* (yield* ServerOrigin).current
        return yield* Effect.provideService(
          operation.run(request),
          AdminReadHost,
          input.makeAdminReadHost(origin)
        )
      })
    )
  } catch (error) {
    logError(`[mcp-admin-reads] ${operation.id} failed`, error)
    return toolFailure(-32_603, 'Internal query failed')
  }
}

/** Map a surface-neutral result onto the MCP answer. */
const answerResult = (operation: AdminReadOperation, result: AdminReadResult): McpToolResult => {
  switch (result._tag) {
    case 'Ok':
      // A text read (the markdown export) answers its text verbatim, byte for
      // byte, rather than as a JSON-encoded string.
      return isAdminReadText(result.body)
        ? { content: [{ type: 'text', text: result.body.body }] }
        : toolSuccess(result.body)
    case 'InvalidInput':
      return toolFailure(-32_602, invalidArgumentsMessage(result))
    case 'NotFound':
      // One answer for an unknown id and a malformed one alike.
      return toolFailure(-32_602, 'Not found')
    case 'Refused':
      // A named gate: the caller already sees the resource, so the reason
      // enumerates nothing — and it is the reason the route answers.
      return toolFailure(-32_602, `Refused: ${result.reason}`)
    case 'ValidationFailed':
      logError(`[mcp-admin-reads] ${operation.subject} response validation failed`, result.error)
      return toolFailure(-32_603, `Failed to build ${operation.subject}`)
  }
}

/** The refusal's words: the route's own when it names its refusal. */
const invalidArgumentsMessage = (
  result: Extract<AdminReadResult, { readonly _tag: 'InvalidInput' }>
): string => {
  if (result.reason === 'inverted-window') return 'Invalid arguments: from is later than to'
  return result.message === undefined ? 'Invalid arguments' : `Invalid arguments: ${result.message}`
}

// ---------------------------------------------------------------------------
// Mount-time collision refusal
// ---------------------------------------------------------------------------

/**
 * Refuse a config one of whose tools would answer to an admin read tool name.
 *
 * Runs on the compiled name SETS whatever `MCP_EXPOSE_INTERNALS` says, so
 * flipping the switch never changes whether an instance boots — and refusing
 * loudly, naming the table, is the only option that never silently drops either
 * the operator's data tool or the admin read it shadows.
 */
export const assertNoAdminReadToolCollision = (
  app: App,
  userTools: ReadonlyArray<CompiledTool>
): void => {
  const collision = findAdminReadToolCollision(
    app.name,
    adminReadToolNames(app.name),
    userTools.map((tool) => tool.name),
    (app.tables ?? []).map((table) => table.name)
  )
  if (collision === undefined) return
  const owner =
    collision.tableName === undefined
      ? 'a tool of this config'
      : `the table '${collision.tableName}'`
  throw new Error(
    `MCP tool-name collision: ${owner} compiles to '${collision.toolName}', ` +
      `which is the name of one of this instance's admin read tools. Rename the table — ` +
      `the admin read tool names are reserved on the MCP surface for the same reason 'config' is.`
  )
}
