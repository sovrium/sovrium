/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The write half of the MCP create, update and delete tools.
 *
 * An MCP write is the same write as a records-API POST, PATCH or DELETE reached
 * over another transport, so it runs the SAME use-case the records API runs
 * (`createRecordWithSideEffects`, `updateRecordWithSideEffects`,
 * `deleteRecordWithSideEffects`): the table's record-event automations and
 * webhooks, the AI-compute signal, the `published_at` convention and the
 * clean-up of a replaced attachment all follow, never the bare record write.
 * Each runs on the server's services through the mount-time domain context,
 * as every other MCP tool call does.
 */

import { Effect } from 'effect'
import {
  createRecordWithSideEffects,
  deleteRecordWithSideEffects,
  updateRecordWithSideEffects,
} from '@/application/use-cases/tables/record-write-roads'
import { isSqliteRuntime } from '@/infrastructure/database/unsupported-in-sqlite'
import { runOnDomain } from '@/infrastructure/logging/request-effect'
import { evictTransformCacheForKey } from '@/infrastructure/storage/transform-cache'
import { sanitizeError } from '@/presentation/api/runtime/error-sanitizer'
import { toolFailure, toolSuccess, type McpToolResult } from './tool-call-helpers'
import type { UserSession } from '@/application/ports/contracts/user-session'
import type { LinkReader } from '@/application/use-cases/tables/linked-row-visibility'
import type { App } from '@/domain/models/app'
import type { DomainContext, DomainServices } from '@/infrastructure/logging/request-effect'

/** The caller and the table one MCP write addresses. */
interface McpWriteScope {
  readonly app: App
  readonly session: UserSession
  readonly tableName: string
  readonly domainContext: DomainContext
}

/** A write that echoes the record: the caller and how they may write and read it. */
interface McpRecordWrite extends McpWriteScope {
  readonly fields: Readonly<Record<string, unknown>>
  readonly userRole: string
  readonly userGroups: readonly string[]
  readonly linkReader: LinkReader
  /** The written record as the caller's exposure rules let the tool answer it. */
  readonly formatSuccess: (record: Readonly<Record<string, unknown>>) => unknown
}

/** Run one write program on the domain services and answer it as a tool result. */
async function answerWrite<A, E>(
  domainContext: DomainContext,
  program: Effect.Effect<A, E, DomainServices>,
  format: (success: A) => unknown
): Promise<McpToolResult> {
  const outcome = await runOnDomain(domainContext, Effect.result(program))
  if (outcome._tag === 'Failure') {
    const sanitized = sanitizeError(outcome.failure)
    return toolFailure(-32_603, sanitized.message ?? sanitized.error)
  }
  return toolSuccess(format(outcome.success) ?? { error: 'Record not in scope' })
}

/** One MCP create, as the records API would run it, answered as a tool result. */
export async function runMcpRecordCreate(input: McpRecordWrite): Promise<McpToolResult> {
  const program = createRecordWithSideEffects({
    ...{ session: input.session, app: input.app, tableName: input.tableName },
    ...{ fields: input.fields, userRole: input.userRole, userGroups: input.userGroups },
    linkReader: input.linkReader,
    isSqlite: isSqliteRuntime(),
    processEnv: process.env,
  })
  return answerWrite(input.domainContext, program, (record) => input.formatSuccess({ ...record }))
}

/** One MCP update, as the records API would run it, answered as a tool result. */
export async function runMcpRecordUpdate(
  input: McpRecordWrite & { readonly recordId: string }
): Promise<McpToolResult> {
  const program = updateRecordWithSideEffects({
    ...{ session: input.session, app: input.app, tableName: input.tableName },
    ...{ recordId: input.recordId, fields: input.fields, userRole: input.userRole },
    userGroups: input.userGroups,
    linkReader: input.linkReader,
    isSqlite: isSqliteRuntime(),
    processEnv: process.env,
    forgetDerivedVariants: evictTransformCacheForKey,
  })
  return answerWrite(input.domainContext, program, (updated) =>
    updated === undefined ? undefined : input.formatSuccess({ ...updated })
  )
}

/** One MCP delete — to the trash, as the records API's DELETE — answered as a tool result. */
export async function runMcpRecordDelete(
  input: McpWriteScope & { readonly recordId: string }
): Promise<McpToolResult> {
  const program = deleteRecordWithSideEffects({
    ...{ session: input.session, app: input.app, tableName: input.tableName },
    recordId: input.recordId,
    mode: 'soft',
    processEnv: process.env,
    forgetDerivedVariants: evictTransformCacheForKey,
  })
  return answerWrite(input.domainContext, program, (result) => result)
}
