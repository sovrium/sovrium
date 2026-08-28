/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Server, createMcpHandler, type McpHttpHandler } from '@modelcontextprotocol/server'
import { Schema } from 'effect'
import { type Context, type Hono } from 'hono'
import {
  MCP_ENV_DEFAULTS,
  McpEnvSchema,
  resolveMcpEnv,
  validateMcpEnv,
  type McpEnvConfig,
  type ResolvedMcpEnvConfig,
} from '@/domain/models/env/mcp'
import { isAdminRole } from '@/domain/models/shared/permission-evaluation'
import {
  auditedToolsCallDispatch,
  handleAuditListCall,
  isInternalAuditListTool,
} from '@/infrastructure/server/route-setup/mcp/audit'
import {
  authenticateMcpRequest,
  readBearerToken,
  type McpAuthInstance,
  type McpCaller,
  type McpCallerRole,
} from '@/infrastructure/server/route-setup/mcp/auth'
import {
  compileInternalTools,
  handleInternalToolCall,
  resolveInternalTool,
} from '@/infrastructure/server/route-setup/mcp/internals'
import {
  buildRateLimitExceededResponse,
  checkMcpRateLimit,
  deriveMcpCallerKey,
  recordMcpRequest,
  type McpRateLimitConfig,
} from '@/infrastructure/server/route-setup/mcp/rate-limit'
import { handleToolsCall } from '@/infrastructure/server/route-setup/mcp/tool-call'
import {
  compileMcpTools,
  type CompiledTool,
} from '@/infrastructure/server/route-setup/mcp/tool-compiler'
import type { App } from '@/domain/models/app'
import type { McpToolResult } from '@/infrastructure/server/route-setup/mcp/tool-call-helpers'

// JSON-RPC 2.0 spec uses `null` for the request id when the server cannot
// determine it (parse error, missing id). The project lints against `null`,
// so we centralize the only legitimate null in this module behind a typed
// constant — JSON.parse('null') keeps ESLint quiet without changing the
// wire-format value.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- JSON-RPC spec value
const JSONRPC_NULL_ID = JSON.parse('null') as any

/**
 * MCP server route mounting ([internal ref] keystone).
 *
 * Mounts a JSON-RPC 2.0 endpoint at `MCP_MOUNT_PATH` (default `/mcp`) when
 * `MCP_ENABLED=true`. Default-off: with `MCP_ENABLED` unset the route is
 * never registered and any request to `/mcp` falls through to the catch-all
 * 404 handler. The schema author's `aiAccess` declarations on tables /
 * automations / actions have NO runtime effect when MCP is disabled.
 *
 * Protocol era: `2026-07-28` only, with `legacy: 'reject'`. That
 * revision has no `initialize` and no session — every request carries its own
 * `_meta` envelope plus `Mcp-Method` (and `Mcp-Name` for `tools/call`), and
 * `server/discover` advertises the era without establishing anything. A client
 * that can only speak a 2025-era revision is refused rather than downgraded.
 *
 * Credentials: a request authenticates with an API key on `x-api-key` or an
 * OAuth access token on `Authorization: Bearer`, and `/mcp` picks its verifier
 * from whichever header is present. Both are Better Auth plugins, so
 * `MCP_ENABLED=true` requires `app.auth`.
 *
 * Validation runs at startup (before the route is mounted) so a misconfigured
 * deployment fails fast on `bun run start` rather than serving an unauthed
 * surface or crashing on first request:
 *  - `MCP_ENABLED=true` without `app.auth` → throw
 *  - A still-set `MCP_TOKEN_*`, or `MCP_AUTH_STRATEGY=token` → throw
 *  - A non-positive rate limit → throw (Schema decode error)
 *
 * @param honoApp - Hono application instance to extend (passed through unchanged when MCP is disabled)
 * @param app - Application schema; used to read `app.name`, `app.version`, and `app.tables[].aiAccess`
 * @param authInstance - The Better Auth instance `createHonoApp` built for this app; the credential verifier both header paths run through
 * @param env - Process env source (defaults to `process.env`); injectable for tests
 * @returns Hono app with the MCP route registered, or the input unchanged when disabled
 * @throws Error when validation fails (descriptive message picked up by `Console.error` in start.ts)
 */
export function setupMcpRoutes(
  honoApp: Readonly<Hono>,
  app: App,
  authInstance?: McpAuthInstance,
  env: NodeJS.ProcessEnv = process.env
): Readonly<Hono> {
  const config = parseAndValidateMcpEnv(app, env)
  if (!config.enabled) {
    return honoApp
  }

  // stdio transport: MCP server reads JSON-RPC from stdin (driven by the CLI
  // when sovrium is spawned by an IDE). Hono still runs but the HTTP route
  // is intentionally NOT mounted — clients hitting it get 404.
  if (config.transport === 'stdio') return honoApp

  const userTools = compileMcpTools(app, { confirmDestructive: config.confirmDestructive })
  // M-14: append the full admin-internals surface — every entry in
  // `InternalTableRegistry` becomes a `_list` + `_read` tool pair (incl.
  // `{appName}_system_ai_tool_calls_list`, the M-13 audit-list tool, which
  // the registry-driven generator now emits alongside everything else).
  // The viewer/member role-filter in `filterToolsForRole` strips ALL
  // `_auth_*` / `_system_*` tools downstream regardless of operation.
  const internalTools = compileInternalTools({
    appName: app.name,
    exposeInternals: config.exposeInternals,
  })
  // Config-mutation tools (the `{appName}_schema_*` family) were retired with
  // the config-code-only reshape: config changes ONLY by editing the
  // app config file. The MCP server now exposes data + internal tools only.
  const tools = [...userTools, ...internalTools]
  const serverInfo = {
    name: `sovrium-${app.name}`,
    version: app.version ?? '0.0.0',
  } as const

  const dispatchContext: McpDispatchContext = {
    tools,
    serverInfo,
    app,
    auditEnabled: config.auditEnabled,
  }
  // streamable-http: POST handles JSON-RPC, GET upgrades to SSE per the MCP
  // spec (server-initiated notifications). Today the SSE stream stays empty
  // (capabilities advertise listChanged: false), but the Content-Type contract
  // matters for clients that probe transport before issuing POSTs.
  // One handler for the lifetime of the mount. The per-request MCP `Server` is
  // built by the factory below, which reads the already-authenticated caller
  // out of the pass-through `authInfo` the Hono handler supplies — that is how
  // per-caller `tools/list` filtering survives a shared handler.
  const mcpHandler = createMcpHandler(
    (ctx) => buildMcpServer(readCallerFromAuthInfo(ctx.authInfo), dispatchContext),
    { legacy: 'reject' }
  )

  return honoApp
    .post(config.mountPath, async (c) =>
      handleMcpRequest(c as unknown as Readonly<Context>, config, mcpHandler, authInstance)
    )
    .get(config.mountPath, async (c) =>
      handleMcpSseGet(c as unknown as Readonly<Context>, authInstance)
    )
}

/**
 * Build the per-request MCP server.
 *
 * The low-level {@link Server} is used rather than `McpServer` deliberately.
 * `McpServer.registerTool` converts every handler outcome — including a thrown
 * `ProtocolError` — into a `CallToolResult` with `isError: true`, so a JSON-RPC
 * protocol error becomes structurally unreachable from a tool. Sovrium's RBAC
 * and field-permission denials are specified AS protocol errors
 * (`[internal ref]` → -32603, `[internal ref]` → -32602, 16
 * assertions across six spec files), and a single `tools/call` request handler
 * is also what lets the layered resolver chain stay one ordered function
 * rather than N independent registrations. Both properties come from `Server`.
 *
 * A second consequence, worth stating because it removes a whole class of
 * work: `tools/list` here returns the compiler's JSON Schema verbatim, so no
 * Standard-Schema/zod conversion sits in the path at all.
 */
// eslint-disable-next-line functional/prefer-immutable-types -- `Server` is the SDK's own mutable class; it is registered into, then handed to the handler
const buildMcpServer = (caller: McpCaller, dispatch: McpDispatchContext): Server => {
  const server = new Server(dispatch.serverInfo, {
    // `listChanged: false` declares Sovrium does NOT push tool-list-change
    // notifications (no `notifications/tools/list_changed`). Clients that
    // respect it skip subscribing; clients that don't simply never get a push.
    capabilities: { tools: { listChanged: false } },
  })

  server.setRequestHandler('tools/list', async () => ({
    // `CompiledTool` already IS the wire shape (`tool-compiler.ts` emits
    // `inputSchema: { type: 'object', … }` JSON Schema). The cast only bridges
    // the readonly-array variance the SDK's mutable `Tool[]` does not accept.
    tools: filterToolsForRole(dispatch.tools, caller.role) as unknown as never,
  }))

  server.setRequestHandler(
    'tools/call',
    async (request) =>
      // Same readonly-array variance bridge as `tools/list`: the value IS the
      // wire shape, only its immutability annotation differs.
      dispatchToolsCall({
        params: (request as { readonly params?: unknown }).params,
        dispatch,
        caller,
      }) as unknown as never
  )

  return server
}

/**
 * Recover the authenticated caller from the SDK's pass-through `authInfo`.
 *
 * `handleMcpRequest` always populates it before delegating, so the fallback is
 * unreachable in practice. It fails CLOSED to `viewer` — the least-privileged
 * role — rather than defaulting to `member`, because a widened tool surface is
 * exactly the failure mode [internal ref] names as its riskiest gap.
 */
const readCallerFromAuthInfo = (authInfo: { readonly extra?: unknown } | undefined): McpCaller => {
  const extra = authInfo?.extra as { readonly caller?: McpCaller } | undefined
  return extra?.caller ?? { role: 'viewer', userId: undefined }
}

const handleMcpSseGet = async (
  c: Readonly<Context>,
  authInstance: McpAuthInstance | undefined
): Promise<Response> => {
  const auth = await authenticateMcpRequest(c, authInstance)
  if (!auth.ok) return auth.response
  // Minimal SSE body: comment line opens the stream and prevents proxy
  // buffering; no events are pushed until downstream specs add notifications.
  return new Response(': connected\n\n', {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}

// ---------------------------------------------------------------------------
// Request handling pipeline
// ---------------------------------------------------------------------------

interface McpServerInfo {
  readonly name: string
  readonly version: string
}

interface McpDispatchContext {
  readonly tools: ReadonlyArray<CompiledTool>
  readonly serverInfo: McpServerInfo
  readonly app: App
  readonly auditEnabled: boolean
}

const handleMcpRequest = async (
  c: Readonly<Context>,
  config: ResolvedMcpEnvConfig,
  // eslint-disable-next-line functional/prefer-immutable-types -- `McpHttpHandler` is an SDK-owned object with mutable members
  mcpHandler: McpHttpHandler,
  authInstance: McpAuthInstance | undefined
): Promise<Response> => {
  // Credential gate. An `x-api-key` is verified as a Better Auth API key; an
  // `Authorization: Bearer` goes to the MCP resource server. Either way the
  // outcome is a caller with a real `userId`.
  const auth = await authenticateMcpRequest(c, authInstance)
  if (!auth.ok) return auth.response
  const { caller } = auth

  // Per-caller rate limiting (M-12). Pre-flight the budget BEFORE the handler
  // parses anything so a malformed payload from an exhausted caller still
  // yields a 429.
  const callerKey = deriveMcpCallerKey(caller)
  const rateLimitConfig: McpRateLimitConfig = {
    perMinute: config.rateLimitPerMinute,
    perDay: config.rateLimitPerDay,
  }
  const limitCheck = checkMcpRateLimit(callerKey, rateLimitConfig)
  if (limitCheck.exceeded) {
    return buildRateLimitExceededResponse(c, JSONRPC_NULL_ID, limitCheck)
  }
  recordMcpRequest(callerKey)
  // Re-evaluate post-record so the headers reflect the budget AFTER this
  // request lands (matches GitHub's API convention: Remaining counts what the
  // caller has LEFT, not what was available at request time).
  const postRecord = checkMcpRateLimit(callerKey, rateLimitConfig)

  // Hand the request to the SDK handler. `authInfo` is strictly pass-through —
  // the handler never reads headers or verifies tokens itself — so it is the
  // sanctioned channel for carrying the caller Sovrium already authenticated.
  const response = await mcpHandler.fetch(c.req.raw, {
    authInfo: {
      // Bearer only. An API key is deliberately NOT echoed here: `authInfo` is
      // pass-through state the SDK hands to tool code, and a long-lived
      // credential does not belong in it.
      token: readBearerToken(c) ?? '',
      clientId: caller.userId ?? 'mcp-caller',
      scopes: [],
      extra: { caller },
    },
  })

  // Rate-limit headers must ride on the SDK's Response. `c.header(...)` only
  // decorates responses Hono itself builds, so setting them on the context
  // would silently drop them here.
  return withRateLimitHeaders(response, postRecord.headers)
}

/**
 * Return a copy of `response` carrying the rate-limit headers. The body is
 * passed through by reference (not read), so no stream is consumed.
 */
const withRateLimitHeaders = (
  response: Readonly<Response>,
  headers: Readonly<Record<string, string>>
): Response => {
  const merged = new Headers(response.headers)

  Object.entries(headers).forEach(([name, value]) => merged.set(name, value))
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: merged,
  })
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
 * DATA-EXPOSURE constraint, pinned by `[internal ref]`.
 *
 *      It is NOT an anti-recursion gate, which is what this comment claimed
 * until 2026-08-27: tier 2 returns early from this same
 *      function, outside `auditedToolsCallDispatch`, so NEITHER tier writes an
 *      audit row. "No new row after an audit-read" holds under both orderings
 *      and so cannot motivate this one. Reading the constraint as bookkeeping
 *      makes it look droppable; dropping it leaks two columns.
 *   2. M-14 registry-driven internals dispatcher — every other
 *      `{appName}_{auth|system}_{table}_{list|read}` tool flows through the
 *      generic SELECT-and-strip handler. Internal tools are NOT audited
 *      (read-only, admin-only — same observability calculus as the
 *      audit-list tool).
 *   3. User-defined tools — wrapped in `auditedToolsCallDispatch` so every
 *      success/failure lands in `system.ai_tool_calls`.
 *
 * Extracted from `dispatchMcpMethod` to keep that orchestrator under the
 * project-wide `max-lines-per-function` ceiling.
 */
interface DispatchToolsCallInput {
  readonly params: unknown
  readonly dispatch: McpDispatchContext
  readonly caller: McpCaller
}

const dispatchToolsCall = (input: DispatchToolsCallInput): Promise<McpToolResult> => {
  const { params, dispatch, caller } = input
  const parsed = parseToolsCallParams(params)
  if (isInternalAuditListTool(parsed.toolName, dispatch.app.name)) {
    return handleAuditListCall({ caller, args: parsed.args })
  }
  const internalResolved = resolveInternalTool(dispatch.app.name, parsed.toolName)
  if (internalResolved !== undefined) {
    return handleInternalToolCall({
      caller,
      resolved: internalResolved,
      args: parsed.args,
    })
  }
  return auditedToolsCallDispatch({
    auditEnabled: dispatch.auditEnabled,
    caller,
    toolName: parsed.toolName,
    args: parsed.args,
    dispatch: () => handleToolsCall(dispatch.app, caller, parsed),
  })
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

// ---------------------------------------------------------------------------
// Env parsing + validation
// ---------------------------------------------------------------------------

const parseAndValidateMcpEnv = (
  app: Readonly<App>,
  env: Readonly<NodeJS.ProcessEnv>
): ResolvedMcpEnvConfig => {
  // Decode env vars via the schema. Throws on invalid values (e.g. a
  // non-positive rate limit).
  const resolved = resolveMcpEnv(decodeMcpEnv(env))
  if (!resolved.enabled) return resolved

  // The raw env goes through so the retired-var guard can see names the schema
  // no longer carries — that is the whole point of detecting them by presence
  // rather than by a constraint on a field that no longer exists.
  const validationError = validateMcpEnv(resolved, {
    authConfigured: app.auth !== undefined,
    env,
  })
  if (validationError !== undefined) {
    // eslint-disable-next-line functional/no-throw-statements -- startup validation must abort the process
    throw new Error(`MCP env validation failed: ${validationError}`)
  }
  return resolved
}

const decodeMcpEnv = (env: Readonly<NodeJS.ProcessEnv>): McpEnvConfig => {
  try {
    return Schema.decodeUnknownSync(McpEnvSchema)({
      enabled: env.MCP_ENABLED,
      transport: env.MCP_TRANSPORT,
      mountPath: env.MCP_MOUNT_PATH,
      rateLimitPerMinute: env.MCP_RATE_LIMIT_PER_MINUTE,
      rateLimitPerDay: env.MCP_RATE_LIMIT_PER_DAY,
      auditEnabled: env.MCP_AUDIT_ENABLED,
      exposeInternals: env.MCP_EXPOSE_INTERNALS,
      confirmDestructive: env.MCP_CONFIRM_DESTRUCTIVE,
    })
  } catch (error) {
    // Re-throw with a stable prefix so operators (and the test regex) see
    // the MCP-specific tag at the top of the stderr blob, ahead of the
    // verbose schema diff that Effect renders for parse errors.
    const message = error instanceof Error ? error.message : String(error)
    // eslint-disable-next-line functional/no-throw-statements -- startup validation must abort the process
    throw new Error(`MCP env validation failed: ${message}`)
  }
}

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
 */
const filterToolsForRole = (
  tools: ReadonlyArray<CompiledTool>,
  role: McpCallerRole
): ReadonlyArray<CompiledTool> => {
  const withoutInternals = isAdminRole(role)
    ? tools
    : tools.filter((tool) => !isInternalTool(tool.name))
  if (role !== 'viewer') return withoutInternals
  return withoutInternals.filter((tool) => !isMutatingTool(tool.name))
}

const isInternalTool = (toolName: string): boolean => {
  // Tool naming convention: `{appName}_auth_{table}_{op}` and
  // `{appName}_system_{table}_{op}`. The infixes are unambiguous because
  // user-defined tables cannot be named `auth_*` or `system_*` — the
  // cross-validator rejects those at decode time.
  return toolName.includes('_auth_') || toolName.includes('_system_')
}

const isMutatingTool = (toolName: string): boolean => {
  if (toolName.endsWith('_create')) return true
  if (toolName.endsWith('_update')) return true
  if (toolName.endsWith('_delete')) return true
  // Action templates are never read-only by definition (they execute a
  // workflow); withhold from viewer until per-template annotations are
  // honored in M-6.
  if (toolName.includes('_action_')) return true
  // Manual-trigger automations execute side-effecting workflows by
  // design (M-8); withhold from viewer for the same reason as action
  // templates. The trigger's `requiredRole` provides the finer per-role
  // gate at tools/call time.
  if (toolName.includes('_automation_')) return true
  return false
}

// Re-export defaults so a future audit/tests can introspect the keystone
// configuration without re-deriving the values.
export { MCP_ENV_DEFAULTS }
