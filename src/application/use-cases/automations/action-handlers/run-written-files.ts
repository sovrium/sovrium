/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The files one run stored in a bucket, as it stores them.
 *
 * A step that writes as nobody — no `runAs`, not started by hand — may attach
 * only a file an earlier step of the SAME run stored in the column's bucket:
 * a `file/upload` naming that bucket with bytes the run brought in, a
 * generated document, or an inline `{ name, content }` value a record step
 * stored. Any key that existed before the run is refused, whoever
 * stored it. The ledger is filled at those write sites only, never from step
 * output (a step's output is data a later step may echo, not proof of a write),
 * and lives as long as the run's step context.
 */

import {
  bucketForField,
  extractAttachmentReferences,
  type AttachmentScope,
} from '@/application/use-cases/attachments/attachment-fields'
import { isSelfContainedSource } from './file-support'

/** The bucket-qualified keys a run has written so far. */
export interface RunWrittenFiles {
  /** Record that this run stored `key` in `bucket`. */
  readonly record: (bucket: string, key: string) => void
  /** Whether this run stored `key` in `bucket`. */
  readonly has: (bucket: string, key: string) => boolean
}

/** One entry per bucket and key, unambiguous whatever either holds. */
const entryOf = (bucket: string, key: string): string => JSON.stringify([bucket, key])

/** A fresh, empty ledger for one run. */
export const createRunWrittenFiles = (): RunWrittenFiles => {
  // A mutable set is the point: steps record their writes as side effects while
  // the run goes on, and later steps of the same run read them back.
  const written = new Set<string>()
  return {
    record: (bucket, key) => {
      // eslint-disable-next-line functional/immutable-data, functional/no-expression-statements -- the run's ledger; see above
      written.add(entryOf(bucket, key))
    },
    has: (bucket, key) => written.has(entryOf(bucket, key)),
  }
}

/**
 * Record a `file/upload` into `bucket` as this run's own file when its bytes
 * came in with the run — a `data:` URI or an `http(s)` fetch. An upload whose
 * source is a stored key copies a file that existed before, so it is not.
 */
export const recordOwnUpload = (
  written: RunWrittenFiles | undefined,
  upload: { readonly bucket: string | undefined; readonly source: string; readonly key: string }
): void => {
  if (upload.bucket === undefined || !isSelfContainedSource(upload.source)) return
  // eslint-disable-next-line functional/no-expression-statements -- the run's ledger; see the module header
  written?.record(upload.bucket, upload.key)
}

/**
 * Record the files a record step stored from its inline `{ name, content }`
 * values: every key a column holds after the write (`stored`) that it did not
 * reference before (`supplied`), in that column's bucket. Their bytes came in
 * with the run, so a later step of the same run may attach them again.
 */
export const recordInlineStored = (
  written: RunWrittenFiles | undefined,
  input: {
    readonly scope: AttachmentScope
    readonly supplied: Readonly<Record<string, unknown>>
    readonly stored: Readonly<Record<string, unknown>>
  }
): void => {
  if (written === undefined) return
  const { scope, supplied, stored } = input
  const fresh = Object.keys(stored)
    .filter((name) => stored[name] !== supplied[name])
    .flatMap((name) => {
      const before = new Set(extractAttachmentReferences(supplied[name]))
      const bucket = bucketForField(scope, name)
      return extractAttachmentReferences(stored[name])
        .filter((key) => !before.has(key))
        .map((key) => [bucket, key] as const)
    })
  fresh.forEach(([bucket, key]) => written.record(bucket, key))
}
