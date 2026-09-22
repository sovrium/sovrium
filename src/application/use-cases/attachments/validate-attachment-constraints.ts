/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Enforcing what an attachment column declares about the files written to it.
 *
 * Three constraints, and they differ in what they cost to check:
 * `maxFiles` and `allowedFileTypes` are decidable from the storage KEY alone, so
 * they stay enforceable while storage is down; `maxFileSize` is a promise about
 * BYTES, and the only way to keep it is to read them.
 *
 * That last one is why this program can fail two ways. A download that FAILS is
 * not a zero-byte file. It used to be treated as one
 * (`orElseSucceed(() => new Uint8Array(0))`), which made `0 > max` false and so
 * silently disabled the cap for the whole duration of a storage outage — an
 * oversized file was admitted into a capped column and the caller was told the
 * write succeeded. The cap is a promise about bytes nobody read, so the only
 * truthful answer is that it could not be checked.
 */

import { Effect } from 'effect'
import { StorageService } from '@/application/ports/services/storage-service'
import { inferMimeFromKey } from '@/domain/kernel/identity/mime-types'
import {
  attachmentFieldsOf,
  bucketForField,
  extractAttachmentKeys,
  isMimeTypeAllowed,
  type AttachmentField,
  type AttachmentScope,
} from './attachment-fields'
import { AttachmentRuleViolation, storageUnavailable } from './errors'
import type { AttachmentStorageUnavailable } from './errors'

/** `maxFiles` — decidable from the key count alone, so no storage is touched. */
const ensureMaxFiles = (
  field: Readonly<AttachmentField>,
  keys: readonly string[]
): Effect.Effect<void, AttachmentRuleViolation> => {
  if (field.type !== 'multiple-attachments') return Effect.void
  if (field.maxFiles === undefined || keys.length <= field.maxFiles) return Effect.void
  return Effect.fail(
    new AttachmentRuleViolation({
      message: `Too many files for field '${field.name}'. max files allowed: ${field.maxFiles}`,
      field: field.name,
    })
  )
}

/** `allowedFileTypes` — the MIME type is inferred from the key's extension. */
const ensureAllowedTypes = (
  field: Readonly<AttachmentField>,
  keys: readonly string[]
): Effect.Effect<void, AttachmentRuleViolation> => {
  if (!field.allowedFileTypes || field.allowedFileTypes.length === 0) return Effect.void
  const allowed = field.allowedFileTypes
  const hasInvalid = keys.some((key) => !isMimeTypeAllowed(inferMimeFromKey(key), allowed))
  if (!hasInvalid) return Effect.void
  return Effect.fail(
    new AttachmentRuleViolation({
      message: `Invalid file type for field '${field.name}'. Allowed file types: ${field.allowedFileTypes.join(', ')}`,
      field: field.name,
    })
  )
}

/** Download each storage key and reject when any exceeds `maxFileSize`. */
const checkMaxFileSize = (
  field: Readonly<AttachmentField>,
  keys: readonly string[],
  bucket: string
): Effect.Effect<void, AttachmentRuleViolation | AttachmentStorageUnavailable, StorageService> => {
  if (field.maxFileSize === undefined) return Effect.void
  const max = field.maxFileSize
  const unreadable = storageUnavailable(field.name, 'the referenced file could not be read')
  return Effect.gen(function* () {
    const storage = yield* StorageService
    yield* Effect.forEach(
      keys,
      (key) =>
        Effect.gen(function* () {
          const content = yield* storage.download(key, bucket).pipe(Effect.mapError(unreadable))
          if (content.length > max) {
            return yield* new AttachmentRuleViolation({
              message: `File size ${content.length} bytes exceeds maximum file size for field '${field.name}'. Maximum file size: ${max} bytes`,
              field: field.name,
            })
          }
        }),
      { discard: true }
    )
  })
}

/**
 * Run every attachment rule for a single field, cheapest first.
 *
 * The order is the point: both key-only rules are answered before the first
 * byte is fetched, so a payload that was going to be refused anyway never costs
 * a storage round trip — and a caller whose column is simply the wrong type
 * learns that even while storage is unreachable.
 */
const checkOneField = (
  field: Readonly<AttachmentField>,
  fields: Readonly<Record<string, unknown>>,
  bucket: string
): Effect.Effect<void, AttachmentRuleViolation | AttachmentStorageUnavailable, StorageService> => {
  if (!(field.name in fields)) return Effect.void
  const keys = extractAttachmentKeys(field, fields[field.name])
  return Effect.gen(function* () {
    yield* ensureMaxFiles(field, keys)
    yield* ensureAllowedTypes(field, keys)
    yield* checkMaxFileSize(field, keys, bucket)
  })
}

/**
 * Validate every attachment column of the scoped table against the record the
 * caller is writing.
 *
 * MIME type is inferred from the storage key's filename extension; the byte size
 * is read from storage, and a read that cannot be completed refuses the write
 * rather than substituting a size for it.
 */
export const validateAttachmentConstraints = (input: {
  readonly scope: AttachmentScope
  readonly fields: Record<string, unknown>
}): Effect.Effect<void, AttachmentRuleViolation | AttachmentStorageUnavailable, StorageService> =>
  Effect.forEach(
    attachmentFieldsOf(input.scope),
    (field) => checkOneField(field, input.fields, bucketForField(input.scope, field.name)),
    { discard: true }
  ).pipe(Effect.withSpan('attachments.validate-constraints'))
