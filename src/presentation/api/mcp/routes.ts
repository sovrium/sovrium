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
  compileConfigTools,
  findConfigToolTableCollision,
  isConfigToolName,
} from '@/application/use-cases/config/config-mcp-tools'
import { isAdminRole } from '@/domain/models/app/auth/permission-evaluation'
import {
  MCP_CONFIG_WRITE_IGNORED_NOTICE,
  MCP_ENV_DEFAULTS,
  McpEnvSchema,
  parseMcpConfigWrite,
  resolveMcpEnv,
  validateMcpEnv,
  type McpEnvConfig,
  type ResolvedMcpEnvConfig,
} from '@/domain/models/process-env/mcp'
import { logWarning } from '@/infrastructure/logging/logger'
import {
  auditedToolsCallDispatch,
  handleAuditListCall,
  isInternalAuditListTool,
} from '@/presentation/api/mcp/audit'
import {
  authenticateMcpRequest,
  readBearerToken,
  type McpAuthInstance,
  type McpCaller,
  type McpCallerRole,
} from '@/presentation/api/mcp/auth'
import {
  handleHttpConfigToolCall,
  type HttpConfigToolsDeps,
  type ReadStatusDocument,
} from '@/presentation/api/mcp/config-tools'
import {
  compileInternalTools,
  handleInternalToolCall,
  resolveInternalTool,
} from '@/presentation/api/mcp/internals'
import {
  buildRateLimitExceededResponse,
  checkMcpRateLimit,
  deriveMcpCallerKey,
  recordMcpRequest,
  type McpRateLimitConfig,
} from '@/presentation/api/mcp/rate-limit'
import { handleToolsCall } from '@/presentation/api/mcp/tool-call'
import { compileMcpTools, type CompiledTool } from '@/presentation/api/mcp/tool-compiler'
import type { App } from '@/domain/models/app'
import type { DomainContext } from '@/infrastructure/logging/request-effect'
import type { McpToolResult } from '@/presentation/api/mcp/tool-call-helpers'

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
 * @throws Error when validation fails (descriptive message printed by the fault branch of start.ts)
 */
/**
 * What the SERVER supplies to the MCP mount, as one bag.
 *
 * `domainContext` is the resolved services; `authInstance` is the Better Auth
 * instance the resource server verifies bearer tokens against. Bundled rather
 * than passed as two more positional arguments because `setupMcpRoutes` is at
 * the project-wide `max-params` limit, and because both come from the same
 * place — `createHonoApp`, which owns them both.
 */
export interface McpMountDeps {
  readonly domainContext: DomainContext
  readonly authInstance?: McpAuthInstance | undefined
  /**
   * The hash this instance publishes as `X-Sovrium-Config`, for
   * `{app}_config_read` ([internal ref] A8 surface 9).
   */
  readonly configHash?: string | undefined
  /**
   * Read the status document a running instance publishes, for
   * `{app}_config_status`.
   *
   * Injected rather than imported: `status-file.ts` is `infrastructure-server`,
   * which stays closed to routes. Absent — in a test that mounts the routes
   * directly — the tool reports `not-running`, which is the truthful answer for
   * a mount that was never told where to look.
   */
  readonly readStatusDocument?: ReadStatusDocument | undefined
}

/**
 * Say, once per boot, that `MCP_CONFIG_WRITE` bought this instance nothing.
 *
 * `logWarning` rather than a thrown refusal: refusing the boot was considered
 * and rejected, because `[internal ref]` and
 * `[internal ref]` both boot an HTTP instance with this exact
 * variable set and expect it to serve. Making them red to enforce A8 would be
 * reading the amendment against itself — its regression-fence clause names the
 * existing specs as the thing that must stay green.
 */
const announceIgnoredConfigWrite = (env: NodeJS.ProcessEnv): void => {
  if (!parseMcpConfigWrite(env)) return

  logWarning(MCP_CONFIG_WRITE_IGNORED_NOTICE)
}

export function setupMcpRoutes(
  honoApp: Readonly<Hono>,
  app: App,
  deps: McpMountDeps,
  env: NodeJS.ProcessEnv = process.env
): Readonly<Hono> {
  const { domainContext, authInstance } = deps
  // BEFORE the env decode and before the `enabled` gate, so the notice reaches
  // an operator whatever else their MCP configuration says. A8 bound 2 is about
  // tool REGISTRATION rather than about booting: an HTTP-served instance boots
  // and serves normally with this flag set, it simply compiles no write tool.
  // What it must not do is swallow the variable — an operator who set it on a
  // deployed server believes they enabled config writes over the network, and
  // they did not.
  announceIgnoredConfigWrite(env)
  const config = parseAndValidateMcpEnv(app, env)
  if (!config.enabled) {
    return honoApp
  }

  // stdio transport: MCP server reads JSON-RPC from stdin (driven by the CLI
  // when sovrium is spawned by an IDE). Hono still runs but the HTTP route
  // is intentionally NOT mounted — clients hitting it get 404.
  if (config.transport === 'stdio') return honoApp

  // Refused at tool-COMPILE time, where the app name and the table names are
  // both in hand — never by letting one resolver win the name and leaving the
  // other silently unreachable. Same reasoning as `isReservedInternalPrefix`,
  // on an exact name rather than a prefix.
  assertNoConfigToolCollision(app)

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
  // A8 surface 9: four static read tools, derived from `app.name` alone and
  // never from `app.tables[]`, so no configuration can add, remove or rename
  // one. The role filter downstream keeps them admin-only.
  const configTools = compileConfigTools(app.name)
  const tools = [...userTools, ...internalTools, ...configTools]
  const serverInfo = {
    name: `sovrium-${app.name}`,
    version: app.version ?? '0.0.0',
  } as const

  const dispatchContext: McpDispatchContext = {
    tools,
    serverInfo,
    app,
    auditEnabled: config.auditEnabled,
    domainContext,
    configToolsDeps: {
      app,
      processEnv: env,
      configHash: deps.configHash ?? '',
      readStatusDocument: deps.readStatusDocument ?? (async () => undefined),
    },
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
    tools: filterToolsForRole(dispatch.tools, caller.role, dispatch.app.name) as unknown as never,
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

interface McpDispatchContext {
  readonly tools: ReadonlyArray<CompiledTool>
  readonly serverInfo: McpServerInfo
  readonly app: App
  readonly auditEnabled: boolean
  /**
   * The server's resolved domain services, captured at MOUNT time.
   *
   * An MCP tool call runs inside the SDK's own handler, so there is no Hono
   * context underneath it to read the per-request services off. The mount has
   * one, and the services are constant for the life of the server, so carrying
   * them here is the same value every request would have been handed.
   */
  readonly domainContext: DomainContext
  /** What the four A8 config tools read, bound to the booted instance. */
  readonly configToolsDeps: HttpConfigToolsDeps
}

const handleMcpRequest = async (
  c: Readonly<Context>,
  config: ResolvedMcpEnvConfig,

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
  // Claimed FIRST, and safe to claim first: a table named `config` — the only
  // way a user-defined tool could answer to one of these four names — is
  // refused at mount time by `assertNoConfigToolCollision`. Reading the
  // configuration touches no database and writes no audit row, for the same
  // observability calculus the internals tools are exempt under.
  if (isConfigToolName(dispatch.app.name, parsed.toolName)) {
    return handleHttpConfigToolCall({
      caller,
      toolName: parsed.toolName,
      args: parsed.args,
      deps: dispatch.configToolsDeps,
    })
  }
  if (isInternalAuditListTool(parsed.toolName, dispatch.app.name)) {
    return handleAuditListCall({ caller, args: parsed.args, domainContext: dispatch.domainContext })
  }
  const internalResolved = resolveInternalTool(dispatch.app.name, parsed.toolName)
  if (internalResolved !== undefined) {
    return handleInternalToolCall({
      caller,
      resolved: internalResolved,
      args: parsed.args,
      domainContext: dispatch.domainContext,
    })
  }
  return auditedToolsCallDispatch({
    auditEnabled: dispatch.auditEnabled,
    domainContext: dispatch.domainContext,
    caller,
    toolName: parsed.toolName,
    args: parsed.args,
    dispatch: () => handleToolsCall(dispatch.app, caller, parsed, dispatch.domainContext),
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

/**
 * Refuse a config whose table names would shadow an A8 config tool.
 *
 * A table called `config` compiles to `{app}_config_read` — the same name the
 * config tool answers to. Refusing loudly, naming the table, is the only
 * option that never silently drops either the operator's data tool or the
 * surface A8 authorised.
 */
const assertNoConfigToolCollision = (app: Readonly<App>): void => {
  const collision = findConfigToolTableCollision((app.tables ?? []).map((table) => table.name))
  if (collision === undefined) return
  // eslint-disable-next-line functional/no-throw-statements -- startup validation must abort the process
  throw new Error(
    `MCP tool-name collision: the table '${collision}' compiles to '${app.name}_config_read', ` +
      `which is the name of this instance's configuration read tool. Rename the table — ` +
      `'config' is reserved on the MCP surface for the same reason 'auth_*' and 'system_*' are.`
  )
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
 *
 * `appName` is threaded through for the config family alone: theirs is the one
 * group whose membership is decided by an EXACT name rather than an infix, and
 * that name cannot be recognised without knowing the app.
 */
const filterToolsForRole = (
  tools: ReadonlyArray<CompiledTool>,
  role: McpCallerRole,
  appName: string
): ReadonlyArray<CompiledTool> => {
  const withoutInternals = isAdminRole(role)
    ? tools
    : tools.filter((tool) => !isInternalTool(tool.name, appName))
  if (role !== 'viewer') return withoutInternals
  return withoutInternals.filter((tool) => !isMutatingTool(tool.name))
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
    isConfigToolName(appName, toolName)
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
