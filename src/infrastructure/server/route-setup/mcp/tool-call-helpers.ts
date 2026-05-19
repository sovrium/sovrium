/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Effect } from 'effect'
import { type Context } from 'hono'
import { provideTableLive } from '@/infrastructure/layers/table-layer'
import type { Table } from '@/domain/models/app'

export interface RunProgramInput<A> {
  readonly c: Readonly<Context>
  readonly responseId: number | string
  readonly program: Effect.Effect<A, unknown, unknown>
  readonly formatSuccess?: (value: A) => unknown
  readonly notFoundResult?: unknown
}

export async function runProgramAsToolResult<A>(input: RunProgramInput<A>): Promise<Response> {
  const provided = provideTableLive(
    input.program as Effect.Effect<A, unknown, never>
  ) as Effect.Effect<A, unknown, never>
  const outcome = await Effect.runPromise(Effect.either(provided))

  if (outcome._tag === 'Left') {
    const message = outcome.left instanceof Error ? outcome.left.message : String(outcome.left)
    return jsonRpcError(input.c, input.responseId, -32_603, message)
  }

  const formatted = input.formatSuccess ? input.formatSuccess(outcome.right) : outcome.right
  if (formatted === undefined) {
    const replacement = input.notFoundResult ?? { error: 'Record not in scope' }
    return jsonRpcSuccess(input.c, input.responseId, replacement)
  }
  return jsonRpcSuccess(input.c, input.responseId, formatted)
}

export function jsonRpcSuccess(
  c: Readonly<Context>,
  responseId: number | string,
  data: unknown
): Response {
  return c.json({
    jsonrpc: '2.0',
    id: responseId,
    result: {
      content: [{ type: 'text', text: JSON.stringify(data, undefined, 2) }],
    },
  })
}

export function jsonRpcError(
  c: Readonly<Context>,
  responseId: number | string,
  code: number,
  message: string
): Response {
  return c.json({
    jsonrpc: '2.0',
    id: responseId,
    error: { code, message },
  })
}


const ENVELOPE_SYSTEM_FIELDS: ReadonlySet<string> = new Set([
  'id',
  'fields',
  'createdAt',
  'updatedAt',
  'createdBy',
  'updatedBy',
  'deletedBy',
])

const FIELDS_SYSTEM_KEYS: ReadonlySet<string> = new Set([
  'deleted_at',
  'deleted_by',
  'created_at',
  'updated_at',
  'created_by',
  'updated_by',
])

export function applyMcpFieldExposureToRecord(
  record: Readonly<Record<string, unknown>>,
  table: Readonly<Table>
): Record<string, unknown> {
  const access = table.aiAccess
  if (typeof access !== 'object') return { ...record }
  if (access.fieldExposure !== 'whitelist') return { ...record }
  const allowed = new Set(access.whitelistFields ?? [])

  const { fields } = record
  const filteredFields =
    typeof fields === 'object' && fields !== null && !Array.isArray(fields)
      ? Object.fromEntries(
          Object.entries(fields as Record<string, unknown>).filter(
            ([key]) => allowed.has(key) || FIELDS_SYSTEM_KEYS.has(key)
          )
        )
      : fields

  const filteredRoot = Object.fromEntries(
    Object.entries(record).filter(([key]) => ENVELOPE_SYSTEM_FIELDS.has(key) || allowed.has(key))
  )

  return { ...filteredRoot, fields: filteredFields }
}

export function applyMcpFieldExposureToRecords(
  records: ReadonlyArray<Readonly<Record<string, unknown>>>,
  table: Readonly<Table>
): ReadonlyArray<Record<string, unknown>> {
  return records.map((record) => applyMcpFieldExposureToRecord(record, table))
}
