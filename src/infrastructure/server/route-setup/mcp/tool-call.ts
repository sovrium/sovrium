/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Effect } from 'effect'
import { type Context } from 'hono'
import {
  collectAssignmentScopeTables,
  loadCurrentUserContext,
  toSessionProjection,
} from '@/application/use-cases/tables/permissions/row-level-enforcement'
import {
  createGetRecordProgram,
  createListRecordsProgram,
  createRecordProgram,
  deleteRecordProgram,
  updateRecordProgram,
} from '@/application/use-cases/tables/programs'
import { isAdminEquivalent } from '@/domain/models/app/auth/roles'
import { hasPermission } from '@/domain/models/app/tables/permissions'
import { isAiAccessEnabled } from '@/domain/models/shared/ai-access'
import {
  evaluateRecordAgainstPredicate,
  isPredicateGroup,
  projectPredicateToFilter,
  projectWhenToFilter,
  type CurrentUserContext,
  type RowLevelFilterNode,
} from '@/domain/validators/row-level-evaluator'
import { provideTableLive } from '@/infrastructure/layers/table-layer'
import { handleActionCall, resolveActionTemplateTool } from './action-call'
import { handleAutomationCall, resolveAutomationTool } from './automation-call'
import {
  applyMcpFieldExposureToRecord,
  applyMcpFieldExposureToRecords,
  jsonRpcError,
  jsonRpcSuccess,
  runProgramAsToolResult,
} from './tool-call-helpers'
import type { McpCaller } from './auth'
import type { UserSession } from '@/application/ports/models/user-session'
import type { App, Table } from '@/domain/models/app'
import type { AiAccess, AiAccessOperation } from '@/domain/models/shared/ai-access'

const SUPPORTED_OPERATIONS: ReadonlySet<AiAccessOperation> = new Set([
  'read',
  'list',
  'create',
  'update',
  'delete',
])

interface CallEnvelope {
  readonly toolName: string
  readonly args: Record<string, unknown>
  readonly responseId: number | string
}

interface ResolvedTool {
  readonly table: Table
  readonly operation: AiAccessOperation
}

export async function handleToolsCall(
  c: Readonly<Context>,
  app: App,
  caller: McpCaller,
  envelope: CallEnvelope
): Promise<Response> {
  const automation = resolveAutomationTool(app, envelope.toolName)
  if (automation !== undefined) {
    return handleAutomationCall({ c, app, caller, automation, envelope })
  }

  const template = resolveActionTemplateTool(app, envelope.toolName)
  if (template !== undefined) {
    return handleActionCall({ c, app, caller, template, envelope })
  }

  const resolved = resolveTool(app, envelope.toolName)
  if (resolved === undefined) {
    return jsonRpcError(c, envelope.responseId, -32_601, `Tool not found: ${envelope.toolName}`)
  }

  const opGateError = checkOperationGate(resolved.table, resolved.operation, caller.role)
  if (opGateError !== undefined) {
    return jsonRpcError(c, envelope.responseId, -32_603, opGateError)
  }

  return executeTool({ c, app, caller, envelope, resolved })
}

function resolveTool(app: App, toolName: string): ResolvedTool | undefined {
  const prefix = `${app.name}_`
  if (!toolName.startsWith(prefix)) return undefined
  const remainder = toolName.slice(prefix.length)
  const lastUnderscore = remainder.lastIndexOf('_')
  if (lastUnderscore <= 0) return undefined

  const operation = remainder.slice(lastUnderscore + 1) as AiAccessOperation
  if (!SUPPORTED_OPERATIONS.has(operation)) return undefined

  const tableName = remainder.slice(0, lastUnderscore)
  const table = (app.tables ?? []).find((t) => t.name === tableName)
  if (table === undefined) return undefined
  if (!isAiAccessEnabled(table.aiAccess)) return undefined
  if (!isOperationAllowedByAiAccess(table.aiAccess, operation)) return undefined
  return { table, operation }
}

function isOperationAllowedByAiAccess(
  access: AiAccess | undefined,
  operation: AiAccessOperation
): boolean {
  if (access === undefined || typeof access === 'boolean') return true
  if (access.operations === undefined) return true
  return access.operations.includes(operation)
}

function checkOperationGate(
  _table: Table,
  operation: AiAccessOperation,
  role: McpCaller['role']
): string | undefined {
  if (role !== 'viewer') return undefined
  if (operation === 'create' || operation === 'update' || operation === 'delete') {
    return `Operation '${operation}' is not permitted for the viewer role`
  }
  return undefined
}

interface ExecuteToolInput {
  readonly c: Readonly<Context>
  readonly app: App
  readonly caller: McpCaller
  readonly envelope: CallEnvelope
  readonly resolved: ResolvedTool
}

async function executeTool(input: ExecuteToolInput): Promise<Response> {
  const { c, app, caller, envelope, resolved } = input
  const { operation, table } = resolved
  const session = synthesizeSession(caller.userId)

  if (operation === 'list') {
    return executeList({ c, app, caller, envelope, table, session })
  }
  if (operation === 'read') {
    return executeRead({ c, app, caller, envelope, table, session })
  }
  if (operation === 'create') {
    return executeCreate({ c, app, caller, envelope, table, session })
  }
  if (operation === 'update') {
    return executeUpdate({ c, app, caller, envelope, table, session })
  }
  return executeDelete({ c, app, caller, envelope, table, session })
}

interface ExecBranchInput {
  readonly c: Readonly<Context>
  readonly app: App
  readonly caller: McpCaller
  readonly envelope: CallEnvelope
  readonly table: Table
  readonly session: UserSession
}

async function executeList(input: ExecBranchInput): Promise<Response> {
  const { c, app, caller, envelope, table, session } = input
  const limitArg = envelope.args['limit']
  const limit = typeof limitArg === 'number' ? limitArg : undefined
  const offsetArg = envelope.args['offset']
  const offset = typeof offsetArg === 'number' ? offsetArg : undefined

  const userCtx = await resolveUserContextOrUndefined(caller, table, app)
  const filter = buildReadListFilter(table, userCtx)
  if (filter === 'empty') {
    return jsonRpcSuccess(c, envelope.responseId, [])
  }
  if (filter === 'reject') {
    return jsonRpcSuccess(c, envelope.responseId, [])
  }

  return runProgramAsToolResult({
    c,
    responseId: envelope.responseId,
    program: createListRecordsProgram({
      session,
      tableName: table.name,
      app,
      userRole: caller.role,
      filter: filter ?? undefined,
      limit,
      offset,
    }),
    formatSuccess: (out) => {
      const records = (out as { records?: ReadonlyArray<Record<string, unknown>> }).records ?? []
      return applyMcpFieldExposureToRecords(records, table)
    },
  })
}

async function executeRead(input: ExecBranchInput): Promise<Response> {
  const { c, app, caller, envelope, table, session } = input
  const recordId = String(envelope.args['id'] ?? '')
  if (!recordId) {
    return jsonRpcError(c, envelope.responseId, -32_602, "Missing 'id' parameter")
  }

  const userCtx = await resolveUserContextOrUndefined(caller, table, app)
  return runProgramAsToolResult({
    c,
    responseId: envelope.responseId,
    program: createGetRecordProgram({
      session,
      tableName: table.name,
      recordId,
      app,
      userRole: caller.role,
    }),
    formatSuccess: (out) => {
      const record = out as Record<string, unknown>
      if (!recordPassesReadPredicate(table, record, userCtx)) return undefined
      return applyMcpFieldExposureToRecord(record, table)
    },
    notFoundResult: undefined,
  })
}

async function executeCreate(input: ExecBranchInput): Promise<Response> {
  const { c, app, caller, envelope, table, session } = input
  const fields = extractFields(envelope.args)
  const whitelistError = findFirstWhitelistViolation(table, fields)
  if (whitelistError !== undefined) {
    return jsonRpcError(
      c,
      envelope.responseId,
      -32_602,
      `Field '${whitelistError}' is not in aiAccess.whitelistFields`
    )
  }
  const writeError = findFirstFieldWriteViolation(table, caller.role, fields)
  if (writeError !== undefined) {
    return jsonRpcError(
      c,
      envelope.responseId,
      -32_602,
      `Cannot write to field '${writeError}': insufficient permissions`
    )
  }

  return runProgramAsToolResult({
    c,
    responseId: envelope.responseId,
    program: createRecordProgram({
      session,
      tableName: table.name,
      fields,
      app,
      userRole: caller.role,
    }),
  })
}

async function executeUpdate(input: ExecBranchInput): Promise<Response> {
  const { c, app, caller, envelope, table, session } = input
  const recordId = String(envelope.args['id'] ?? '')
  if (!recordId) {
    return jsonRpcError(c, envelope.responseId, -32_602, "Missing 'id' parameter")
  }
  const fields = extractFields(envelope.args)
  const whitelistError = findFirstWhitelistViolation(table, fields)
  if (whitelistError !== undefined) {
    return jsonRpcError(
      c,
      envelope.responseId,
      -32_602,
      `Field '${whitelistError}' is not in aiAccess.whitelistFields`
    )
  }
  const writeError = findFirstFieldWriteViolation(table, caller.role, fields)
  if (writeError !== undefined) {
    return jsonRpcError(
      c,
      envelope.responseId,
      -32_602,
      `Cannot write to field '${writeError}': insufficient permissions`
    )
  }

  return runProgramAsToolResult({
    c,
    responseId: envelope.responseId,
    program: updateRecordProgram(session, table.name, recordId, {
      fields,
      app,
      userRole: caller.role,
    }),
  })
}

async function executeDelete(input: ExecBranchInput): Promise<Response> {
  const { c, app, envelope, table, session } = input
  const recordId = String(envelope.args['id'] ?? '')
  if (!recordId) {
    return jsonRpcError(c, envelope.responseId, -32_602, "Missing 'id' parameter")
  }
  return runProgramAsToolResult({
    c,
    responseId: envelope.responseId,
    program: deleteRecordProgram(session, table.name, recordId, app),
  })
}

function findFirstFieldWriteViolation(
  table: Table,
  role: McpCaller['role'],
  fields: Readonly<Record<string, unknown>>
): string | undefined {
  const fieldPerms = table.permissions?.fields
  if (!fieldPerms) return undefined
  return Object.keys(fields).find((fieldName) => {
    const fieldPermission = fieldPerms.find((fp) => fp.field === fieldName)
    return fieldPermission?.write !== undefined && !hasPermission(fieldPermission.write, role)
  })
}

function findFirstWhitelistViolation(
  table: Table,
  fields: Readonly<Record<string, unknown>>
): string | undefined {
  const access = table.aiAccess
  if (typeof access !== 'object') return undefined
  if (access.fieldExposure !== 'whitelist') return undefined
  const allowed = new Set(access.whitelistFields ?? [])
  return Object.keys(fields).find((fieldName) => !allowed.has(fieldName))
}

function extractFields(args: Readonly<Record<string, unknown>>): Record<string, unknown> {
  const { data } = args
  if (isPlainObject(data)) {
    return { ...data }
  }
  const { id: _id, limit: _limit, offset: _offset, ...rest } = args
  return rest
}

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== 'object') return false
  if (value === undefined) return false
  if (value === null) return false
  return !Array.isArray(value)
}

function synthesizeSession(userId: string | undefined): UserSession {
  const now = new Date()
  return {
    id: 'mcp-session',
    userId: userId ?? '',
    token: 'mcp-bearer',
    expiresAt: now,
    createdAt: now,
    updatedAt: now,
    ipAddress: null,
    userAgent: null,
    impersonatedBy: null,
    activeOrganizationId: null,
  }
}

function projectSingleTripleReadFilter(
  predicate: Parameters<typeof projectPredicateToFilter>[0],
  ctx: CurrentUserContext
): 'empty' | 'reject' | { readonly and: readonly RowLevelFilterNode[] } {
  const projected = projectPredicateToFilter(predicate, ctx)
  if (!projected) return 'reject'
  const isEmptyIn =
    projected.operator === 'in' && Array.isArray(projected.value) && projected.value.length === 0
  return isEmptyIn ? 'empty' : { and: [projected] }
}

function buildReadListFilter(
  table: Table,
  ctx: CurrentUserContext | undefined
): undefined | 'empty' | 'reject' | { readonly and: readonly RowLevelFilterNode[] } {
  const rlp = table.rowLevelPermissions
  if (!rlp?.read?.when) return undefined
  if (!ctx || ctx.isUnrestricted) return undefined

  if (isPredicateGroup(rlp.read.when)) {
    const node = projectWhenToFilter(rlp.read.when, ctx)
    return node ? { and: [node] } : 'reject'
  }

  return projectSingleTripleReadFilter(rlp.read.when, ctx)
}

function recordPassesReadPredicate(
  table: Table,
  record: Readonly<Record<string, unknown>>,
  ctx: CurrentUserContext | undefined
): boolean {
  const predicate = table.rowLevelPermissions?.read?.when
  if (!predicate) return true
  if (!ctx || ctx.isUnrestricted) return true
  return evaluateRecordAgainstPredicate(record, predicate, ctx)
}

async function resolveUserContextOrUndefined(
  caller: McpCaller,
  table: Table,
  app: App
): Promise<CurrentUserContext | undefined> {
  if (!caller.userId) return undefined
  const projection = toSessionProjection(
    { userId: caller.userId },
    { role: caller.role, isUnrestricted: isAdminEquivalent(caller.role, app) }
  )
  const scopeTables = collectAssignmentScopeTables(table.rowLevelPermissions)
  return Effect.runPromise(provideTableLive(loadCurrentUserContext(projection, scopeTables)))
}
