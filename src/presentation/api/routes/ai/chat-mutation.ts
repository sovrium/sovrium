/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Effect } from 'effect'
import {
  deleteDynamicRecords,
  insertDynamicRecord,
  countDynamicRecords,
  updateAllDynamicRecords,
  updateDynamicRecordById,
} from '@/application/use-cases/ai/dynamic-record-query'
import { isAdminRole } from '@/domain/models/shared/permissions'
import {
  evaluateFieldPermissions,
  hasCreatePermission,
  hasDeletePermission,
  hasUpdatePermission,
} from '@/domain/validators/permission-evaluators'
import { provideDynamicRecordRepoLive } from '@/presentation/api/routes/ai/effect-runner'
import { recordActivityLogRow } from './chat-activity-log'
import type { ChatAction } from '@/domain/models/api/ai/chat'
import type { TableFieldPermissions } from '@/domain/models/app/tables/permissions'
import type {
  MutationIntent,
  MutationTable,
} from '@/domain/services/ai-chat/ai-chat-mutation-parser'

export interface PendingConfirmation {
  readonly action: string
  readonly table: string
  readonly affectedCount: number
  readonly description: string
  readonly confirmationToken: string
}

export type MutationOutcome =
  | { readonly status: 'forbidden'; readonly message: string }
  | { readonly status: 'validation-error'; readonly message: string }
  | { readonly status: 'pending'; readonly pendingConfirmation: PendingConfirmation }
  | {
      readonly status: 'applied'
      readonly actions: ReadonlyArray<ChatAction>
      readonly summary: string
    }

export interface ApplyMutationInput {
  readonly intent: MutationIntent
  readonly userRole: string
  readonly userEmail: string
  readonly tables: ReadonlyArray<MutationTable & { readonly permissions?: unknown }>
}


interface StoredConfirmation {
  readonly intent: MutationIntent
  readonly userRole: string
  readonly userEmail: string
  readonly tables: ReadonlyArray<MutationTable & { readonly permissions?: unknown }>
}

const pendingConfirmations = new Map<string, StoredConfirmation>()

export const consumeConfirmation = (token: string): StoredConfirmation | undefined => {
  const stored = pendingConfirmations.get(token)
  if (stored !== undefined) {
    pendingConfirmations.delete(token)
  }
  return stored
}


const EMAIL_FORMAT_RE = /^[\w.+-]+@[\w-]+\.[\w.-]+$/

const validateCreateData = (
  table: MutationTable,
  data: Readonly<Record<string, unknown>>
): string | undefined => {
  const emailViolation = table.fields.find(
    (field) =>
      field.type === 'email' &&
      typeof data[field.name] === 'string' &&
      !EMAIL_FORMAT_RE.test(data[field.name] as string)
  )
  if (emailViolation !== undefined) {
    return `Validation failed: the value for "${emailViolation.name}" is an invalid email format — the mutation was not applied.`
  }
  const missingRequired = table.fields.find(
    (field) => field.required === true && data[field.name] === undefined
  )
  if (missingRequired !== undefined) {
    return `Validation failed: the required field "${missingRequired.name}" is missing — the mutation was not applied.`
  }
  return undefined
}


const extractFieldPermissions = (permissions: unknown): TableFieldPermissions | undefined => {
  if (permissions === null || typeof permissions !== 'object') return undefined
  const { fields } = permissions as { readonly fields?: unknown }
  return Array.isArray(fields) ? (fields as TableFieldPermissions) : undefined
}

const findForbiddenWriteField = (
  permissions: unknown,
  userRole: string,
  data: Readonly<Record<string, unknown>>
): string | undefined => {
  const fieldPerms = extractFieldPermissions(permissions)
  if (fieldPerms === undefined) return undefined
  const evaluated = evaluateFieldPermissions(fieldPerms, userRole, isAdminRole(userRole))
  return Object.keys(data).find((fieldName) => {
    const perm = evaluated[fieldName]
    return perm !== undefined && !perm.write
  })
}


const countRows = async (
  tableName: string,
  filter?: { readonly column: string; readonly value: string }
): Promise<number> =>
  Effect.runPromise(
    countDynamicRecords({ table: tableName, filter }).pipe(provideDynamicRecordRepoLive)
  )

const insertRow = async (
  tableName: string,
  data: Readonly<Record<string, unknown>>
): Promise<number | string> =>
  Effect.runPromise(
    insertDynamicRecord({ table: tableName, data }).pipe(provideDynamicRecordRepoLive)
  )

const updateRowById = async (
  tableName: string,
  recordId: number,
  data: Readonly<Record<string, unknown>>
): Promise<boolean> =>
  Effect.runPromise(
    updateDynamicRecordById({ table: tableName, recordId, data }).pipe(provideDynamicRecordRepoLive)
  )

const updateAllRows = async (
  tableName: string,
  data: Readonly<Record<string, unknown>>
): Promise<ReadonlyArray<number>> =>
  Effect.runPromise(
    updateAllDynamicRecords({ table: tableName, data }).pipe(provideDynamicRecordRepoLive)
  )

const deleteRows = async (
  tableName: string,
  filter?: { readonly column: string; readonly value: string }
): Promise<ReadonlyArray<number>> =>
  Effect.runPromise(
    deleteDynamicRecords({ table: tableName, filter }).pipe(provideDynamicRecordRepoLive)
  )


const logMutation = async (tableName: string, userEmail: string): Promise<void> =>
  recordActivityLogRow({
    actorType: 'user',
    actorName: userEmail,
    action: 'ai.chat.mutation',
    targetTable: tableName,
    userEmail,
  })


const resolveTable = (
  input: ApplyMutationInput
): (MutationTable & { readonly permissions?: unknown }) | undefined =>
  input.tables.find((table) => table.name === input.intent.table)

const applyCreate = async (
  input: ApplyMutationInput,
  table: MutationTable & { readonly permissions?: unknown }
): Promise<MutationOutcome> => {
  if (input.intent.kind !== 'create') return { status: 'forbidden', message: 'Unsupported intent.' }
  if (!hasCreatePermission(table as { name: string }, input.userRole)) {
    return {
      status: 'forbidden',
      message: `You do not have permission to create records in "${table.name}".`,
    }
  }
  const forbiddenField = findForbiddenWriteField(
    table.permissions,
    input.userRole,
    input.intent.data
  )
  if (forbiddenField !== undefined) {
    return {
      status: 'forbidden',
      message: `You do not have permission to modify the "${forbiddenField}" field in "${table.name}".`,
    }
  }
  const validationError = validateCreateData(table, input.intent.data)
  if (validationError !== undefined) {
    return { status: 'validation-error', message: validationError }
  }
  const recordId = await insertRow(table.name, input.intent.data)
  await logMutation(table.name, input.userEmail)
  const detail = Object.values(input.intent.data).filter((v) => typeof v === 'string')
  return {
    status: 'applied',
    actions: [
      {
        type: 'create',
        table: table.name,
        recordId,
        description: `Created a record in "${table.name}".`,
      },
    ],
    summary:
      detail.length > 0
        ? `Created a new ${table.name} record: ${detail.join(', ')}.`
        : `Created a new record in "${table.name}".`,
  }
}

const applyUpdateById = async (
  input: ApplyMutationInput,
  tableName: string,
  recordId: number,
  data: Readonly<Record<string, unknown>>
): Promise<MutationOutcome> => {
  const updated = await updateRowById(tableName, recordId, data)
  if (!updated) {
    return {
      status: 'validation-error',
      message: `No record #${String(recordId)} found in "${tableName}".`,
    }
  }
  await logMutation(tableName, input.userEmail)
  return {
    status: 'applied',
    actions: [
      {
        type: 'update',
        table: tableName,
        recordId,
        description: `Updated record #${String(recordId)} in "${tableName}".`,
      },
    ],
    summary: `Updated record #${String(recordId)} in "${tableName}".`,
  }
}

const applyUpdateAll = async (
  userEmail: string,
  tableName: string,
  data: Readonly<Record<string, unknown>>
): Promise<MutationOutcome> => {
  const ids = await updateAllRows(tableName, data)
  await logMutation(tableName, userEmail)
  return {
    status: 'applied',
    actions: ids.map((id) => ({
      type: 'update' as const,
      table: tableName,
      recordId: id,
      description: `Updated record #${String(id)} in "${tableName}".`,
    })),
    summary: `Updated ${String(ids.length)} record(s) in "${tableName}".`,
  }
}

const applyUpdate = async (
  input: ApplyMutationInput,
  table: MutationTable & { readonly permissions?: unknown }
): Promise<MutationOutcome> => {
  if (input.intent.kind !== 'update') return { status: 'forbidden', message: 'Unsupported intent.' }
  if (!hasUpdatePermission(table as { name: string }, input.userRole)) {
    return {
      status: 'forbidden',
      message: `You do not have permission to update records in "${table.name}".`,
    }
  }
  const { data, bulk, recordId } = input.intent
  if (Object.keys(data).length === 0) {
    return {
      status: 'validation-error',
      message: `I could not determine which fields to change in "${table.name}". Please specify the new values.`,
    }
  }
  const forbiddenField = findForbiddenWriteField(table.permissions, input.userRole, data)
  if (forbiddenField !== undefined) {
    return {
      status: 'forbidden',
      message: `You do not have permission to modify the "${forbiddenField}" field in "${table.name}".`,
    }
  }
  if (bulk) {
    const affectedCount = await countRows(table.name)
    if (affectedCount >= 2) {
      return {
        status: 'pending',
        pendingConfirmation: stashConfirmation(input, 'bulk update', affectedCount),
      }
    }
  }
  return recordId !== undefined
    ? applyUpdateById(input, table.name, recordId, data)
    : applyUpdateAll(input.userEmail, table.name, data)
}

const applyDelete = async (
  input: ApplyMutationInput,
  table: MutationTable & { readonly permissions?: unknown }
): Promise<MutationOutcome> => {
  if (input.intent.kind !== 'delete') return { status: 'forbidden', message: 'Unsupported intent.' }
  if (!hasDeletePermission(table as { name: string }, input.userRole)) {
    return {
      status: 'forbidden',
      message: `You do not have permission to delete records in "${table.name}".`,
    }
  }
  const affectedCount = await countRows(table.name, input.intent.filter)
  return {
    status: 'pending',
    pendingConfirmation: stashConfirmation(input, 'delete', Math.max(affectedCount, 1)),
  }
}

const stashConfirmation = (
  input: ApplyMutationInput,
  action: string,
  affectedCount: number
): PendingConfirmation => {
  const confirmationToken = crypto.randomUUID()
  pendingConfirmations.set(confirmationToken, {
    intent: input.intent,
    userRole: input.userRole,
    userEmail: input.userEmail,
    tables: input.tables,
  })
  return {
    action,
    table: input.intent.table,
    affectedCount,
    description: `This ${action} will affect ${String(affectedCount)} record(s) in "${input.intent.table}". Reply "yes" to confirm or "no" to cancel.`,
    confirmationToken,
  }
}


export const applyMutation = async (input: ApplyMutationInput): Promise<MutationOutcome> => {
  const table = resolveTable(input)
  if (table === undefined) {
    return { status: 'forbidden', message: `Unknown table "${input.intent.table}".` }
  }
  switch (input.intent.kind) {
    case 'create':
      return applyCreate(input, table)
    case 'update':
      return applyUpdate(input, table)
    case 'delete':
      return applyDelete(input, table)
  }
}

export const commitConfirmedMutation = async (
  stored: StoredConfirmation
): Promise<MutationOutcome> => {
  const table = stored.tables.find((t) => t.name === stored.intent.table)
  if (table === undefined) {
    return { status: 'forbidden', message: `Unknown table "${stored.intent.table}".` }
  }
  const input: ApplyMutationInput = {
    intent: stored.intent,
    userRole: stored.userRole,
    userEmail: stored.userEmail,
    tables: stored.tables,
  }
  if (stored.intent.kind === 'delete') {
    const ids = await deleteRows(table.name, stored.intent.filter)
    await logMutation(table.name, stored.userEmail)
    return {
      status: 'applied',
      actions: ids.map((id) => ({
        type: 'delete' as const,
        table: table.name,
        recordId: id,
        description: `Deleted record #${String(id)} from "${table.name}".`,
      })),
      summary: `Deleted ${String(ids.length)} record(s) from "${table.name}".`,
    }
  }
  const ids = await updateAllRows(
    table.name,
    input.intent.kind === 'update' ? input.intent.data : {}
  )
  await logMutation(table.name, stored.userEmail)
  return {
    status: 'applied',
    actions: ids.map((id) => ({
      type: 'update' as const,
      table: table.name,
      recordId: id,
      description: `Updated record #${String(id)} in "${table.name}".`,
    })),
    summary: `Updated ${String(ids.length)} record(s) in "${table.name}".`,
  }
}
