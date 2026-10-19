/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Cause, Effect, Option } from 'effect'
import {
  isStorageObjectNotFound,
  StorageService,
  UNATTRIBUTED_BUCKET,
} from '@/application/ports/services/storage-service'
import {
  attachmentFieldsOf,
  bucketForField,
} from '@/application/use-cases/attachments/attachment-fields'
import {
  resolveDownloadBucket,
  resolveUploadBucket,
} from '@/application/use-cases/buckets/resolve-bucket'
import { getUserRole } from '@/application/use-cases/tables/user-role'
import { isChatAttachmentKey } from '@/domain/kernel/identity/storage-key'
import { isGuestSession } from '@/domain/models/app/auth/guest-session'
import { NO_GRANT_ROLE } from '@/domain/models/app/auth/permission-evaluation'
import { isAdminEquivalent } from '@/domain/models/app/auth/roles'
import {
  permitsBucketFileDelete,
  permitsBucketFileRead,
  type BucketFileCaller,
} from '@/domain/models/app/buckets/bucket-file-access-validation'
import {
  mayReplaceOrRemoveObject,
  ownershipGovernsAction,
} from '@/domain/models/app/buckets/object-ownership-validation'
import {
  isFilePublic,
  resolveStoragePublicAccess,
  type StoragePublicAccess,
} from '@/domain/models/process-env/storage/storage-public-access'
import { logError } from '@/infrastructure/logging/logger'
import { CALLER_REFUSAL } from './record-caller-gate'
import type { AutomationContext } from './shared'
import type { AuthRepository } from '@/application/ports/repositories/auth/auth-repository'
import type { StorageError } from '@/application/ports/services/storage-service'
import type { App } from '@/domain/models/app'

/**
 * A STORED FILE NAMED BY KEY, IN A RUN SOMEONE STARTED BY HAND.
 *
 * Keys are flat: a step that names one reaches the file whatever bucket holds
 * it. In a run nobody started that is the configuration's choice. In a run a
 * person started, the key may be one she typed, so the run reaches a stored
 * file only as she may. One check runs before any byte is read, written, sent
 * or removed:
 *
 * - an admin-equivalent starter (the built-in `admin`, or the app's top role)
 *   reads every record, field and bucket, so her gate is open, as for a run
 *   nobody started, and a key nothing holds keeps the operator's own error;
 * - for anyone else, a key nothing is stored under is refused (a signed
 *   download link checks no existence of its own, and "not found" must read as
 *   the refusal does);
 * - then {@link starterMayReach} decides.
 *
 * Every refusal answers the records API's `Resource not found`. A storage or
 * role outage refuses: an unjudged key is never read.
 */

/** What a gate needs: the store it reads, and the account that started the run. */
export type StarterGateRequirements = StorageService | AuthRepository

/** Whether a run may read `key`: `undefined` when it may, else the refusal to answer. */
export type StarterFileGate = (
  key: string
) => Effect.Effect<string | undefined, never, StarterGateRequirements>

/** What a gate answers for a key the run may read: no refusal. */
const NO_REFUSAL: string | undefined = undefined

/**
 * How a run's starter stands before its stored files: `open` for a run nobody
 * started and for an admin-equivalent starter; `judged` for anyone else, with
 * who she is to the files API (`undefined`: nobody signed in — a guest's
 * press, or a hand-started run that no longer names its starter).
 */
export type StarterStanding =
  | { readonly kind: 'open' }
  | { readonly kind: 'judged'; readonly caller: BucketFileCaller | undefined }

const OPEN: StarterStanding = { kind: 'open' }

/** The role a starter is judged on; a role that cannot be read grants nothing. */
const starterRole = (app: App, userId: string) =>
  getUserRole(userId, app).pipe(
    Effect.tapCause((cause) =>
      Effect.sync(() => logError('[automations] a starter role could not be read', cause))
    ),
    // effect-swallow: an unreadable role is judged as no role at all, which only narrows what the run reaches; logged just above.
    Effect.orElseSucceed(() => NO_GRANT_ROLE)
  )

/** Who started `automation`'s run, as its stored files see her. */
export const starterStanding = (
  app: App,
  automation: AutomationContext
): Effect.Effect<StarterStanding, never, AuthRepository> =>
  Effect.gen(function* () {
    if (automation.startedByHand !== true) return OPEN
    const { userId } = automation
    if (userId === undefined || isGuestSession(userId)) {
      return { kind: 'judged', caller: undefined } as const
    }
    const role = yield* starterRole(app, userId)
    if (isAdminEquivalent(role, app)) return OPEN
    return { kind: 'judged', caller: { role } } as const
  }).pipe(Effect.withSpan('automations.starter-standing'))

/** Every bucket a table's attachment field stores into. */
const attachmentFieldBuckets = (app: App): ReadonlySet<string> =>
  new Set(
    (app.tables ?? []).flatMap((table) => {
      const scope = { app, tableName: table.name }
      return attachmentFieldsOf(scope).map((field) => bucketForField(scope, field.name))
    })
  )

/** Whether a failed storage read is the ordinary "nothing stored there" answer. */
const isMiss = (cause: Cause.Cause<StorageError>): boolean => {
  const error = Cause.findErrorOption(cause)
  return Option.isSome(error) && isStorageObjectNotFound(error.value)
}

/** Log a storage read that failed for a reason other than a missing object. */
export const reportOutage = (key: string) => (cause: Cause.Cause<StorageError>) =>
  isMiss(cause)
    ? Effect.void
    : Effect.sync(() =>
        logError('[automations] a stored file could not be judged for its starter', cause, {
          'sovrium.storage.key': key,
        })
      )

/** Whether anything is stored under `key`; a store that cannot answer answers no. */
const isStored = (storage: Effect.Success<typeof StorageService>, key: string) =>
  storage.statObject(key).pipe(
    Effect.tapCause(reportOutage(key)),
    Effect.as(true),
    // effect-swallow: a miss is the ordinary answer and an outage was logged just above; both refuse.
    Effect.orElseSucceed(() => false)
  )

/** The catalog row of `key`: `undefined` when it has none, `null` when it could not be read. */
const catalogRow = (storage: Effect.Success<typeof StorageService>, key: string) =>
  storage.getMetadata(key, UNATTRIBUTED_BUCKET).pipe(
    Effect.map(
      (meta): { readonly bucket?: string; readonly uploadedBy?: string } | undefined => meta
    ),
    Effect.tapCause(reportOutage(key)),
    // effect-swallow: no catalog row means no bucket (an out-of-band key); an outage was logged above and refuses.
    Effect.catch((error) => Effect.succeed(isStorageObjectNotFound(error) ? undefined : null))
  )

/** The bucket the catalog records `key` in; `null` when the catalog could not be read. */
export const catalogBucket = (storage: Effect.Success<typeof StorageService>, key: string) =>
  catalogRow(storage, key).pipe(
    Effect.map((row) => (row === null ? null : row?.bucket)),
    Effect.withSpan('automations.catalog-bucket')
  )

/** The operator's public storage paths, as the files API reads them; `undefined` when unreadable. */
const publicStorageAccess = (): StoragePublicAccess | undefined => {
  try {
    return resolveStoragePublicAccess()
  } catch (error) {
    // Boot refuses a malformed value, so this is not expected; it refuses, never opens.
    logError('[automations] the public storage paths could not be read', error)
    return undefined
  }
}

/** A stored file as the catalog records it: its key, and its bucket when it has one. */
export interface CatalogEntry {
  readonly key: string
  readonly bucket: string | undefined
}

/**
 * Whether the files API would serve `entry` to `caller`. A bucket the
 * configuration no longer declares serves no one.
 */
const bucketServes = (
  app: App,
  entry: { readonly key: string; readonly bucket: string },
  caller: BucketFileCaller | undefined
): boolean => {
  const bucket = resolveDownloadBucket(app, entry.bucket)
  const publicAccess = publicStorageAccess()
  return (
    bucket !== undefined &&
    publicAccess !== undefined &&
    permitsBucketFileRead(bucket, caller, {
      app,
      keyIsPublic: isFilePublic(publicAccess, entry.key),
    })
  )
}

/**
 * THE one decision: may the person who started `automation`'s run, standing as
 * `standing`, reach the stored file `entry`?
 *
 * Always when her standing is open (a run nobody started, an admin starter) or
 * the catalog records no bucket. Otherwise when this run wrote the file
 * (`writtenFiles`) or, unless it is a chat attachment, read its key from a
 * record she may read (`readFiles`), each in that very bucket; failing those,
 * only when no table's attachment
 * field stores into the bucket (`system` for a field that names none) AND the
 * bucket's `download` admits her as the files API judges it. Every gated road
 * asks here, so a wider rule is written here alone.
 */
export const starterMayReach = (
  app: App,
  automation: AutomationContext,
  entry: CatalogEntry,
  standing: StarterStanding
): boolean => {
  if (standing.kind === 'open') return true
  const { bucket, key } = entry
  if (bucket === undefined) return true
  if (automation.writtenFiles?.has(bucket, key) === true) return true
  // A chat attachment is its uploader's alone, served by the chat's own route.
  if (isChatAttachmentKey(key)) return false
  if (automation.readFiles?.has(bucket, key) === true) return true
  return (
    !attachmentFieldBuckets(app).has(bucket) && bucketServes(app, { key, bucket }, standing.caller)
  )
}

/**
 * The gate of `automation`'s run: open unless someone who is not
 * admin-equivalent started it by hand; then a key nothing is stored under, a
 * catalog that cannot be read and a file {@link starterMayReach} refuses all
 * answer the refusal.
 */
export const starterFileGate =
  (app: App, automation: AutomationContext): StarterFileGate =>
  (key) =>
    Effect.gen(function* () {
      const standing = yield* starterStanding(app, automation)
      if (standing.kind === 'open') return NO_REFUSAL
      const storage = yield* StorageService
      if (!(yield* isStored(storage, key))) return CALLER_REFUSAL
      const bucket = yield* catalogBucket(storage, key)
      if (bucket === null) return CALLER_REFUSAL
      return starterMayReach(app, automation, { key, bucket }, standing)
        ? NO_REFUSAL
        : CALLER_REFUSAL
    }).pipe(Effect.withSpan('automations.starter-file-gate'))

/** The first refusal among `keys`, or `undefined` when the run may read them all. */
export const firstStarterRefusal = (
  gate: StarterFileGate,
  keys: readonly string[]
): Effect.Effect<string | undefined, never, StarterGateRequirements> =>
  Effect.reduce(
    keys,
    (): string | undefined => undefined,
    (found, key) => (found === undefined ? gate(key) : Effect.succeed(found))
  ).pipe(Effect.withSpan('automations.first-starter-refusal'))

/**
 * THE removal decision: may the person who started `automation`'s run remove
 * the stored file `entry`? Removing is not reading, so a key the run read from
 * a record admits no removal. Always when her standing is open, or when this
 * run wrote the file (in its bucket, or in none). Never a chat attachment, a
 * file in a table attachment field's bucket, or a file no catalog row records.
 * Otherwise the bucket's `delete` rung decides as the files API judges it, and
 * an undeclared `delete` in an app with sign-in admits only the file's
 * recorded uploader.
 */
export const starterMayRemove = (
  app: App,
  automation: AutomationContext,
  entry: CatalogEntry & { readonly uploadedBy: string | undefined },
  standing: StarterStanding
): boolean => {
  if (standing.kind === 'open') return true
  const { bucket, key } = entry
  if (automation.writtenFiles?.has(bucket ?? UNATTRIBUTED_BUCKET, key) === true) return true
  if (bucket === undefined || isChatAttachmentKey(key)) return false
  if (attachmentFieldBuckets(app).has(bucket)) return false
  return filesApiMayDelete(app, automation.userId, { ...entry, bucket }, standing.caller)
}

/** Whether the files API lets `caller` (`userId`) delete `entry` from its declared bucket. */
const filesApiMayDelete = (
  app: App,
  userId: string | undefined,
  entry: { readonly bucket: string; readonly uploadedBy: string | undefined },
  caller: BucketFileCaller | undefined
): boolean => {
  const declared = resolveUploadBucket(app, entry.bucket)
  if (declared === undefined || !permitsBucketFileDelete(declared, caller, { app })) return false
  const { permissions } = declared
  const appHasAuth = app.auth !== undefined
  if (!ownershipGovernsAction({ permissions, action: 'delete', appHasAuth })) return true
  return (
    userId !== undefined &&
    mayReplaceOrRemoveObject({
      uploadedBy: entry.uploadedBy,
      callerId: userId,
      callerIsAdmin: false,
    })
  )
}

/**
 * The removal gate of `automation`'s run: whether it may remove the file at
 * `key` (`file/delete`, the source of `file/move`). Open as
 * {@link starterFileGate} is; otherwise a key nothing holds, a catalog that
 * cannot be read and a file {@link starterMayRemove} refuses all answer the refusal.
 */
export const starterRemovalGate =
  (app: App, automation: AutomationContext): StarterFileGate =>
  (key) =>
    Effect.gen(function* () {
      const standing = yield* starterStanding(app, automation)
      if (standing.kind === 'open') return NO_REFUSAL
      const storage = yield* StorageService
      if (!(yield* isStored(storage, key))) return CALLER_REFUSAL
      const row = yield* catalogRow(storage, key)
      if (row === null) return CALLER_REFUSAL
      const entry = { key, bucket: row?.bucket, uploadedBy: row?.uploadedBy }
      return starterMayRemove(app, automation, entry, standing) ? NO_REFUSAL : CALLER_REFUSAL
    }).pipe(Effect.withSpan('automations.starter-removal-gate'))
