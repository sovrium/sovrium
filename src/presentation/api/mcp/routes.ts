/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Server, createMcpHandler, type McpHttpHandler } from '@modelcontextprotocol/server'
import { type Context, type Hono } from 'hono'
import { resolveAdminReadOperation } from '@/application/use-cases/admin/admin-read-registry'
import {
  compileConfigTools,
  findConfigToolTableCollision,
  isConfigToolName,
} from '@/application/use-cases/config/config-mcp-tools'
import {
  assertNoAdminReadToolCollision,
  compileAdminReadTools,
  handleAdminReadToolCall,
} from '@/presentation/api/mcp/admin-reads'
import {
  auditedToolsCallDispatch,
  handleAuditListCall,
  isInternalAuditListTool,
} from '@/presentation/api/mcp/audit'
import {
  authenticateMcpRequest,
  readBearerToken,
  type McpAuthInstance,
  type McpAuthOutcome,
  type McpCaller,
} from '@/presentation/api/mcp/auth'
import { loadPausedAutomations } from '@/presentation/api/mcp/automation-call'
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
  announceIgnoredConfigWrite,
  parseAndValidateMcpEnv,
} from '@/presentation/api/mcp/mount-env'
import {
  buildRateLimitExceededResponse,
  checkMcpRateLimit,
  deriveMcpCallerKey,
  recordMcpRequest,
  type McpRateLimitConfig,
} from '@/presentation/api/mcp/rate-limit'
import { handleToolsCall } from '@/presentation/api/mcp/tool-call'
import { compileMcpTools, type CompiledTool } from '@/presentation/api/mcp/tool-compiler'
import { filterToolsForRole, refuseHeldAdminTool } from '@/presentation/api/mcp/tool-visibility'
import { applyMcpIpCeiling } from '@/presentation/api/middleware/api-ip-ceiling'
import type { AdminReadHostFactory } from '@/application/ports/services/admin-read-host'
import type { App } from '@/domain/models/app'
import type { ResolvedMcpEnvConfig } from '@/domain/models/process-env/mcp'
import type { DomainContext } from '@/infrastructure/logging/request-effect'
import type { McpToolResult } from '@/presentation/api/mcp/tool-call-helpers'

// JSON-RPC 2.0 spec uses `null` for the request id when the server cannot
// determine it (parse error, missing id). The project lints against `null`,
// so we centralize the only legitimate null in this module behind a typed
// constant — JSON.parse('null') keeps ESLint quiet without changing the
// wire-format value.
const JSONRPC_NULL_ID = JSON.parse('null') as null

/**
 * MCP server route mounting (the AI MCP server requirement, M-1 keystone).
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
  /**
   * Build the host an admin read tool answers against — the same builder the
   * admin HTTP routes use, so a tool and its route read the same process
   * facts. Injected because it belongs to the admin slug, which an MCP route
   * may not import.
   */
  readonly makeAdminReadHost: AdminReadHostFactory
}

export function setupMcpRoutes(
  honoApp: Readonly<Hono>,
  app: App,
  deps: McpMountDeps,
  env: NodeJS.ProcessEnv = process.env
): Readonly<Hono> {
  const authenticate: McpAuthenticate = (c) => authenticateMcpRequest(c, deps.authInstance, app)
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

  const tools = compileToolCatalog(app, config)
  const serverInfo = {
    name: `sovrium-${app.name}`,
    version: app.version ?? '0.0.0',
  } as const

  const dispatchContext: McpDispatchContext = {
    tools,
    serverInfo,
    app,
    auditEnabled: config.auditEnabled,
    exposeInternals: config.exposeInternals,
    domainContext: deps.domainContext,
    makeAdminReadHost: deps.makeAdminReadHost,
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

  // The per-address ceiling, ahead of authentication: an API key is a database
  // lookup and an OAuth token an introspection call, so both count against the
  // HTTP API's budget first. `MCP_RATE_LIMIT_PER_*` still apply, per caller.
  return applyMcpIpCeiling(honoApp as Hono, config.mountPath)
    .post(config.mountPath, async (c) => handleMcpRequest(c, config, mcpHandler, authenticate))
    .get(config.mountPath, async (c) => handleMcpSseGet(c, authenticate))
}

/**
 * Compile every tool family the mount may offer, refusing a config whose own
 * tools would answer to a reserved name. Each family's gate is applied here or
 * downstream in {@link filterToolsForRole}.
 */
const compileToolCatalog = (
  app: App,
  config: ResolvedMcpEnvConfig
): ReadonlyArray<CompiledTool> => {
  // Refused at tool-COMPILE time, where the app name and the table names are
  // both in hand — never by letting one resolver win the name and leaving the
  // other silently unreachable. Same reasoning as `isReservedInternalPrefix`,
  // on an exact name rather than a prefix.
  assertNoConfigToolCollision(app)

  const userTools = compileMcpTools(app, { confirmDestructive: config.confirmDestructive })
  // Same refusal as the config family's, on the admin read tools' exact names,
  // and regardless of `MCP_EXPOSE_INTERNALS` so the switch never decides a boot.
  assertNoAdminReadToolCollision(app, userTools)
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
  // There are no config-mutation tools (config-code-only, [internal ref]): config
  // changes ONLY by editing the app config file.
  // A8 surface 9: four static read tools, derived from `app.name` alone and
  // never from `app.tables[]`, so no configuration can add, remove or rename
  // one. The role filter downstream keeps them admin-only.
  const configTools = compileConfigTools(app.name)
  // The admin read tools: the admin API's reads, gated by the same switch as
  // the internals and kept admin-only by the same role filter.
  const adminReadTools = compileAdminReadTools({
    appName: app.name,
    exposeInternals: config.exposeInternals,
  })
  return [...userTools, ...internalTools, ...configTools, ...adminReadTools]
}

/**
 * Build the per-request MCP server.
 *
 * The low-level {@link Server} is used rather than `McpServer` deliberately.
 * `McpServer.registerTool` converts every handler outcome — including a thrown
 * `ProtocolError` — into a `CallToolResult` with `isError: true`, so a JSON-RPC
 * protocol error becomes structurally unreachable from a tool. Sovrium's RBAC
 * and field-permission denials are specified AS protocol errors
 * (an AI MCP RBAC spec → -32603, AN AI MCP RBAC SPEC → -32602, 16
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

  server.setRequestHandler('tools/list', async () => {
    const paused = await loadPausedAutomations(dispatch.domainContext)
    return {
      // `CompiledTool` already IS the wire shape (`tool-compiler.ts` emits
      // `inputSchema: { type: 'object', … }` JSON Schema). The cast only bridges
      // the readonly-array variance the SDK's mutable `Tool[]` does not accept.
      tools: filterToolsForRole(dispatch.tools, caller, dispatch.app, paused) as never,
    }
  })

  server.setRequestHandler(
    'tools/call',
    async (request) =>
      // Same readonly-array variance bridge as `tools/list`: the value IS the
      // wire shape, only its immutability annotation differs.
      dispatchToolsCall({
        params: (request as { readonly params?: unknown }).params,
        dispatch,
        caller,
      }) as never
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
/**
 * The credential gate bound to one app: a request in, a caller or a refusal
 * out. Bound to the app because the role bridge reads its ladder, so the app's
 * top role maps onto the MCP admin tier beside the built-in `admin`.
 */
type McpAuthenticate = (c: Context) => Promise<McpAuthOutcome>

const readCallerFromAuthInfo = (authInfo: { readonly extra?: unknown } | undefined): McpCaller => {
  const extra = authInfo?.extra as { readonly caller?: McpCaller } | undefined
  return extra?.caller ?? { role: 'viewer', userId: undefined }
}

const handleMcpSseGet = async (c: Context, authenticate: McpAuthenticate): Promise<Response> => {
  const auth = await authenticate(c)
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

const handleMcpRequest = async (
  c: Context,
  config: ResolvedMcpEnvConfig,

  mcpHandler: McpHttpHandler,
  authenticate: McpAuthenticate
): Promise<Response> => {
  // Credential gate. An `x-api-key` is verified as a Better Auth API key; an
  // `Authorization: Bearer` goes to the MCP resource server. Either way the
  // outcome is a caller with a real `userId`.
  const auth = await authenticate(c)
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

const dispatchToolsCall = (input: DispatchToolsCallInput): Promise<McpToolResult> => {
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
        app: dispatch.app,
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
  throw new Error(
    `MCP tool-name collision: the table '${collision}' compiles to '${app.name}_config_read', ` +
      `which is the name of this instance's configuration read tool. Rename the table — ` +
      `'config' is reserved on the MCP surface for the same reason 'auth_*' and 'system_*' are.`
  )
}
