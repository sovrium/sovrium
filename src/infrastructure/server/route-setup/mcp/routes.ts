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
import { handleSchemaToolCall } from '@/infrastructure/server/route-setup/mcp/schema-tool-call'
import {
  compileSchemaTools,
  isSchemaEditEnabled,
  isSchemaTool,
} from '@/infrastructure/server/route-setup/mcp/schema-tools'
import { handleToolsCall } from '@/infrastructure/server/route-setup/mcp/tool-call'
import {
  compileMcpTools,
  type CompiledTool,
} from '@/infrastructure/server/route-setup/mcp/tool-compiler'
import type { App } from '@/domain/models/app'

const JSONRPC_NULL_ID = JSON.parse('null') as any

export function setupMcpRoutes(
  honoApp: Readonly<Hono>,
  app: App,
  env: NodeJS.ProcessEnv = process.env
): Readonly<Hono> {
  const config = parseAndValidateMcpEnv(app, env)
  if (!config.enabled) {
    return honoApp
  }

  if (config.transport === 'stdio') return honoApp

  const userTools = compileMcpTools(app, { confirmDestructive: config.confirmDestructive })
  const internalTools = compileInternalTools({
    appName: app.name,
    exposeInternals: config.exposeInternals,
  })
  const schemaTools = compileSchemaTools(app.name, isSchemaEditEnabled(env))
  const tools = [...userTools, ...internalTools, ...schemaTools]
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
  return new Response(': connected\n\n', {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}


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
  const caller = await resolveCaller(c, config)
  if (caller === undefined) return buildUnauthorizedResponse(c, config)

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
    return c.body(JSONRPC_NULL_ID, 204)
  }
  return c.json({
    jsonrpc: '2.0',
    id: responseId,
    error: { code: -32_601, message: `Method not found: ${method}` },
  })
}

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
  if (isSchemaTool(dispatch.app.name, parsed.toolName)) {
    return handleSchemaToolCall({
      c,
      caller,
      responseId,
      appName: dispatch.app.name,
      toolName: parsed.toolName,
      args: parsed.args,
    })
  }
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


type EffectiveMcpConfig = ResolvedMcpEnvConfig & {
  readonly authStrategy: McpAuthStrategy
}

const parseAndValidateMcpEnv = (
  app: Readonly<App>,
  env: Readonly<NodeJS.ProcessEnv>
): EffectiveMcpConfig => {
  const decoded = decodeMcpEnv(env)

  const resolved = resolveMcpEnv(decoded)
  const effectiveAuthStrategy: McpAuthStrategy =
    resolved.authStrategy ?? (app.auth ? 'oauth2' : 'token')
  const effective: EffectiveMcpConfig = { ...resolved, authStrategy: effectiveAuthStrategy }

  if (!effective.enabled) return effective

  const validationError = validateMcpEnv(effective, { authConfigured: app.auth !== undefined })
  if (validationError !== undefined) {
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
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`MCP env validation failed: ${message}`)
  }
}

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
  return toolName.includes('_auth_') || toolName.includes('_system_')
}

const isMutatingTool = (toolName: string): boolean => {
  if (toolName.endsWith('_create')) return true
  if (toolName.endsWith('_update')) return true
  if (toolName.endsWith('_delete')) return true
  if (toolName.includes('_action_')) return true
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

export { MCP_ENV_DEFAULTS }
