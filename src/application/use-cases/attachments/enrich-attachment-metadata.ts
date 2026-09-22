/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Replacing a `storeMetadata: true` column's storage key with the metadata
 * object the API echoes back.
 *
 * This is the ONE attachment mode whose metadata is WRITTEN rather than
 * recomputed on read: the read enricher deliberately leaves a
 * `storeMetadata` object untouched because it carries no `key`, so whatever is
 * computed here persists. That is why a failed download refuses the write.
 * Degrading to zero bytes — which is what this used to do — turned a transient
 * outage into a permanently stored `size: 0`, a lie that outlives its cause and
 * that no later read can correct. Rows written before the fix are repaired by
 * the boot-time step in `attachment-url-backfill.ts`.
 *
 * The `url` names the bucket the COLUMN declares, matching the read path.
 */

import { Effect } from 'effect'
import { StorageService } from '@/application/ports/services/storage-service'
import { inferMimeFromKey } from '@/domain/kernel/identity/mime-types'
import {
  bucketForField,
  scopedTable,
  stripUuidPrefix,
  type AttachmentScope,
} from './attachment-fields'
import { storageUnavailable } from './errors'
import type { AttachmentStorageUnavailable } from './errors'

/** Enrich every `single-attachment` column declaring `storeMetadata: true`. */
export const enrichAttachmentMetadata = (input: {
  readonly scope: AttachmentScope
  readonly fields: Record<string, unknown>
}): Effect.Effect<Record<string, unknown>, AttachmentStorageUnavailable, StorageService> =>
  Effect.gen(function* () {
    const { scope, fields } = input
    const table = scopedTable(scope)
    if (!table) return fields

    const metadataFields = table.fields.filter(
      (f): f is typeof f & { readonly type: 'single-attachment'; readonly storeMetadata: true } =>
        f.type === 'single-attachment' &&
        'storeMetadata' in f &&
        (f as { storeMetadata?: boolean }).storeMetadata === true
    )

    if (metadataFields.length === 0) return fields

    const storage = yield* StorageService

    return yield* Effect.reduce(
      metadataFields,
      () => ({ ...fields }) as Record<string, unknown>,
      (acc, f) => {
        if (!(f.name in acc) || typeof acc[f.name] !== 'string') return Effect.succeed(acc)
        const key = acc[f.name] as string
        const bucket = bucketForField(scope, f.name)
        return storage.download(key, bucket).pipe(
          Effect.mapError(
            storageUnavailable(
              f.name,
              'the referenced file could not be read to record its metadata'
            )
          ),
          Effect.map((content) => ({
            ...acc,
            [f.name]: {
              filename: stripUuidPrefix(key),
              mimeType: inferMimeFromKey(key),
              size: content.length,
              url: `/api/buckets/${bucket}/files/${key}`,
            },
          }))
        )
      }
    )
  }).pipe(Effect.withSpan('attachments.enrich-metadata'))
