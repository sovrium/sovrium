/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { sql } from 'drizzle-orm'
import { type Context } from 'hono'
import { db } from '@/infrastructure/database'
import { jsonbLiteral } from '@/infrastructure/database/sql/sql-utils'
import { logWarning } from '@/infrastructure/logging/logger'
import type { McpCaller, McpCallerRole } from '@/infrastructure/server/route-setup/mcp/auth'


interface DispatchOutcome {
  readonly result: unknown | undefined
  readonly errorCode: number | undefined
  readonly errorMessage: string | undefined
}

const extractDispatchOutcome = (body: unknown): DispatchOutcome => {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { result: undefined, errorCode: undefined, errorMessage: undefined }
  }
  const envelope = body as { readonly result?: unknown; readonly error?: unknown }
  if (envelope.error !== undefined && envelope.error !== null) {
    const err = envelope.error as { readonly code?: unknown; readonly message?: unknown }
    const message = typeof err.message === 'string' ? err.message : 'Unknown error'
    const code = typeof err.code === 'number' ? err.code : undefined
    return { result: undefined, errorCode: code, errorMessage: message }
  }
  return { result: envelope.result, errorCode: undefined, errorMessage: undefined }
}

const insertAuditRow = async (input: {
  readonly callerRole: McpCallerRole
  readonly callerId: string
  readonly callerType: 'oauth' | 'token'
  readonly toolName: string
  readonly inputArgs: Record<string, unknown>
  readonly outcome: DispatchOutcome
  readonly latencyMs: number
}): Promise<void> => {
  const roundedLatency = Math.max(1, Math.round(input.latencyMs))

  const inputLiteral = jsonbLiteral(input.inputArgs)
  const outputLiteral =
    input.outcome.result === undefined ? sql.raw('NULL') : jsonbLiteral(input.outcome.result)
  const errorMessageFragment =
    input.outcome.errorMessage === undefined ? sql.raw('NULL') : sql`${input.outcome.errorMessage}`
  const errorCodeFragment =
    input.outcome.errorCode === undefined ? sql.raw('NULL') : sql`${input.outcome.errorCode}`

  try {
    await db.execute(
      sql`INSERT INTO system.ai_tool_calls
          (tool_name, caller_type, caller_id, caller_role, input, output, error_message, error_code, latency_ms, transport)
          VALUES (
            ${input.toolName},
            ${input.callerType},
            ${input.callerId},
            ${input.callerRole},
            ${inputLiteral},
            ${outputLiteral},
            ${errorMessageFragment},
            ${errorCodeFragment},
            ${roundedLatency},
            'streamable-http'
          )`
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const cause = error instanceof Error && error.cause instanceof Error ? error.cause.message : ''
    logWarning(
      `[mcp-audit] failed to persist tool-call audit row: ${message}${cause ? ` | cause: ${cause}` : ''}`
    )
  }
}

const deriveCallerIdentity = (
  caller: Readonly<McpCaller>
): { readonly callerType: 'oauth' | 'token'; readonly callerId: string } => {
  if (caller.userId !== undefined && caller.userId.length > 0) {
    return { callerType: 'oauth', callerId: caller.userId }
  }
  return { callerType: 'token', callerId: 'token' }
}


export interface AuditDispatchInput {
  readonly auditEnabled: boolean
  readonly caller: McpCaller
  readonly toolName: string
  readonly args: Record<string, unknown>
  readonly dispatch: () => Promise<Response> | Response
}

export const auditedToolsCallDispatch = async (input: AuditDispatchInput): Promise<Response> => {
  if (!input.auditEnabled) {
    return input.dispatch()
  }

  const start = Date.now()
  const response = await input.dispatch()
  const latencyMs = Date.now() - start

  const outcome = await readResponseOutcome(response)
  const identity = deriveCallerIdentity(input.caller)

  await insertAuditRow({
    callerRole: input.caller.role,
    callerId: identity.callerId,
    callerType: identity.callerType,
    toolName: input.toolName,
    inputArgs: input.args,
    outcome,
    latencyMs,
  })

  return response
}

const readResponseOutcome = async (response: Readonly<Response>): Promise<DispatchOutcome> => {
  try {
    const clone = response.clone()
    const body = await clone.json()
    return extractDispatchOutcome(body)
  } catch {
    return { result: undefined, errorCode: undefined, errorMessage: undefined }
  }
}


export const isInternalAuditListTool = (toolName: string, appName: string): boolean =>
  toolName === `${appName}_system_ai_tool_calls_list`

interface AuditListRow {
  readonly id: string
  readonly created_at: string
  readonly caller_role: string
  readonly caller_id: string
  readonly caller_type: string
  readonly tool_name: string
  readonly input: unknown
  readonly output: unknown
  readonly error_message: string | null
  readonly error_code: number | null
  readonly latency_ms: number
  readonly transport: string
}

export const handleAuditListCall = async (input: {
  readonly c: Readonly<Context>
  readonly caller: McpCaller
  readonly responseId: number | string
  readonly args: Record<string, unknown>
}): Promise<Response> => {
  if (input.caller.role !== 'admin') {
    return input.c.json({
      jsonrpc: '2.0',
      id: input.responseId,
      error: {
        code: -32_603,
        message: 'Internal tool system.ai_tool_calls is admin-only',
      },
    })
  }

  const limitArg = input.args['limit']
  const limit = typeof limitArg === 'number' && limitArg > 0 ? Math.min(limitArg, 1000) : 50

  try {
    const safeLimit = Math.floor(limit)
    const result = (await db.execute(
      sql.raw(
        `SELECT id, created_at, caller_role, caller_id, caller_type, tool_name, input, output, error_message, error_code, latency_ms, transport
         FROM system.ai_tool_calls
         ORDER BY created_at DESC
         LIMIT ${safeLimit}`
      )
    )) as unknown as { readonly rows?: ReadonlyArray<AuditListRow> }

    const rows = Array.isArray(result)
      ? (result as ReadonlyArray<AuditListRow>)
      : (result.rows ?? [])

    return input.c.json({
      jsonrpc: '2.0',
      id: input.responseId,
      result: {
        content: [{ type: 'text', text: JSON.stringify(rows, undefined, 2) }],
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return input.c.json({
      jsonrpc: '2.0',
      id: input.responseId,
      error: {
        code: -32_603,
        message: `Audit-list query failed: ${message}`,
      },
    })
  }
}
