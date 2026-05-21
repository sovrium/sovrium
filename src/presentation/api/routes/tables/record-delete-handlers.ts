/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { TableRepository } from '@/application/ports/repositories/table-repository'
import { StorageService } from '@/application/ports/services/storage-service'
import { triggerRecordEventAutomations } from '@/application/use-cases/automations/trigger-record-event'
import { hasDeletePermission } from '@/application/use-cases/tables/permissions/permissions'
import {
  rawGetRecordProgram,
  restoreRecordProgram,
  deleteRecordProgram,
  permanentlyDeleteRecordProgram,
} from '@/application/use-cases/tables/programs'
import {
  provideTableWithNotificationsAndAutomationsLive,
  runTableProgram,
} from '@/infrastructure/layers/table-layer'
import { publishRecordChange } from '@/infrastructure/realtime/record-change-publisher'
import { StorageServiceLive } from '@/infrastructure/storage/storage-service-live'
import { evictTransformCacheForKey } from '@/infrastructure/storage/transform-cache'
import { triggerTableWebhooks } from '@/infrastructure/webhooks/table-webhook-dispatch'
import { getTableContext } from '@/presentation/api/utils/context-helpers'
import { handleRestoreRecordError } from './error-handlers'
import {
  enforceFormMutationGate,
  enforceRestoreGate,
  passesTableRoleGate,
  recordPassesPredicate,
  resolveGuardForTable,
  type RowLevelGuardContext,
} from './row-level-guard'
import type { App, Table } from '@/domain/models/app'
import type { Context } from 'hono'

type SessionContext = ReturnType<typeof getTableContext>['session']

function fireDeleteWebhooks(
  app: App,
  tableName: string,
  record: Record<string, unknown> | null,
  skip: boolean
): Effect.Effect<void> {
  if (skip || !record) return Effect.void
  return Effect.promise(() =>
    triggerTableWebhooks({
      table: app.tables?.find((t) => t.name === tableName),
      event: 'delete',
      record,
    })
  ).pipe(
    Effect.tap(() =>
      Effect.sync(() =>
        publishRecordChange({
          appId: app.name,
          tableName,
          event: 'delete',
          recordId: (record['id'] as string | number | undefined) ?? '',
        })
      )
    )
  )
}

async function executePermanentDelete({
  session,
  tableName,
  recordId,
  c,
  app,
  userId,
}: {
  readonly session: SessionContext
  readonly tableName: string
  readonly recordId: string
  readonly c: Context
  readonly app: App
  readonly userId?: string
}) {
  const program = Effect.gen(function* () {
    const previous = yield* rawGetRecordProgram(session, tableName, recordId)
    const success = yield* permanentlyDeleteRecordProgram(session, tableName, recordId)
    return { previous, success }
  }).pipe(
    Effect.tap(({ previous, success }) => {
      if (!success || !previous) return Effect.void
      return triggerRecordEventAutomations({
        app,
        tableName,
        event: 'delete',
        record: previous,
        processEnv: process.env,
        userId,
      })
    }),
    Effect.tap(({ previous, success }) => fireDeleteWebhooks(app, tableName, previous, !success))
  )
  const result = await Effect.runPromise(
    Effect.either(provideTableWithNotificationsAndAutomationsLive(program))
  )
  if (result._tag === 'Left' || !result.right.success)
    return c.json({ success: false, message: 'Resource not found', code: 'NOT_FOUND' }, 404)
  return c.json({ success: true }, 200)
}

type SoftDeletePipelineInput = {
  readonly session: SessionContext
  readonly tableName: string
  readonly recordId: string
  readonly app: App
  readonly userId?: string
}

function buildSoftDeleteProgram(input: SoftDeletePipelineInput) {
  const { session, tableName, recordId, app, userId } = input
  return Effect.gen(function* () {
    const previous = yield* rawGetRecordProgram(session, tableName, recordId)
    const result = yield* deleteRecordProgram(session, tableName, recordId, app)
    return { previous, result }
  }).pipe(
    Effect.tap(({ previous, result }) => {
      if (result.restrictViolation || !result.success || !previous) return Effect.void
      return triggerRecordEventAutomations({
        app,
        tableName,
        event: 'delete',
        record: previous,
        processEnv: process.env,
        userId,
      })
    }),
    Effect.tap(({ previous, result }) =>
      fireDeleteWebhooks(app, tableName, previous, result.restrictViolation || !result.success)
    )
  )
}

function softDeleteResultToResponse(
  c: Context,
  result: { restrictViolation: boolean; success: boolean; setNullPerformed: boolean }
): Response {
  if (result.restrictViolation) {
    return c.json(
      {
        success: false,
        message: 'Cannot delete record: child records exist and onDelete is set to restrict',
        code: 'CONFLICT',
      },
      400
    )
  }
  if (!result.success)
    return c.json({ success: false, message: 'Resource not found', code: 'NOT_FOUND' }, 404)
  if (result.setNullPerformed) return c.json({ success: true }, 200)
  return c.body(null, 204)
}

async function executeSoftDelete(input: SoftDeletePipelineInput & { readonly c: Context }) {
  const { c } = input
  const outcome = await Effect.runPromise(
    Effect.either(provideTableWithNotificationsAndAutomationsLive(buildSoftDeleteProgram(input)))
  )
  if (outcome._tag === 'Left')
    return c.json({ success: false, message: 'Resource not found', code: 'NOT_FOUND' }, 404)
  return softDeleteResultToResponse(c, outcome.right.result)
}

const NOT_FOUND_RESPONSE = (c: Context) =>
  c.json({ success: false, message: 'Resource not found', code: 'NOT_FOUND' }, 404)

const FORBIDDEN_DELETE_RESPONSE = (c: Context) =>
  c.json({ success: false, message: 'Resource not found', code: 'NOT_FOUND' }, 404)

interface DeleteGateInput {
  readonly c: Context
  readonly app: App
  readonly table: Table | undefined
  readonly session: ReturnType<typeof getTableContext>['session']
  readonly tableName: string
  readonly userRole: string
  readonly recordId: string
  readonly guard: RowLevelGuardContext | undefined
}

function evaluateDeletePredicates(
  c: Context,
  table: Table,
  guard: RowLevelGuardContext,
  fetchedRecord: Readonly<Record<string, unknown>>
): Response | undefined {
  const rlp = table.rowLevelPermissions
  if (!rlp) return undefined
  if (rlp.read?.when && !recordPassesPredicate(rlp, 'read', fetchedRecord, guard.current)) {
    return NOT_FOUND_RESPONSE(c)
  }
  if (!passesTableRoleGate(table.permissions, 'delete', guard.effectiveRoles)) {
    return FORBIDDEN_DELETE_RESPONSE(c)
  }
  if (rlp.delete?.when && !recordPassesPredicate(rlp, 'delete', fetchedRecord, guard.current)) {
    return NOT_FOUND_RESPONSE(c)
  }
  return undefined
}

function extractAttachmentKey(value: unknown): string | undefined {
  if (typeof value === 'string' && value.length > 0) return value
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>
    if (typeof obj['url'] === 'string') {
      const key = obj['url'].split('/').at(-1)
      if (key && key.length > 0) return key
    }
  }
  return undefined
}

async function checkDeleteGate(input: DeleteGateInput): Promise<Response | undefined> {
  const { c, app, table, session, tableName, userRole, recordId, guard } = input

  if (!guard) {
    if (!hasDeletePermission(table, userRole, app.tables)) return FORBIDDEN_DELETE_RESPONSE(c)
    return undefined
  }

  if (!passesTableRoleGate(table?.permissions, 'read', guard.effectiveRoles)) {
    return NOT_FOUND_RESPONSE(c)
  }

  const fetched = await runTableProgram(rawGetRecordProgram(session, tableName, recordId))
  if (fetched._tag === 'Left' || !fetched.right) return NOT_FOUND_RESPONSE(c)
  if (!table) return NOT_FOUND_RESPONSE(c)

  return evaluateDeletePredicates(c, table, guard, fetched.right)
}

function collectAttachmentKeys(
  record: Record<string, unknown>,
  app: App,
  tableName: string
): readonly string[] {
  const table = app.tables?.find((t) => t.name === tableName)
  if (!table?.fields) return []
  return table.fields
    .filter((f) => f.type === 'single-attachment')
    .map((f) => extractAttachmentKey(record[f.name]))
    .filter((k): k is string => k !== undefined)
}

async function deleteStorageFiles(keys: readonly string[]): Promise<void> {
  return Promise.all(
    keys.map((key) => {
      const program = Effect.gen(function* () {
        const storage = yield* StorageService
        yield* storage['delete'](key)
      })
      return Effect.runPromise(Effect.either(Effect.provide(program, StorageServiceLive))).then(
        () => evictTransformCacheForKey(key)
      )
    })
  ).then(() => undefined)
}

async function isFileKeyReferencedElsewhere(opts: {
  readonly session: SessionContext
  readonly tableName: string
  readonly excludeRecordId: string
  readonly fileKey: string
  readonly attachmentFieldNames: readonly string[]
}): Promise<boolean> {
  const results = await Promise.all(
    opts.attachmentFieldNames.map((fieldName) =>
      runTableProgram(
        Effect.gen(function* () {
          const repo = yield* TableRepository
          return yield* repo.listRecords({
            session: opts.session,
            tableName: opts.tableName,
            filter: { and: [{ field: fieldName, operator: 'eq', value: opts.fileKey }] },
            includeDeleted: true,
          })
        })
      )
    )
  )
  return results.some(
    (result) =>
      result._tag === 'Right' &&
      result.right.some((r) => String(r['id']) !== String(opts.excludeRecordId))
  )
}

async function executePurge({
  session,
  tableName,
  recordId,
  app,
  c,
  userId,
}: {
  readonly session: SessionContext
  readonly tableName: string
  readonly recordId: string
  readonly app: App
  readonly c: Context
  readonly userId?: string
}) {
  const rawResult = await runTableProgram(rawGetRecordProgram(session, tableName, recordId))
  if (rawResult._tag === 'Right' && rawResult.right) {
    const keys = collectAttachmentKeys(rawResult.right, app, tableName)
    const table = app.tables?.find((t) => t.name === tableName)
    const attachmentFieldNames =
      table?.fields?.filter((f) => f.type === 'single-attachment').map((f) => f.name) ?? []
    const keysToDelete = (
      await Promise.all(
        keys.map(async (key) => {
          const referenced = await isFileKeyReferencedElsewhere({
            session,
            tableName,
            excludeRecordId: recordId,
            fileKey: key,
            attachmentFieldNames,
          })
          return referenced ? undefined : key
        })
      )
    ).filter((k): k is string => k !== undefined)
    return deleteStorageFiles(keysToDelete).then(() =>
      executePermanentDelete({ session, tableName, recordId, c, app, userId })
    )
  }
  return executePermanentDelete({ session, tableName, recordId, c, app, userId })
}

export async function handleDeleteRecord(c: Context, app: App) {
  const { session, tableName, userRole } = getTableContext(c)

  const table = app.tables?.find((t) => t.name === tableName)
  const recordId = c.req.param('recordId')!
  const guard = await resolveGuardForTable(session, userRole, table)

  const gateError = await checkDeleteGate({
    c,
    app,
    table,
    session,
    tableName,
    userRole,
    recordId,
    guard,
  })
  if (gateError) return gateError

  const permanent = c.req.query('permanent') === 'true'
  const purge = c.req.query('purge') === 'true'

  if (permanent) {
    if (userRole !== 'admin') {
      return c.json(
        {
          success: false,
          message: 'Resource not found',
          code: 'NOT_FOUND',
        },
        404
      )
    }
    return executePermanentDelete({
      session,
      tableName,
      recordId,
      c,
      app,
      userId: session.userId,
    })
  }

  if (purge) {
    return executePurge({ session, tableName, recordId, app, c, userId: session.userId })
  }

  return executeSoftDelete({ session, tableName, recordId, app, c, userId: session.userId })
}

export async function handleFormDeleteRecord(c: Context, app: App) {
  const { session, tableName, userRole } = getTableContext(c)

  const table = app.tables?.find((t) => t.name === tableName)
  const recordId = c.req.param('recordId')!
  const guard = await resolveGuardForTable(session, userRole, table)

  if (guard) {
    const gateError = await enforceFormMutationGate({
      c,
      table,
      session,
      tableName,
      recordId,
      guard,
      op: 'delete',
    })
    if (gateError) return gateError
  } else if (!hasDeletePermission(table, userRole, app.tables)) {
    return c.json(
      {
        success: false,
        message: 'Resource not found',
        code: 'NOT_FOUND',
      },
      404
    )
  }

  const body = await c.req.parseBody()
  const redirectPath = typeof body['_redirect'] === 'string' ? body['_redirect'] : undefined

  const program = buildSoftDeleteProgram({
    session,
    tableName,
    recordId,
    app,
    userId: session.userId,
  })
  const result = await Effect.runPromise(
    Effect.either(provideTableWithNotificationsAndAutomationsLive(program))
  )

  if (result._tag === 'Left' || !result.right.result.success) {
    return c.json({ success: false, message: 'Resource not found', code: 'NOT_FOUND' }, 404)
  }

  if (redirectPath && redirectPath.startsWith('/')) {
    return c.redirect(redirectPath, 302)
  }

  return c.body(null, 204)
}

export async function handleRestoreRecord(c: Context, app: App) {
  const { session, tableName, userRole } = getTableContext(c)

  const table = app.tables?.find((t) => t.name === tableName)
  const recordId = c.req.param('recordId')!
  const guard = await resolveGuardForTable(session, userRole, table)

  if (guard) {
    const gateError = await enforceRestoreGate({
      c,
      table,
      session,
      tableName,
      recordId,
      guard,
    })
    if (gateError) return gateError
  } else if (!hasDeletePermission(table, userRole, app.tables)) {
    return c.json(
      {
        success: false,
        message: 'Resource not found',
        code: 'NOT_FOUND',
      },
      404
    )
  }

  const result = await runTableProgram(restoreRecordProgram(session, tableName, recordId))

  if (result._tag === 'Left') {
    return handleRestoreRecordError(c, result.left)
  }

  if (!result.right.success) {
    return c.json({ success: false, message: 'Resource not found', code: 'NOT_FOUND' }, 404)
  }

  return c.json(result.right, 200)
}
