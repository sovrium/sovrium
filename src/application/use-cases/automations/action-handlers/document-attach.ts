/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { TableRepository } from '@/application/ports/repositories/tables/table-repository'
import { StorageService } from '@/application/ports/services/storage-service'
import { SYSTEM_BUCKET_NAME } from '@/domain/models/app/buckets/bucket-identity'
import { resolveFieldBucket } from '@/domain/models/app/buckets/field-bucket'
import { logError } from '@/infrastructure/logging/logger'
import { validateAttachmentConstraints } from '../../attachments/validate-attachment-constraints'
import { buildSyntheticSession } from '../build-guest-session'
import { attachmentCells, attachmentColumnKind, attachmentKey } from './document-file-ref'
import { GeneratedFileWriteError } from './document-output-error'
import { type Raw } from './document-run'
import { writerActorOf } from './record-caller-gate'
import { updateAndAnnounce } from './record-events'
import type { ActionRunContext, AutomationContext } from './shared'
import type { StepRequirements } from '../run/types'
import type { UserSession } from '@/application/ports/contracts/user-session'
import type { App } from '@/domain/models/app'

/**
 * `output.attachTo`: put a generated file — already written into the field's
 * bucket — into a record's attachment field.
 *
 * The write goes through the same record-update program the records API uses,
 * under the automation's writer, and runs the field's own attachment rules
 * (`allowedFileTypes`, `maxFileSize`, `maxFiles`). The file the step just
 * wrote is its own upload, so the "may only reference files you uploaded"
 * rule of the presentation roads does not apply to it. `replace` deletes the
 * files it swaps out unless a record — in any table, in a single or a list
 * cell — still names them, and keeps them when that cannot be answered.
 */

const refuse = (message: string): Effect.Effect<never, GeneratedFileWriteError> =>
  Effect.fail(new GeneratedFileWriteError({ message }))

interface AttachTarget {
  readonly table: string
  readonly field: string
  readonly recordId: string
  readonly multiple: boolean
  readonly mode: 'append' | 'replace'
}

/** The declared mode, else the field's default: append to a list, replace a single file. */
const attachModeOf = (declared: unknown, multiple: boolean): 'append' | 'replace' => {
  if (declared === 'append' || declared === 'replace') return declared
  return multiple ? 'append' : 'replace'
}

/** Where `attachTo` writes, with its mode defaulted by the field, or why it cannot. */
const attachTargetOf = (app: App, attachTo: Raw): AttachTarget | string => {
  const table = String(attachTo['table'] ?? '')
  const field = String(attachTo['field'] ?? '')
  const recordId = String(attachTo['record'] ?? '')
  const multiple = attachmentColumnKind(app, table, field, 'attachTo')
  if (typeof multiple === 'string') return multiple
  if (recordId === '') return 'attachTo names no record'
  const mode = attachModeOf(attachTo['mode'], multiple)
  if (mode === 'append' && !multiple) {
    return `attachTo mode append needs a multiple-attachments field, not ${table}.${field}`
  }
  return { table, field, recordId, multiple, mode }
}

/** The field's cells now, read under the writer's session. */
const currentCells = (target: AttachTarget, session: Readonly<UserSession>) =>
  Effect.gen(function* () {
    const repo = yield* TableRepository
    const row = yield* repo.getRecord(session, target.table, target.recordId).pipe(
      Effect.mapError(
        () =>
          new GeneratedFileWriteError({
            message: `record ${target.recordId} of ${target.table} could not be read`,
          })
      )
    )
    if (row === null) {
      return yield* refuse(
        `attachTo names record ${target.recordId} of ${target.table}, which does not exist`
      )
    }
    return attachmentCells(row[target.field])
  })

/** Run the field's own rules over the new value, then write it as a record update. */
const writeField = (input: {
  readonly target: AttachTarget
  readonly value: unknown
  readonly session: ReturnType<typeof buildSyntheticSession>
  readonly app: App
  readonly runContext: ActionRunContext | undefined
}) =>
  Effect.gen(function* () {
    const { target, value, app } = input
    yield* validateAttachmentConstraints({
      scope: { app, tableName: target.table },
      fields: { [target.field]: value },
    }).pipe(
      Effect.mapError(
        (violation) =>
          new GeneratedFileWriteError({ message: `cannot attach the output: ${violation.message}` })
      )
    )
    yield* updateAndAnnounce({
      session: input.session,
      tableName: target.table,
      recordId: target.recordId,
      fields: { [target.field]: value },
      runContext: input.runContext,
      app,
    }).pipe(
      Effect.mapError(
        (error) =>
          new GeneratedFileWriteError({
            message: `the output could not be attached to record ${target.recordId} of ${target.table}: ${error instanceof Error ? error.message : String(error)}`,
          })
      )
    )
  })

/**
 * Delete the files a `replace` swapped out, keeping any a record still names.
 * The record just written no longer holds them in this field, so ANY cell that
 * names one — another table, a list, another field of this record — keeps it;
 * a check that cannot answer keeps it too.
 */
const deleteReplaced = (input: {
  readonly keys: readonly string[]
  readonly target: AttachTarget
  readonly app: App
}) => {
  const { target, app } = input
  const bucket = resolveFieldBucket(app, target.table, target.field) ?? SYSTEM_BUCKET_NAME
  return Effect.forEach(
    input.keys,
    (key) =>
      Effect.gen(function* () {
        const named = yield* (yield* TableRepository).isFileNamedByAnyRecord(app, key).pipe(
          Effect.tapCause((cause) =>
            Effect.sync(() =>
              logError('[automations] could not check who still names a replaced file', cause, {
                key,
              })
            )
          ),
          // effect-swallow: an unanswered check keeps the file — deleting one a record still names is the loss to avoid.
          Effect.orElseSucceed(() => true)
        )
        if (named) return
        const storage = yield* StorageService
        yield* storage['delete'](key, bucket)
      }).pipe(
        Effect.tapCause((cause) =>
          Effect.sync(() =>
            logError('[automations] could not delete a replaced attachment', cause, { key })
          )
        ),
        // effect-swallow: the record already holds the new file; a replaced file that cannot be removed is left (and logged), not a failed step.
        Effect.ignoreCause
      ),
    { discard: true }
  )
}

/** Attach the generated file at `key` to the record `attachTo` names. */
export const attachGeneratedFile = (input: {
  readonly attachTo: Raw
  readonly key: string
  readonly app: App
  readonly automation: AutomationContext
  readonly runContext: ActionRunContext | undefined
}): Effect.Effect<void, GeneratedFileWriteError, StepRequirements> =>
  Effect.gen(function* () {
    const { app, key } = input
    const target = attachTargetOf(app, input.attachTo)
    if (typeof target === 'string') return yield* refuse(target)
    const session = buildSyntheticSession(writerActorOf(input.automation))
    const before = yield* currentCells(target, session)
    const value = !target.multiple ? key : target.mode === 'append' ? [...before, key] : [key]
    yield* writeField({ target, value, session, app, runContext: input.runContext })
    if (target.mode !== 'replace') return
    const replaced = before
      .map(attachmentKey)
      .filter((old): old is string => old !== undefined && old !== key)
    yield* deleteReplaced({ keys: replaced, target, app })
  }).pipe(Effect.withSpan('automations.attach-generated-file'))
