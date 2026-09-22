/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Persisting inline `{ name, content }` attachment payloads out of a record
 * write and replacing them with the canonical `{ key, name, mimeType, size }`
 * JSONB shape the read path enriches with a URL.
 *
 * Targets `'attachment'` JSONB columns specifically. The legacy
 * `single-attachment` storage-key contract — and its `storeMetadata: true`
 * download-enrichment in `enrich-attachment-metadata.ts` — are intentionally
 * left untouched so neither code path masks the other. Plain string keys
 * (already-uploaded references) pass through unchanged.
 *
 * A failed upload refuses the write. It used to run under `Effect.ignore` and
 * return the metadata object regardless, so the row was created pointing at a
 * key that had never been written: the API answered success with a
 * `{ key, size }` for bytes that do not exist, and every later read of that
 * record 404s on a file the API said it had stored. A dangling reference is
 * worse than a refusal, because only the refusal is something the caller can
 * act on.
 */

import { Effect } from 'effect'
import { StorageService } from '@/application/ports/services/storage-service'
import { inferMimeFromKey } from '@/domain/kernel/identity/mime-types'
import { bucketForField, scopedTable, type AttachmentScope } from './attachment-fields'
import { storageUnavailable } from './errors'
import type { AttachmentStorageUnavailable } from './errors'

/**
 * Decode a base64 string to a Uint8Array. Falls back to UTF-8 encoding when the
 * payload is not valid base64, so a caller that passes plain text still gets
 * bytes persisted rather than a rejection.
 */
const decodeContent = (content: string): Uint8Array => {
  try {
    return Uint8Array.from(Buffer.from(content, 'base64'))
  } catch {
    return new TextEncoder().encode(content)
  }
}

/**
 * Recognise the inline-content payload shape (`{ name, content }`, optional
 * `mimeType`). Keys-only references and metadata objects without `content` pass
 * through untouched.
 */
const isInlineAttachmentPayload = (
  value: unknown
): value is {
  readonly name: string
  readonly content: string
  readonly mimeType?: string
} =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  typeof (value as { name?: unknown }).name === 'string' &&
  typeof (value as { content?: unknown }).content === 'string'

/** Upload one inline payload and return the canonical key-plus-metadata shape. */
const uploadInlinePayload = (
  fieldName: string,
  bucket: string,
  payload: {
    readonly name: string
    readonly content: string
    readonly mimeType?: string
  }
): Effect.Effect<
  {
    readonly key: string
    readonly name: string
    readonly mimeType: string
    readonly size: number
  },
  AttachmentStorageUnavailable,
  StorageService
> =>
  Effect.gen(function* () {
    const storage = yield* StorageService
    const bytes = decodeContent(payload.content)
    const mimeType = payload.mimeType ?? inferMimeFromKey(payload.name)
    const key = `${crypto.randomUUID()}-${payload.name}`
    yield* storage
      .upload(key, bytes, mimeType, bucket)
      .pipe(Effect.mapError(storageUnavailable(fieldName, 'the supplied file could not be stored')))
    return { key, name: payload.name, mimeType, size: bytes.length }
  })

/** Persist every inline attachment payload the record write carries. */
export const uploadInlineAttachmentContent = (input: {
  readonly scope: AttachmentScope
  readonly fields: Record<string, unknown>
}): Effect.Effect<Record<string, unknown>, AttachmentStorageUnavailable, StorageService> =>
  Effect.gen(function* () {
    const { scope, fields } = input
    const table = scopedTable(scope)
    if (!table) return fields

    const attachmentColumns = table.fields.filter((f) => f.type === 'attachment')
    if (attachmentColumns.length === 0) return fields

    return yield* Effect.reduce(
      attachmentColumns,
      () => ({ ...fields }) as Record<string, unknown>,
      (acc, f) => {
        const value = acc[f.name]
        if (!isInlineAttachmentPayload(value)) return Effect.succeed(acc)
        return uploadInlinePayload(f.name, bucketForField(scope, f.name), value).pipe(
          Effect.map((meta) => ({ ...acc, [f.name]: meta }))
        )
      }
    )
  }).pipe(Effect.withSpan('attachments.upload-inline-content'))
