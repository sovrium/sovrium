/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Confining the files an attachment column may REFERENCE.
 *
 * Storage keys are not secret — the upload response returns them and the record
 * enricher publishes them — and every reader downstream of a record trusts the
 * keys it carries: the attachment URL, the `storeMetadata` enrichment, the
 * automation `file:*` and `ai:transcribe` steps. So a record write that names a
 * key is a READ of that file by proxy, and it must be held to the rule a direct
 * read is held to.
 *
 * A referenced key is admitted only when all three hold:
 *
 * 1. the storage catalog has a row for it, with a recorded bucket;
 * 2. that bucket is the one the column writes to;
 * 3. the writer may download from that bucket, under the SAME rule the bucket
 *    `GET` route applies — `public` short-circuits, a declared `download` is
 *    enforced with the admin override, an undeclared one requires a session.
 *
 * Every failure is ONE refusal carrying ONE message. The three conditions are
 * all evaluated for every reference — the catalog is read even when the role
 * check has already failed — so neither the wording nor the work done tells a
 * caller whether the file exists.
 *
 * Out of scope by construction: inline `{ name, content }` payloads (the write
 * stores them into the column's bucket itself) and whatever a caller marks as
 * exempt — the multipart form path, whose files were uploaded by the very
 * request being validated. Rows already stored and seeds are never re-read.
 */

import { Data, Effect } from 'effect'
import {
  isStorageObjectNotFound,
  StorageService,
} from '@/application/ports/services/storage-service'
import { resolveUploadBucket } from '@/application/use-cases/buckets/resolve-bucket'
import {
  evaluatePermission,
  grantWhenUndeclared,
  permits,
  SESSION_WITH_UNRESOLVED_ROLE,
} from '@/domain/models/app/auth/permission-evaluation'
import { isFilePublic } from '@/domain/models/process-env/storage/storage-public-access'
import {
  bucketForField,
  extractAttachmentReferences,
  scopedTable,
  type AttachmentScope,
} from './attachment-fields'
import { storageUnavailable } from './errors'
import type { AttachmentStorageUnavailable } from './errors'
import type { StoragePublicAccess } from '@/domain/models/process-env/storage/storage-public-access'

/** The one message every refused reference carries, whatever the reason. */
export const ATTACHMENT_REFERENCE_REFUSAL =
  "Attachment must reference a file uploaded to this field's bucket that you can access"

/** A referenced file failed at least one of the three conditions. */
export class AttachmentReferenceRefused extends Data.TaggedError('AttachmentReferenceRefused')<{
  readonly message: string
  readonly field: string
}> {}

/**
 * Who is writing. `authenticated: false` is an anonymous caller (no session);
 * `role` is the caller's resolved global role when there is a session.
 */
export interface AttachmentWriter {
  readonly authenticated: boolean
  readonly role?: string
}

/**
 * May this writer download `key` from `bucketName`? The bucket `GET` route's
 * rule, restated over the port-free domain evaluator: a public bucket (or a key
 * the operator's storage toggles mark public) is readable by anyone; otherwise
 * `permissions.download` decides, with the admin override, and an undeclared
 * action requires a session. A column bound to a bucket the config cannot
 * resolve refuses.
 */
const writerMayDownload = (
  input: Readonly<ValidateAttachmentReferencesInput>,
  bucketName: string,
  key: string
): boolean => {
  const { scope, writer, publicAccess } = input
  const bucket = resolveUploadBucket(scope.app, bucketName)
  if (bucket === undefined) return false
  if (bucket.public === true || isFilePublic(publicAccess, key)) return true
  const caller = writer.authenticated
    ? writer.role === undefined
      ? SESSION_WITH_UNRESOLVED_ROLE
      : { role: writer.role }
    : undefined
  return permits(
    evaluatePermission(bucket.permissions?.download, caller, {
      whenUndeclared: grantWhenUndeclared(writer.authenticated),
      adminOverride: 'admin-outranks-role-list',
    })
  )
}

/**
 * Conditions (1) and (2) in one catalog read: `getMetadata` answers only when a
 * row exists AND its recorded bucket is the one named. Absent, unbound and
 * bound-elsewhere are all the same `false` — the refusal must not tell them
 * apart. A catalog that cannot be read at all is NOT a verdict about the key:
 * it fails as {@link AttachmentStorageUnavailable} (503 on the records API),
 * exactly as the `maxFileSize` rule does when it cannot read the bytes. The two
 * are told apart by the adapters' typed `StorageObjectNotFound` marker, never
 * by message text — a driver error that happens to say "not found" is an
 * outage, not a verdict.
 */
const isCataloguedIn = (
  fieldName: string,
  key: string,
  bucketName: string
): Effect.Effect<boolean, AttachmentStorageUnavailable, StorageService> =>
  Effect.gen(function* () {
    const storage = yield* StorageService
    return yield* storage.getMetadata(key, bucketName).pipe(
      Effect.as(true),
      Effect.catch((error) =>
        isStorageObjectNotFound(error)
          ? Effect.succeed(false)
          : Effect.fail(
              storageUnavailable(fieldName, 'the storage catalog could not be read')(error)
            )
      )
    )
  })

/** Every reference in one column; `true` when all of them are admissible. */
const columnReferencesAdmissible = (
  input: Readonly<ValidateAttachmentReferencesInput>,
  fieldName: string
): Effect.Effect<boolean, AttachmentStorageUnavailable, StorageService> => {
  const bucketName = bucketForField(input.scope, fieldName)
  const keys = extractAttachmentReferences(input.fields[fieldName])
  return Effect.forEach(keys, (key) =>
    isCataloguedIn(fieldName, key, bucketName).pipe(
      // Condition (3) is evaluated whatever (1)/(2) answered, so a refusal costs
      // the same work whether or not the file exists.
      Effect.map((catalogued) => writerMayDownload(input, bucketName, key) && catalogued)
    )
  ).pipe(Effect.map((verdicts) => verdicts.every(Boolean)))
}

/**
 * Every column whose values a reader resolves to a stored file. The two
 * declared attachment types plus the `'attachment'` JSONB alias: it is absent
 * from `KNOWN_FIELD_TYPES`, so `sovrium validate` refuses it, but `sovrium
 * start` creates its column and the read path signs whatever `key` it holds —
 * so a write to it is a read by proxy exactly like the other two.
 */
const REFERENCE_COLUMN_TYPES: ReadonlySet<string> = new Set([
  'single-attachment',
  'multiple-attachments',
  'attachment',
])

const referenceColumnsOf = (scope: Readonly<AttachmentScope>): readonly string[] =>
  (scopedTable(scope)?.fields ?? [])
    .filter((field) => REFERENCE_COLUMN_TYPES.has(field.type))
    .map((field) => field.name)

/** Input to {@link validateAttachmentReferences}. */
export interface ValidateAttachmentReferencesInput {
  readonly scope: AttachmentScope
  readonly fields: Readonly<Record<string, unknown>>
  readonly writer: AttachmentWriter
  /** The operator's `STORAGE_PUBLIC_PATHS` / `STORAGE_DEFAULT_ACCESS` toggles. */
  readonly publicAccess: StoragePublicAccess
  /** Columns whose values this request uploaded itself (multipart forms). */
  readonly exemptFields?: ReadonlySet<string>
}

/**
 * Refuse a write whose attachment columns reference a file outside the column's
 * bucket or outside the writer's reach. Only columns the payload SUPPLIES are
 * inspected, which is what keeps a partial update of a row holding a seeded or
 * legacy reference writable through its other columns.
 */
export const validateAttachmentReferences = (
  input: Readonly<ValidateAttachmentReferencesInput>
): Effect.Effect<void, AttachmentReferenceRefused | AttachmentStorageUnavailable, StorageService> =>
  Effect.forEach(
    referenceColumnsOf(input.scope).filter(
      (name) => name in input.fields && input.exemptFields?.has(name) !== true
    ),
    (name) =>
      columnReferencesAdmissible(input, name).pipe(
        Effect.flatMap((admissible) =>
          admissible
            ? Effect.void
            : Effect.fail(
                new AttachmentReferenceRefused({
                  message: ATTACHMENT_REFERENCE_REFUSAL,
                  field: name,
                })
              )
        )
      ),
    { discard: true }
  ).pipe(Effect.withSpan('attachments.validate-references'))
