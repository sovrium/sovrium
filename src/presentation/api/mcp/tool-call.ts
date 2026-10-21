/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * MCP `tools/call` dispatcher (the AI MCP server RBAC requirement, M-6).
 *
 * Translates a JSON-RPC `tools/call` request into the same application-layer
 * programs that the HTTP record handlers run, so RBAC, field-level read /
 * write permissions, Z-3 row-level enforcement, and soft-delete semantics
 * all flow through one authorization pipeline.
 *
 * Tool naming convention compiled by `mcp-routes.ts#compileMcpTools`:
 *   `{appName}_{tableName}_{operation}` where operation ∈ {read, list, create, update, delete}
 *
 * Error model — JSON-RPC 2.0 error codes mapped to authorization outcomes:
 *   -32601 method not found  → unknown tool name
 *   -32602 invalid params    → field-level write permission denied; bad shape
 *   -32603 internal error    → role/operation gate denied (RBAC); runtime fault
 */

import { listRecordsAsCaller } from '@/application/use-cases/tables/list-records-as-caller'
import {
  buildReadListFilter,
  recordPassesReadPredicate,
} from '@/application/use-cases/tables/permissions/row-level-read-filter'
import { createGetRecordProgram } from '@/application/use-cases/tables/read-record-programs'
import { isGuestSession } from '@/domain/models/app/auth/guest-session'
import { isRecordKeyShaped } from '@/domain/models/app/tables/record-id-service'
import { handleActionCall, resolveActionTemplateTool } from './action-call'
import { handleAutomationCall, resolveAutomationTool } from './automation-call'
import {
  findFirstFieldWriteViolation,
  passesTablePermission,
  type CallerAuthority,
} from './caller-authority'
import { resolveUserContextOrUndefined } from './caller-row-context'
import { callerMayNotList, createIsInScope, existingRowIsInScope } from './row-level-write-gate'
import {
  isReadOperation,
  listedTableFor,
  resolveTableAuthority,
  resolveTableTool,
  synthesizeSession,
  type ListedTable,
  type ResolvedTool,
} from './table-tool-reach'
import {
  applyMcpFieldExposureToRecord,
  applyMcpFieldExposureToRecords,
  toolFailure,
  toolSuccess,
  type McpToolResult,
  runProgramAsToolResult,
} from './tool-call-helpers'
import { runMcpRecordCreate, runMcpRecordDelete, runMcpRecordUpdate } from './write-calls'
import { applyCreateRules, applyUpdateRules, refuseLockedRecord } from './write-tool-rules'
import type { McpCaller } from './auth'
import type { UserSession } from '@/application/ports/contracts/user-session'
import type { LinkReader } from '@/application/use-cases/tables/linked-row-visibility'
import type { App, Table } from '@/domain/models/app'
import type { AiAccessOperation } from '@/domain/models/app/auth/ai-access'
import type { DomainContext } from '@/infrastructure/logging/request-effect'

interface CallEnvelope {
  readonly toolName: string
  readonly args: Record<string, unknown>
}

/**
 * Entry point for the MCP `tools/call` handler. Returns a Hono Response
 * carrying a JSON-RPC envelope (success or error). Never throws — every
 * authorization or runtime fault collapses to a structured -32603 error so
 * the client always sees a parseable JSON-RPC body.
 */
export async function handleToolsCall(
  app: App,
  caller: McpCaller,
  envelope: CallEnvelope,
  domainContext: DomainContext
): Promise<McpToolResult> {
  // M-8: Manual-trigger automation tools take precedence over the
  // table-record dispatcher because the `_automation_` infix is
  // unambiguous (table tools end in one of the 5 CRUD operation
  // suffixes; automation tools live under a dedicated infix).
  const automation = resolveAutomationTool(app, envelope.toolName)
  if (automation !== undefined) {
    return handleAutomationCall({ app, caller, automation, envelope, domainContext })
  }

  // M-9: Action-template tools share the same infix-based separation as
  // automation tools. The `_action_` infix is unambiguous against table
  // tools (which always end in a CRUD operation suffix), so the order of
  // these two prefix probes is incidental — kept symmetric with M-8 so
  // each dispatcher's resolver has the first chance to claim a tool name
  // it owns.
  const template = resolveActionTemplateTool(app, envelope.toolName)
  if (template !== undefined) {
    // `tools/list` withholds every action from a viewer (an action is a side
    // effect by definition); a hand-named call is refused the same way, since
    // an action template declares no role gate of its own.
    if (caller.role === 'viewer') {
      return toolFailure(-32_603, "Operation 'action' is not permitted for the viewer role")
    }
    return handleActionCall({ app, caller, template, envelope, domainContext })
  }

  const resolved = resolveTableTool(app, envelope.toolName)
  if (resolved === undefined) return toolNotFound(envelope.toolName)

  const opGateError = checkOperationGate(resolved.table, resolved.operation, caller.role)
  if (opGateError !== undefined) {
    return toolFailure(-32_603, opGateError)
  }

  const authority = await resolveTableAuthority(app, caller, resolved.table, domainContext)
  // A read tool of a table her records list would answer as one that does not
  // exist is not offered her, and a call naming it answers as an unknown tool.
  const listed = isReadOperation(resolved.operation)
    ? await listedTableFor(app, resolved.table, caller, { domainContext, authority })
    : undefined
  if (isReadOperation(resolved.operation) && listed === undefined) {
    return toolNotFound(envelope.toolName)
  }
  if (!passesTablePermission(app, resolved.table, resolved.operation, authority)) {
    // The records API's own refusal, byte for byte: a caller the table does not
    // admit learns nothing from MCP that it would not learn from REST.
    return toolFailure(-32_603, 'Resource not found')
  }

  return executeTool({ app, caller, authority, envelope, resolved, listed, domainContext })
}

/** The answer to a call naming a tool the caller is not offered or the server does not have. */
const toolNotFound = (toolName: string): McpToolResult =>
  toolFailure(-32_601, `Tool not found: ${toolName}`)

/**
 * RBAC role-gate at the operation level. Mirrors `filterToolsForRole` in
 * `mcp-routes.ts` (which hides destructive tools from viewers in
 * `tools/list`) but enforced again at `tools/call` time so a viewer who
 * crafts the tool name by hand still gets a -32603 instead of a 200.
 */
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
  readonly app: App
  readonly caller: McpCaller
  readonly authority: CallerAuthority
  readonly envelope: CallEnvelope
  readonly resolved: ResolvedTool
  /** The read tools' proof that the records list answers the caller ({@link listedTableFor}). */
  readonly listed: ListedTable | undefined
  readonly domainContext: DomainContext
}

/**
 * Dispatch the resolved (table, operation) pair to the matching application
 * program. Each branch wraps the program in `provideTableLive` and converts
 * thrown / Either errors into JSON-RPC -32603. Authorization-time errors
 * (field-write violation, scoped-row-out-of-bounds, soft-deleted) bubble
 * up as -32602 / -32603 per the user-story spec.
 */
async function executeTool(input: ExecuteToolInput): Promise<McpToolResult> {
  const { app, caller, authority, envelope, resolved, listed, domainContext } = input
  const { operation, table } = resolved
  const session = synthesizeSession(caller.userId)
  const branch = { app, caller, authority, envelope, table, session, domainContext }

  // No read runs without the proof: absent, the call answers as an unknown tool.
  if (isReadOperation(operation)) {
    if (listed === undefined) return toolNotFound(envelope.toolName)
    if (operation === 'list') return executeList(branch, listed)
    refuseUnshapedRecordId(app, table, envelope)
    return executeRead(branch, listed)
  }
  if (operation === 'create') return executeCreate(branch)
  refuseUnshapedRecordId(app, table, envelope)
  if (operation === 'update') return executeUpdate(branch)
  return executeDelete(branch)
}

/** An id no key of the table could hold names no record, as the records API answers it. */
const refuseUnshapedRecordId = (app: App, table: Table, envelope: CallEnvelope): void => {
  const recordId = envelope.args['id']
  const spelled = typeof recordId === 'number' ? String(recordId) : recordId
  const scope = app.auth?.scopeTables
  if (typeof spelled === 'string' && spelled !== '' && !isRecordKeyShaped(spelled, table, scope)) {
    toolFailure(-32_603, RECORD_NOT_FOUND)
  }
}

interface ExecBranchInput {
  readonly app: App
  readonly caller: McpCaller
  readonly authority: CallerAuthority
  readonly envelope: CallEnvelope
  readonly table: Table
  readonly session: UserSession
  readonly domainContext: DomainContext
}

/**
 * The list tool. `listed` is required: the empty-page answers below are a
 * table's own answer to a reader its list admits, never a refused table's.
 */
async function executeList(input: ExecBranchInput, listed: ListedTable): Promise<McpToolResult> {
  const { app, caller, authority, envelope, session } = input
  const { table } = listed
  const limitArg = envelope.args['limit']
  const limit = typeof limitArg === 'number' ? limitArg : undefined
  const offsetArg = envelope.args['offset']
  const offset = typeof offsetArg === 'number' ? offsetArg : undefined

  const userCtx = await resolveUserContextOrUndefined(caller.userId, authority, table, app)
  const filter = buildReadListFilter(table, userCtx)
  if (filter === 'empty') {
    return toolSuccess([])
  }
  if (filter === 'reject') {
    return toolSuccess([])
  }

  return runProgramAsToolResult({
    program: listRecordsAsCaller({
      app,
      tableName: table.name,
      session,
      role: authority.role,
      groups: authority.groups,
      rowFilter: filter,
      limit,
      offset,
    }),
    formatSuccess: (out) => {
      const records = (out as { records?: ReadonlyArray<Record<string, unknown>> }).records ?? []
      // M-10: Apply schema-author-declared field-exposure whitelist on top
      // of the per-role RBAC filter that already ran in `processRecords`.
      // Pass-through for `'all'` and `'permissioned'` modes — RBAC is the
      // only narrowing in those modes.
      return applyMcpFieldExposureToRecords(records, table)
    },
  })
}

async function executeRead(input: ExecBranchInput, listed: ListedTable): Promise<McpToolResult> {
  const { app, caller, authority, envelope, session } = input
  const { table } = listed
  const recordId = String(envelope.args['id'] ?? '')
  if (!recordId) {
    return toolFailure(-32_602, "Missing 'id' parameter")
  }

  const userCtx = await resolveUserContextOrUndefined(caller.userId, authority, table, app)
  return runProgramAsToolResult({
    program: createGetRecordProgram({
      session,
      tableName: table.name,
      recordId,
      app,
      userRole: authority.role,
      userGroups: authority.groups,
    }),
    formatSuccess: (out) => {
      const record = out as Record<string, unknown>
      if (!recordPassesReadPredicate(table, record, userCtx)) return undefined
      // M-10: Strip non-whitelisted fields from both the nested `fields`
      // object and the root flat-spread aliases when whitelist mode is on.
      return applyMcpFieldExposureToRecord(record, table)
    },
    notFoundResult: undefined,
  })
}

async function executeCreate(input: ExecBranchInput): Promise<McpToolResult> {
  const { app, caller, authority, envelope, table, session } = input
  const requested = checkWritePermissions(input, extractFields(envelope.args))
  const fields = await applyCreateRules(ruleInput(input), requested)

  // The records API evaluates `create.when` on the validated row and refuses an
  // out-of-scope one with 404; a note filed under someone else's name is
  // refused here the same way, before anything is written.
  const userCtx = await resolveUserContextOrUndefined(caller.userId, authority, table, app)
  if (!createIsInScope(table, fields, userCtx)) {
    return toolFailure(-32_603, RECORD_NOT_FOUND)
  }

  return runMcpRecordCreate({
    ...{ app, session, tableName: table.name, fields, userRole: authority.role },
    ...{ userGroups: authority.groups, linkReader: linkReaderOf(input) },
    ...{ domainContext: input.domainContext, conflictScope: input },
    // The echoed record answers to the same whitelist a read does: a write
    // naming only whitelisted fields must not hand back the rest of the row.
    formatSuccess: (out) => applyMcpFieldExposureToRecord(out, table),
  })
}

async function executeUpdate(input: ExecBranchInput): Promise<McpToolResult> {
  const { app, authority, envelope, table, session } = input
  const recordId = String(envelope.args['id'] ?? '')
  if (!recordId) {
    return toolFailure(-32_602, "Missing 'id' parameter")
  }
  // Row scope first, as the records API does: a caller learns nothing about a
  // row it may not write — not its values, not which of its fields it could
  // have touched — nor about any row of a table she may not read.
  // A record her list of the table does not admit answers as a missing one.
  const change = extractFields(envelope.args)
  if (
    !readsTable(input) ||
    (await mayNotList(input, recordId)) ||
    !(await rowIsInScope(input, recordId, 'write', change))
  )
    return toolFailure(-32_603, RECORD_NOT_FOUND)
  await refuseLockedRecord(table, session, recordId, app)
  const requested = checkWritePermissions(input, change)
  const fields = await applyUpdateRules(ruleInput(input), requested)

  return runMcpRecordUpdate({
    ...{ app, session, tableName: table.name, recordId, fields, userRole: authority.role },
    ...{ userGroups: authority.groups, linkReader: linkReaderOf(input) },
    ...{ domainContext: input.domainContext, conflictScope: input },
    formatSuccess: (out) => applyMcpFieldExposureToRecord(out, table),
  })
}

async function executeDelete(input: ExecBranchInput): Promise<McpToolResult> {
  const { app, authority, envelope, table, session } = input
  const recordId = String(envelope.args['id'] ?? '')
  if (!recordId) {
    return toolFailure(-32_602, "Missing 'id' parameter")
  }
  // A table the caller may not read answers as a record that does not exist.
  if (!readsTable(input)) return toolSuccess(MISSING_RECORD_DELETE)
  // A record her list of the table does not admit answers as a missing one.
  if ((await mayNotList(input, recordId)) || !(await rowIsInScope(input, recordId, 'delete')))
    return toolFailure(-32_603, RECORD_NOT_FOUND)
  return runMcpRecordDelete({
    ...{ app, session, tableName: table.name, recordId, userRole: authority.role },
    domainContext: input.domainContext,
  })
}

/** The records API's refusal for anything out of the caller's reach. */
const RECORD_NOT_FOUND = 'Resource not found'

/** What a delete answers for a record that does not exist. */
const MISSING_RECORD_DELETE = { success: false, setNullPerformed: false, restrictViolation: false }

/** Whether the caller's list of the table does not admit the record (`callerMayNotList`). */
const mayNotList = (input: ExecBranchInput, recordId: string) =>
  callerMayNotList({
    ...{ app: input.app, table: input.table, reader: linkReaderOf(input), recordId },
    domainContext: input.domainContext,
  })

/**
 * Whether the caller reads the table at all. A write on a stored record of a
 * table she may not read answers exactly as one on a missing record, and
 * nothing is written — as on the records API.
 */
const readsTable = (input: ExecBranchInput): boolean =>
  passesTablePermission(input.app, input.table, 'read', input.authority)

/**
 * Whether the caller may write or delete the row: readable under its
 * row-level rules, and inside the operation's own rule.
 */
async function rowIsInScope(
  input: ExecBranchInput,
  recordId: string,
  op: 'write' | 'delete',
  change?: Readonly<Record<string, unknown>>
): Promise<boolean> {
  const { app, caller, authority, table, session } = input
  const ctx = await resolveUserContextOrUndefined(caller.userId, authority, table, app)
  return existingRowIsInScope({ app, table, session, recordId, ctx, op, change })
}

/**
 * The permission rules a write tool enforces before the value rules, in the
 * records API's order: the MCP whitelist, then field-level write permission
 * under the caller's full authority (role and groups). Throws the first
 * violation as a JSON-RPC error; returns the requested values.
 */
function checkWritePermissions(
  input: ExecBranchInput,
  fields: Readonly<Record<string, unknown>>
): Readonly<Record<string, unknown>> {
  const { app, authority, table } = input
  const whitelistError = findFirstWhitelistViolation(table, fields)
  if (whitelistError !== undefined) {
    return toolFailure(-32_602, `Field '${whitelistError}' is not in aiAccess.whitelistFields`)
  }
  const writeError = findFirstFieldWriteViolation(app, table, authority, fields)
  if (writeError !== undefined) {
    return toolFailure(-32_602, `Cannot write to field '${writeError}': insufficient permissions`)
  }
  return fields
}

/**
 * Whose read rules judge the rows a write links to: the caller's full
 * authority, groups included, exactly as the records API judges them.
 */
const linkReaderOf = (input: ExecBranchInput): LinkReader => ({
  session: input.session,
  role: input.authority.role,
  groups: input.authority.groups,
})

/** What the records API's value rules are keyed on for this call. */
const ruleInput = (input: ExecBranchInput) => ({
  app: input.app,
  table: input.table,
  userRole: input.authority.role,
  userGroups: input.authority.groups,
  signedOut: isGuestSession(input.session.userId),
  writerId: input.caller.userId,
  domainContext: input.domainContext,
})

/**
 * When `aiAccess.fieldExposure: 'whitelist'` is set, reject any payload that
 * references a field outside `aiAccess.whitelistFields`. Returns the first
 * non-whitelisted field name, or `undefined` when the table has no whitelist
 * declared (other exposure modes pass through unchanged).
 */
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

/**
 * Extract the JSON-RPC params payload as a plain field map. Accepts either
 * `{ data: { ... } }` (canonical shape advertised in the input schema) or
 * a flat `{ field: value, ... }` shape (more ergonomic for AI-generated
 * payloads). The flat shape strips the `id` key (used as the path param).
 */
function extractFields(args: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> {
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
