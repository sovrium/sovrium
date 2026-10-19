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
import { recordPassesReadPredicate } from '@/application/use-cases/tables/permissions/row-level-read-filter'
import { recordWriteRequester } from '@/application/use-cases/tables/record-create-orchestration'
import {
  createRecordWithSideEffects,
  deleteRecordWithSideEffects,
  updateRecordWithSideEffects,
} from '@/application/use-cases/tables/record-write-roads'
import {
  uniqueConflictAnswerProgram,
  type UniqueConflictReader,
} from '@/application/use-cases/tables/unique-conflict-answer-program'
import { isSqliteRuntime } from '@/infrastructure/database/unsupported-in-sqlite'
import { runOnDomain } from '@/infrastructure/logging/request-effect'
import { evictTransformCacheForKey } from '@/infrastructure/storage/transform-cache'
import { sanitizeError } from '@/presentation/api/runtime/error-sanitizer'
import { isUniqueConflictAnswer } from '@/presentation/api/runtime/unique-conflict-answer'
import { passesTablePermission, type CallerAuthority } from './caller-authority'
import { resolveUserContextOrUndefined } from './caller-row-context'
import { toolFailure, toolSuccess, type McpToolResult } from './tool-call-helpers'
import type { McpCaller } from './auth'
import type { UserSession } from '@/application/ports/contracts/user-session'
import type { LinkReader } from '@/application/use-cases/tables/linked-row-visibility'
import type { App, Table } from '@/domain/models/app'
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
  /** Who writes, to which table: what a unique conflict may tell her (see below). */
  readonly conflictScope: McpConflictScope
}

/** The caller and table a write tool addresses, as the dispatcher resolved them. */
export interface McpConflictScope {
  readonly app: App
  readonly caller: McpCaller
  readonly authority: CallerAuthority
  readonly table: Table
}

/** The caller as a unique conflict judges her: her table read, and her row-level read rule. */
async function conflictReaderOf(scope: McpConflictScope): Promise<UniqueConflictReader> {
  const { app, caller, authority, table } = scope
  const ctx = await resolveUserContextOrUndefined(caller.userId, authority, table, app)
  const ruled = table.rowLevelPermissions?.read?.when !== undefined && ctx?.isUnrestricted !== true
  return {
    role: authority.role,
    groups: authority.groups,
    readsTable: passesTablePermission(app, table, 'read', authority),
    rowReadable: ruled ? (row) => recordPassesReadPredicate(table, row, ctx) : undefined,
  }
}

/**
 * The tool refusal for a failed write. A unique conflict over a value the
 * caller could not read on every record holding it answers as a write out of
 * her reach does — `Resource not found` — exactly as the records API answers it.
 */
async function refusalOf(
  write: { readonly session: UserSession; readonly domainContext: DomainContext },
  conflict: {
    readonly scope: McpConflictScope
    readonly fields: Readonly<Record<string, unknown>>
  },
  failure: unknown,
  excludeIds: readonly string[]
): Promise<never> {
  const sanitized = sanitizeError(failure)
  const message = sanitized.message ?? sanitized.error
  if (!isUniqueConflictAnswer(sanitized)) {
    return toolFailure(-32_603, message)
  }
  const { app, table } = conflict.scope
  const answer = await runOnDomain(
    write.domainContext,
    uniqueConflictAnswerProgram({
      ...{ session: write.session, app, table },
      write: { written: [conflict.fields], excludeIds },
      reader: await conflictReaderOf(conflict.scope),
    })
  )
  return toolFailure(-32_603, answer === 'conflict' ? message : 'Resource not found')
}

/** Run one record-echoing write on the domain services and answer it as a tool result. */
async function answerRecordWrite<A, E>(
  write: McpRecordWrite & { readonly recordId?: string },
  program: Effect.Effect<A, E, DomainServices>,
  format: (success: A) => unknown
): Promise<McpToolResult> {
  const outcome = await runOnDomain(write.domainContext, Effect.result(program))
  if (outcome._tag === 'Failure') {
    const conflict = { scope: write.conflictScope, fields: write.fields }
    return refusalOf(write, conflict, outcome.failure, write.recordId ? [write.recordId] : [])
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
  return answerRecordWrite(input, program, (record) => input.formatSuccess({ ...record }))
}

/** One MCP update, as the records API would run it, answered as a tool result. */
export async function runMcpRecordUpdate(
  input: McpRecordWrite & { readonly recordId: string }
): Promise<McpToolResult> {
  const program = updateRecordWithSideEffects({
    ...{ session: input.session, app: input.app, tableName: input.tableName },
    ...{ recordId: input.recordId, fields: input.fields, userRole: input.userRole },
    requester: recordWriteRequester(input.session.userId, input.userRole),
    userGroups: input.userGroups,
    linkReader: input.linkReader,
    isSqlite: isSqliteRuntime(),
    processEnv: process.env,
    forgetDerivedVariants: evictTransformCacheForKey,
  })
  return answerRecordWrite(input, program, (updated) =>
    updated === undefined ? undefined : input.formatSuccess({ ...updated })
  )
}

/** One MCP delete — to the trash, as the records API's DELETE — answered as a tool result. */
export async function runMcpRecordDelete(
  input: McpWriteScope & { readonly recordId: string; readonly userRole: string }
): Promise<McpToolResult> {
  const program = deleteRecordWithSideEffects({
    ...{ session: input.session, app: input.app, tableName: input.tableName },
    recordId: input.recordId,
    requester: recordWriteRequester(input.session.userId, input.userRole),
    mode: 'soft',
    processEnv: process.env,
    forgetDerivedVariants: evictTransformCacheForKey,
  })
  const outcome = await runOnDomain(input.domainContext, Effect.result(program))
  if (outcome._tag === 'Success') return toolSuccess(outcome.success)
  const sanitized = sanitizeError(outcome.failure)
  return toolFailure(-32_603, sanitized.message ?? sanitized.error)
}
