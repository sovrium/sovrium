/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What an update replaces: the row as it stood before the write, and the
 * stored files the write superseded — read and cleaned up by
 * `record-update-orchestration.ts`.
 */

import { Effect } from 'effect'
import { StorageService } from '@/application/ports/services/storage-service'
import { SYSTEM_BUCKET_NAME } from '@/domain/models/app/buckets/bucket-identity'
import { resolveFieldBucket } from '@/domain/models/app/buckets/field-bucket'
import { isSignatureNamespaceKey } from '@/domain/models/app/signatures/signature-capture-service'
import { findTableByName } from '@/domain/models/app/tables/table-lookup-service'
import { logError } from '@/infrastructure/logging/logger'
import { rawGetRecordProgram } from './read-record-programs'
import { readWrittenLinkLists } from './to-many-link-reads'
import type { UserSession } from '@/application/ports/contracts/user-session'
import type { App } from '@/domain/models/app'

type StoredRow = Readonly<Record<string, unknown>>

/** A superseded stored object, paired with the bucket it was written under. */
export interface ReplacedAttachment {
  readonly key: string
  readonly bucket: string
}

/**
 * The stored files a write replaces: every `single-attachment` field the write
 * names whose previous value is a non-empty key different from the new one.
 */
export function collectReplacedAttachments(
  scope: { readonly app: App; readonly tableName: string },
  previous: StoredRow,
  written: StoredRow
): readonly ReplacedAttachment[] {
  const { app, tableName } = scope
  return (findTableByName(app.tables, tableName)?.fields ?? [])
    .filter((f) => f.type === 'single-attachment' && f.name in written)
    .flatMap((f) => {
      const old = previous[f.name]
      if (typeof old !== 'string' || old.length === 0 || old === written[f.name]) return []
      return [
        { key: old, bucket: resolveFieldBucket(app, tableName, f.name) ?? SYSTEM_BUCKET_NAME },
      ]
    })
}

/**
 * Delete stored files, one at a time, each failure logged and swallowed: a file
 * already gone must never fail the update that superseded it. A file under the
 * signature namespace (a request's evidence, or a record's signature mark) is
 * kept: it leaves only with its own retention, record or signer.
 */
export const deleteStoredFiles = (
  refs: readonly ReplacedAttachment[],
  forgetDerivedVariants: (key: string) => void
) =>
  Effect.forEach(
    refs.filter(({ key }) => !isSignatureNamespaceKey(key)),
    ({ key, bucket }) =>
      Effect.gen(function* () {
        const storage = yield* StorageService
        yield* storage['delete'](key, bucket)
        yield* Effect.sync(() => forgetDerivedVariants(key))
      }).pipe(
        Effect.tapCause((cause) =>
          Effect.sync(() =>
            logError('[tables] could not delete a replaced attachment', cause, { key, bucket })
          )
        ),
        // effect-swallow: the record already points at its new file; an object
        // that cannot be removed is logged above and must not undo the update.
        Effect.ignoreCause
      ),
    { discard: true }
  ).pipe(Effect.withSpan('tables.delete-replaced-attachments'))

/**
 * The row an update replaces, `undefined` when there is none. It feeds the
 * conventions, the business rules and the cleanup, so a failed read fails the
 * update: a row whose rules could not be judged is never written. `app` makes a
 * table with no single-value record address refuse here, from its config, before
 * this read names an `id` column the table does not have.
 */
export const readReplacedRow = (input: {
  readonly session: Readonly<UserSession>
  readonly app: App
  readonly tableName: string
  readonly recordId: string
}) =>
  rawGetRecordProgram(input.session, input.tableName, input.recordId, input.app).pipe(
    Effect.map((row) => row ?? undefined),
    Effect.withSpan('tables.read-replaced-row')
  )

/**
 * The row an update replaces, with the many-to-many links the change names as
 * they stood before it — what an update run reads as `previousRecord`. A link
 * list lives in its junction table rather than on the row, so it is read before
 * the write, as the system: every link, the admin-only ones removed later with
 * the other admin-only fields. A read that fails leaves the row without them.
 */
export const readPreviousLinkLists =
  (input: {
    readonly app: App
    readonly tableName: string
    readonly recordId: string
    readonly fields: StoredRow
  }) =>
  (previous: StoredRow) =>
    readWrittenLinkLists(input.app, input.tableName, input.recordId, {
      written: input.fields,
      reader: undefined,
    }).pipe(
      Effect.map((links): StoredRow => {
        const held = links[input.recordId] ?? {}
        return {
          ...previous,
          ...Object.fromEntries(
            Object.entries(held).map(([name, keys]) => [name, keys.map((key) => String(key))])
          ),
        }
      }),
      Effect.tapCause((cause) =>
        Effect.sync(() =>
          logError('[tables] could not read the links an update replaces', cause, {
            table: input.tableName,
          })
        )
      ),
      // effect-swallow: the links feed only what an update run reads as its
      // previous record; a failed read is logged above and must not fail the update.
      Effect.orElseSucceed(() => previous),
      Effect.withSpan('tables.read-previous-link-lists')
    )
