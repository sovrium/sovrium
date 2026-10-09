/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The attachment-reference rule on an automation's record writes.
 *
 * A record step that writes a storage key into an attachment column is held to
 * the rule a write through the records API is held to
 * (`validateAttachmentReferences`): the key must name a file catalogued in the
 * column's own bucket, and the writer must be allowed to download it. The
 * writer is the person the step writes as — the triggering person under
 * `runAs: 'triggering-user'`, the starter of a run started by hand. A step that
 * writes as nobody may reference only a file its own run stored in the
 * column's bucket (`run-written-files.ts`): any key that existed before the
 * run is refused, with the same message.
 *
 * A refused reference fails the step with the records API's one message, and
 * nothing is written: the check runs before any row is touched.
 *
 * An inline `{ name, content }` value is stored as a file, as the records API
 * stores one ({@link admitAttachments}): in the column's bucket, recorded as
 * uploaded by the person the step writes as (by nobody when it writes as the
 * app), held to the bucket's and the column's upload rules, and the column
 * then holds the key. A value the rules refuse fails the step.
 */

import { Effect } from 'effect'
import { AuthRepository } from '@/application/ports/repositories/auth/auth-repository'
import { uploadInlineAttachmentContent } from '@/application/use-cases/attachments/upload-inline-attachments'
import {
  validateAttachmentReferences,
  type AttachmentWriter,
} from '@/application/use-cases/attachments/validate-attachment-references'
import { SYSTEM_USER_ID } from '@/domain/models/app/auth/guest-session'
import { resolveStoragePublicAccess } from '@/domain/models/process-env/storage/storage-public-access'
import { recordInlineStored, type RunWrittenFiles } from './run-written-files'
import type { StorageService } from '@/application/ports/services/storage-service'
import type { CallerWriteRequest } from '@/application/use-cases/tables/permissions/caller-write-authority'
import type { App } from '@/domain/models/app'

/** A run with no ledger stored nothing: its nobody-writer may reference no existing key. */
const NOTHING_WRITTEN: RunWrittenFiles = { record: () => undefined, has: () => false }

/**
 * Who a step writing as `actorId` is judged as: the app for the durable system
 * actor — admitted only the files `written` records — otherwise that person
 * with their resolved role. A role that cannot be read is no role at all,
 * which can only narrow what they may reference.
 */
const writerFor = (
  actorId: string,
  written: RunWrittenFiles = NOTHING_WRITTEN
): Effect.Effect<AttachmentWriter, never, AuthRepository> =>
  actorId === SYSTEM_USER_ID
    ? Effect.succeed({ authenticated: true, app: { wroteThisRun: written.has } })
    : Effect.gen(function* () {
        const auth = yield* AuthRepository
        // effect-swallow: an unreadable role reads as no role, which narrows the writer's reach.
        const role = yield* auth.getUserRole(actorId).pipe(Effect.orElseSucceed(() => undefined))
        return role === undefined ? { authenticated: true } : { authenticated: true, role }
      })

/** The values a write request carries, or none for a delete. */
const valuesOf = (request: CallerWriteRequest): Readonly<Record<string, unknown>> | undefined =>
  request.op === 'create' ? request.fields : request.op === 'update' ? request.change : undefined

/**
 * The failed outcome for a step whose writes reference a file the rule
 * refuses, or `undefined` when every reference is admissible. A catalog that
 * cannot be read fails the step too: an unjudged reference is never written.
 */
export const attachmentRefusal = (input: {
  readonly app: App
  readonly actorId: string
  readonly requests: readonly CallerWriteRequest[]
  /** The files the step's run stored so far; absent, a nobody-writer may name none. */
  readonly written?: RunWrittenFiles | undefined
}): Effect.Effect<
  { readonly status: 'failure'; readonly error: string } | undefined,
  never,
  AuthRepository | StorageService
> =>
  Effect.gen(function* () {
    const writer = yield* writerFor(input.actorId, input.written)
    const publicAccess = resolveStoragePublicAccess()
    const checks = input.requests.flatMap((request) => {
      const fields = valuesOf(request)
      return fields === undefined ? [] : [{ tableName: request.tableName, fields }]
    })
    const verdicts = yield* Effect.forEach(checks, ({ tableName, fields }) =>
      validateAttachmentReferences({
        scope: { app: input.app, tableName },
        fields,
        writer,
        publicAccess,
      }).pipe(
        Effect.as(undefined),
        Effect.catch((refused) => Effect.succeed(refused.message))
      )
    )
    const error = verdicts.find((verdict) => verdict !== undefined)
    return error === undefined ? undefined : ({ status: 'failure', error } as const)
  }).pipe(Effect.withSpan('automations.attachment-refusal'))

/** A step's write once its attachments are judged: the values to write, or why it fails. */
export type AttachmentAdmission =
  | { readonly status: 'failure'; readonly error: string }
  | { readonly status: 'admitted'; readonly values: Record<string, unknown> }

/**
 * Judge the references a step's write carries ({@link attachmentRefusal}),
 * then store its inline `{ name, content }` values in their columns' buckets.
 * `values` is the payload `requests` write; what comes back in its place holds
 * each stored file's key where the inline value stood.
 */
export const admitAttachments = (input: {
  readonly app: App
  readonly actorId: string
  readonly tableName: string
  readonly values: Readonly<Record<string, unknown>>
  readonly requests: readonly CallerWriteRequest[]
  readonly written?: RunWrittenFiles | undefined
}): Effect.Effect<AttachmentAdmission, never, AuthRepository | StorageService> =>
  Effect.gen(function* () {
    const refused = yield* attachmentRefusal(input)
    if (refused !== undefined) return refused
    const writer = input.actorId === SYSTEM_USER_ID ? {} : { writerId: input.actorId }
    const scope = { app: input.app, tableName: input.tableName, ...writer }
    return yield* uploadInlineAttachmentContent({ scope, fields: { ...input.values } }).pipe(
      // A file stored from an inline value is this run's: a later step may attach it again.
      Effect.tap((stored) =>
        Effect.sync(() =>
          recordInlineStored(input.written, { scope, supplied: input.values, stored })
        )
      ),
      Effect.map((values): AttachmentAdmission => ({ status: 'admitted', values })),
      Effect.catch((error) =>
        Effect.succeed<AttachmentAdmission>({ status: 'failure', error: error.message })
      )
    )
  }).pipe(Effect.withSpan('automations.admit-attachments'))
