/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { sql } from 'drizzle-orm'
import { type Context } from 'hono'
import {
  InternalTableRegistry,
  type InternalTableEntry,
} from '@/domain/models/shared/internal-tables'
import { db } from '@/infrastructure/database'
import { extractRows } from '@/infrastructure/database/sql/sql-utils'
import type { McpCaller } from '@/infrastructure/server/route-setup/mcp/auth'
import type { CompiledTool } from '@/infrastructure/server/route-setup/mcp/tool-compiler'


export const compileInternalTools = (input: {
  readonly appName: string
  readonly exposeInternals: boolean
}): ReadonlyArray<CompiledTool> => {
  if (!input.exposeInternals) return []
  return InternalTableRegistry.flatMap((entry) => buildToolsForEntry(input.appName, entry))
}

const buildToolsForEntry = (
  appName: string,
  entry: InternalTableEntry
): ReadonlyArray<CompiledTool> => {
  const baseName = `${appName}_${entry.schema}_${entry.name}`
  return [
    {
      name: `${baseName}_list`,
      description: `List rows from ${entry.schema}.${entry.name} (admin-only, read-only). ${entry.description}`,
      inputSchema: {
        type: 'object',
        properties: {
          limit: { type: 'integer', minimum: 1, maximum: 1000 },
        },
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    {
      name: `${baseName}_read`,
      description: `Read a single row from ${entry.schema}.${entry.name} by id (admin-only, read-only). ${entry.description}`,
      inputSchema: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
  ]
}


export interface ResolvedInternalTool {
  readonly entry: InternalTableEntry
  readonly operation: 'list' | 'read'
}

export const resolveInternalTool = (
  appName: string,
  toolName: string
): ResolvedInternalTool | undefined => {
  const prefix = `${appName}_`
  if (!toolName.startsWith(prefix)) return undefined
  const remainder = toolName.slice(prefix.length)

  const schema = remainder.startsWith('auth_')
    ? 'auth'
    : remainder.startsWith('system_')
      ? 'system'
      : undefined
  if (schema === undefined) return undefined

  const lastUnderscore = remainder.lastIndexOf('_')
  if (lastUnderscore <= 0) return undefined
  const operationSlice = remainder.slice(lastUnderscore + 1)
  if (operationSlice !== 'list' && operationSlice !== 'read') return undefined

  const schemaPrefix = `${schema}_`
  const tableName = remainder.slice(schemaPrefix.length, lastUnderscore)
  if (tableName.length === 0) return undefined

  const entry = InternalTableRegistry.find((e) => e.schema === schema && e.name === tableName)
  if (entry === undefined) return undefined

  return { entry, operation: operationSlice }
}


export const handleInternalToolCall = async (input: {
  readonly c: Readonly<Context>
  readonly caller: McpCaller
  readonly responseId: number | string
  readonly resolved: ResolvedInternalTool
  readonly args: Record<string, unknown>
}): Promise<Response> => {
  if (input.caller.role !== 'admin') {
    return input.c.json({
      jsonrpc: '2.0',
      id: input.responseId,
      error: {
        code: -32_603,
        message: `Internal tool ${input.resolved.entry.schema}.${input.resolved.entry.name} is admin-only`,
      },
    })
  }

  if (input.resolved.operation === 'list') {
    return executeInternalList(input)
  }
  return executeInternalRead(input)
}

const executeInternalList = async (input: {
  readonly c: Readonly<Context>
  readonly responseId: number | string
  readonly resolved: ResolvedInternalTool
  readonly args: Record<string, unknown>
}): Promise<Response> => {
  const limitArg = input.args['limit']
  const limit = typeof limitArg === 'number' && limitArg > 0 ? Math.min(limitArg, 1000) : 50
  const safeLimit = Math.floor(limit)

  try {
    const result = (await db.execute(
      sql.raw(
        `SELECT * FROM ${input.resolved.entry.schema}.${input.resolved.entry.name} LIMIT ${safeLimit}`
      )
    )) as unknown
    const rows = extractRows(result)
    const stripped = rows.map((row) => stripDenylistedColumns(row, input.resolved.entry))
    return input.c.json({
      jsonrpc: '2.0',
      id: input.responseId,
      result: {
        content: [{ type: 'text', text: JSON.stringify(stripped, undefined, 2) }],
      },
    })
  } catch {
    return input.c.json({
      jsonrpc: '2.0',
      id: input.responseId,
      error: { code: -32_603, message: 'Internal query failed' },
    })
  }
}

const executeInternalRead = async (input: {
  readonly c: Readonly<Context>
  readonly responseId: number | string
  readonly resolved: ResolvedInternalTool
  readonly args: Record<string, unknown>
}): Promise<Response> => {
  const recordId = String(input.args['id'] ?? '')
  if (recordId.length === 0) {
    return input.c.json({
      jsonrpc: '2.0',
      id: input.responseId,
      error: { code: -32_602, message: "Missing 'id' parameter" },
    })
  }

  try {
    const result = (await db.execute(
      sql.raw(
        `SELECT * FROM ${input.resolved.entry.schema}.${input.resolved.entry.name} WHERE id = '${recordId.replace(/'/g, "''")}' LIMIT 1`
      )
    )) as unknown
    const rows = extractRows(result)
    if (rows.length === 0) {
      return input.c.json({
        jsonrpc: '2.0',
        id: input.responseId,
        result: {
          content: [{ type: 'text', text: JSON.stringify(undefined) }],
        },
      })
    }
    const stripped = stripDenylistedColumns(rows[0] ?? {}, input.resolved.entry)
    return input.c.json({
      jsonrpc: '2.0',
      id: input.responseId,
      result: {
        content: [{ type: 'text', text: JSON.stringify(stripped, undefined, 2) }],
      },
    })
  } catch {
    return input.c.json({
      jsonrpc: '2.0',
      id: input.responseId,
      error: { code: -32_603, message: 'Internal query failed' },
    })
  }
}


const stripDenylistedColumns = (
  row: Readonly<Record<string, unknown>>,
  entry: InternalTableEntry
): Record<string, unknown> => {
  if (entry.denylistFields.length === 0) return { ...row }
  const denied = new Set<string>(
    entry.denylistFields.flatMap((field) => [field, camelToSnake(field)])
  )
  return Object.fromEntries(Object.entries(row).filter(([key]) => !denied.has(key)))
}

const camelToSnake = (s: string): string => s.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`)
