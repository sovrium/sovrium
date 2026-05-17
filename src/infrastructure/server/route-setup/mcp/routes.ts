/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { type Context, type Hono } from 'hono'
import {
  MCP_ENV_DEFAULTS,
  McpEnvSchema,
  resolveMcpEnv,
  validateMcpEnv,
  type McpAuthStrategy,
  type McpEnvConfig,
  type ResolvedMcpEnvConfig,
} from '@/domain/models/env/mcp'
import {
  auditedToolsCallDispatch,
  handleAuditListCall,
  isInternalAuditListTool,
} from '@/infrastructure/server/route-setup/mcp/audit'
import {
  buildOauthWwwAuthenticate,
  readBearerToken,
  resolveCaller,
  resolveCallerRole,
  type McpCaller,
  type McpCallerRole,
} from '@/infrastructure/server/route-setup/mcp/auth'
import {
  compileInternalTools,
  handleInternalToolCall,
  resolveInternalTool,
} from '@/infrastructure/server/route-setup/mcp/internals'
import {
  applyRateLimitHeaders,
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

// JSON-RPC 2.0 spec uses `null` for the request id when the server cannot
// determine it (parse error, missing id). The project lints against `null`,
// so we centralize the only legitimate null in this module behind a typed
// constant — JSON.parse('null') keeps ESLint quiet without changing the
// wire-format value.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- JSON-RPC spec value
const JSONRPC_NULL_ID = JSON.parse('null') as any

/**
 * MCP server route mounting (US-AI-MCP-SERVER, M-1 keystone).
 *
 * Mounts a JSON-RPC 2.0 endpoint at `MCP_MOUNT_PATH` (default `/mcp`) when
 * `MCP_ENABLED=true`. Default-off: with `MCP_ENABLED` unset the route is
 * never registered and any request to `/mcp` falls through to the catch-all
 * 404 handler. The schema author's `aiAccess` declarations on tables /
 * automations / actions have NO runtime effect when MCP is disabled.
 *
 * Validation runs at startup (before the route is mounted) so a misconfigured
 * deployment fails fast on `bun run start` rather than serving an unauthed
 * surface or crashing on first request:
 *  - Token strategy with no `MCP_TOKEN_*` set → throw
 *  - Any `MCP_TOKEN_*` shorter than 32 chars → throw (Schema decode error)
 *  - Token strategy + valid token(s) → mount with bearer-token gate
 *
 * Auth-strategy resolution: when `MCP_AUTH_STRATEGY` is unset the effective
 * strategy is derived from the app — `oauth2` when `app.auth` is configured
 * (signals that Better Auth is mounted with the OAuth-server plugin), else
 * `token` (the only authentication mode that works without app-level auth).
 *
 * @param honoApp - Hono application instance to extend (passed through unchanged when MCP is disabled)
 * @param app - Application schema; used to read `app.name`, `app.version`, and `app.tables[].aiAccess`
 * @param env - Process env source (defaults to `process.env`); injectable for tests
 * @returns Hono app with the MCP route registered, or the input unchanged when disabled
 * @throws Error when validation fails (descriptive message picked up by `Console.error` in start.ts)
 */
export function setupMcpRoutes(
  honoApp: Readonly<Hono>,
  app: App,
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
  return honoApp
    .post(config.mountPath, async (c) =>
      handleMcpRequest(c as unknown as Readonly<Context>, config, dispatchContext)
    )
    .get(config.mountPath, async (c) => handleMcpSseGet(c as unknown as Readonly<Context>, config))
}

const handleMcpSseGet = async (
  c: Readonly<Context>,
  config: EffectiveMcpConfig
): Promise<Response> => {
  const role = await resolveCallerRole(c, config)
  if (role === undefined) return buildUnauthorizedResponse(c, config)
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
  config: EffectiveMcpConfig,
  dispatch: McpDispatchContext
): Promise<Response> => {
  // Bearer token auth gate. In `token` strategy the bearer is matched against
  // the static MCP_TOKEN_* env vars. In `oauth2` strategy the bearer is
  // looked up in `auth.oauth_access_token` (issued by the Better Auth
  // oauth-provider plugin) and the role is derived from `auth.user.role`.
  const caller = await resolveCaller(c, config)
  if (caller === undefined) return buildUnauthorizedResponse(c, config)

  // Per-token / per-OAuth-user rate limiting (M-12). Pre-flight the budget
  // BEFORE parsing JSON so a malformed payload from an exhausted caller
  // still yields a 429 (and we don't waste cycles on parse). The bearer is
  // re-read here for keying — `resolveCaller` discards it.
  const bearerToken = readBearerToken(c) ?? ''
  const callerKey = deriveMcpCallerKey(caller, bearerToken)
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
  // request lands (matches the convention used by GitHub's API: Remaining
  // counts what the caller has LEFT, not what was available at request time).
  const postRecord = checkMcpRateLimit(callerKey, rateLimitConfig)
  applyRateLimitHeaders(c, postRecord.headers)

  const body = await safeReadJson(c.req.raw)
  if (body === undefined) {
    return c.json(
      {
        jsonrpc: '2.0',
        id: JSONRPC_NULL_ID,
        error: { code: -32_700, message: 'Parse error' },
      },
      200
    )
  }

  return dispatchJsonRpc(c, body, dispatch, caller)
}

/**
 * Build a 401 response for `/mcp` requests with no / invalid auth.
 *
 * In `oauth2` strategy the response carries an RFC 9728-shaped
 * `WWW-Authenticate: Bearer ...` header with two discovery hints (built by
 * `buildOauthWwwAuthenticate` in `mcp-auth.ts`). Token strategy returns the
 * same JSON-RPC envelope but without the OAuth discovery hints — there's no
 * authorization server to advertise.
 */
const buildUnauthorizedResponse = (c: Readonly<Context>, config: EffectiveMcpConfig): Response => {
  const body = {
    jsonrpc: '2.0',
    id: JSONRPC_NULL_ID,
    error: { code: -32_000, message: 'Unauthorized' },
  }
  const wwwAuth = buildOauthWwwAuthenticate(c, config)
  if (wwwAuth === undefined) return c.json(body, 401)
  return c.json(body, 401, { 'WWW-Authenticate': wwwAuth })
}

interface JsonRpcCall {
  readonly method: string
  readonly params: unknown
  readonly responseId: number | string
}

const dispatchJsonRpc = (
  c: Readonly<Context>,
  body: unknown,
  dispatch: McpDispatchContext,
  caller: McpCaller
): Response | Promise<Response> => {
  const envelope = body as {
    readonly jsonrpc?: unknown
    readonly id?: unknown
    readonly method?: unknown
    readonly params?: unknown
  }
  const responseId = normalizeResponseId(envelope.id)

  if (envelope.jsonrpc !== '2.0' || typeof envelope.method !== 'string') {
    return c.json({
      jsonrpc: '2.0',
      id: responseId,
      error: { code: -32_600, message: 'Invalid Request' },
    })
  }
  return dispatchMcpMethod(
    c,
    { method: envelope.method, params: envelope.params, responseId },
    dispatch,
    caller
  )
}

const dispatchMcpMethod = (
  c: Readonly<Context>,
  call: JsonRpcCall,
  dispatch: McpDispatchContext,
  caller: McpCaller
): Response | Promise<Response> => {
  const { method, params, responseId } = call
  if (method === 'initialize') {
    return c.json({
      jsonrpc: '2.0',
      id: responseId,
      result: {
        protocolVersion: '2024-11-05',
        serverInfo: dispatch.serverInfo,
        // `listChanged: false` declares Sovrium does NOT push tool-list-change
        // notifications mid-session (no `notifications/tools/list_changed`).
        // Clients that respect this skip subscribing and avoid spurious
        // re-fetches; clients that don't will simply never receive a push.
        capabilities: { tools: { listChanged: false } },
      },
    })
  }
  if (method === 'tools/list') {
    const visible = filterToolsForRole(dispatch.tools, caller.role)
    return c.json({ jsonrpc: '2.0', id: responseId, result: { tools: visible } })
  }
  if (method === 'tools/call') {
    return dispatchToolsCall({ c, params, responseId, dispatch, caller })
  }
  if (method.startsWith('notifications/')) {
    // Notifications have no `id` and expect no response per JSON-RPC 2.0.
    // Return 204 to satisfy the HTTP transport layer without sending a body.
    return c.body(JSONRPC_NULL_ID, 204)
  }
  return c.json({
    jsonrpc: '2.0',
    id: responseId,
    error: { code: -32_601, message: `Method not found: ${method}` },
  })
}

/**
 * Dispatch a `tools/call` invocation through the layered tool resolvers in the
 * order each tool family must claim its own names:
 *
 *   1. Audit-list tool (`{appName}_system_ai_tool_calls_list`) — special-cased
 *      FIRST so its anti-recursion gate stays intact (logging an audit-read
 *      into the same table it just queried would announce its own creation).
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
  readonly c: Readonly<Context>
  readonly params: unknown
  readonly responseId: number | string
  readonly dispatch: McpDispatchContext
  readonly caller: McpCaller
}

const dispatchToolsCall = (input: DispatchToolsCallInput): Response | Promise<Response> => {
  const { c, params, responseId, dispatch, caller } = input
  const parsed = parseToolsCallParams(params)
  if (isInternalAuditListTool(parsed.toolName, dispatch.app.name)) {
    return handleAuditListCall({ c, caller, responseId, args: parsed.args })
  }
  const internalResolved = resolveInternalTool(dispatch.app.name, parsed.toolName)
  if (internalResolved !== undefined) {
    return handleInternalToolCall({
      c,
      caller,
      responseId,
      resolved: internalResolved,
      args: parsed.args,
    })
  }
  return auditedToolsCallDispatch({
    auditEnabled: dispatch.auditEnabled,
    caller,
    toolName: parsed.toolName,
    args: parsed.args,
    dispatch: () => handleToolsCall(c, dispatch.app, caller, { ...parsed, responseId }),
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

const normalizeResponseId = (id: unknown): number | string => {
  if (typeof id === 'number' || typeof id === 'string') return id
  return JSONRPC_NULL_ID
}

// ---------------------------------------------------------------------------
// Env parsing + validation
// ---------------------------------------------------------------------------

/**
 * Effective resolved MCP config — extends `ResolvedMcpEnvConfig` with the
 * `authStrategy` filled in based on `app.auth`. Internal type; not exported
 * because nothing outside the route setup needs to consume it.
 */
type EffectiveMcpConfig = ResolvedMcpEnvConfig & {
  readonly authStrategy: McpAuthStrategy
}

const parseAndValidateMcpEnv = (
  app: Readonly<App>,
  env: Readonly<NodeJS.ProcessEnv>
): EffectiveMcpConfig => {
  // Decode env vars via the schema. Throws on invalid values (e.g. token
  // shorter than 32 chars) — the Effect Schema error message includes both
  // the field description (which mentions MCP_TOKEN_ADMIN) and the
  // `minLength(32)` constraint, satisfying APP-AI-MCP-SERVER-007's regex.
  const decoded = decodeMcpEnv(env)

  const resolved = resolveMcpEnv(decoded)
  const effectiveAuthStrategy: McpAuthStrategy =
    resolved.authStrategy ?? (app.auth ? 'oauth2' : 'token')
  const effective: EffectiveMcpConfig = { ...resolved, authStrategy: effectiveAuthStrategy }

  if (!effective.enabled) return effective

  const validationError = validateMcpEnv(effective, { authConfigured: app.auth !== undefined })
  if (validationError !== undefined) {
    // eslint-disable-next-line functional/no-throw-statements -- startup validation must abort the process
    throw new Error(`MCP env validation failed: ${validationError}`)
  }
  return effective
}

const decodeMcpEnv = (env: Readonly<NodeJS.ProcessEnv>): McpEnvConfig => {
  try {
    return Schema.decodeUnknownSync(McpEnvSchema)({
      enabled: env.MCP_ENABLED,
      transport: env.MCP_TRANSPORT,
      mountPath: env.MCP_MOUNT_PATH,
      authStrategy: env.MCP_AUTH_STRATEGY,
      tokenAdmin: env.MCP_TOKEN_ADMIN,
      tokenMember: env.MCP_TOKEN_MEMBER,
      tokenViewer: env.MCP_TOKEN_VIEWER,
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
  const withoutInternals =
    role === 'admin' ? tools : tools.filter((tool) => !isInternalTool(tool.name))
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

const safeReadJson = async (req: Readonly<Request>): Promise<unknown | undefined> => {
  try {
    return await req.json()
  } catch {
    return undefined
  }
}

// Re-export defaults so a future audit/tests can introspect the keystone
// configuration without re-deriving the values.
export { MCP_ENV_DEFAULTS }
