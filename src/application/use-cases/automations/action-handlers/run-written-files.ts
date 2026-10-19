/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The files one run stored in a bucket, as it stores them, and whether each
 * one's bytes came in with the run.
 *
 * Every file the run wrote is its own (`has`): a later step of the same run may
 * read, replace, move or delete it. A step that writes as nobody — no `runAs`,
 * not started by hand — may attach only a file whose bytes the SAME run brought
 * in (`hasRunBytes`): a `file/upload` from a `data:` URI or a foreign URL, a
 * CSV built from data, a document built from data or only from files the run
 * brought in, a browser screenshot, or an inline `{ name, content }` value a
 * record step stored. Every other write carries the standing of what it was
 * made from: a `file/copy`, a `file/move`, an upload from a stored key or from
 * a URL of the app itself, a download, an archive, a transformed image, a page
 * or a merge counts only when EVERY file it read did. Any key that existed
 * before the run is refused, whoever stored it. A key the run deleted, or moved
 * away from, is given up (`forget`): keys are flat, so it is forgotten in every
 * bucket. The ledger is filled at those write sites only, never from step
 * output (a step's output is data a later step may echo, not proof of a
 * write), and lives as long as the run — across a pause too, when the run
 * stores it (`run/run-ledger-persistence.ts`).
 */

import { Effect } from 'effect'
import {
  UNATTRIBUTED_BUCKET,
  type BucketBinding,
} from '@/application/ports/services/storage-service'
import {
  attachmentFieldsOf,
  bucketForField,
  extractAttachmentReferences,
  type AttachmentScope,
} from '@/application/use-cases/attachments/attachment-fields'

/** Where a written file's bytes came from: in with the run, or from a file stored before it. */
export interface WrittenProvenance {
  readonly carriesRunBytes: boolean
}

/** One entry of a ledger: a bucket (`null`: none), a key, and its bytes' standing. */
export interface RunWrittenEntry {
  readonly bucket: string | null
  readonly key: string
  readonly carriesRunBytes: boolean
}

/** The bucket-qualified keys a run has written so far, a file in no bucket included. */
export interface RunWrittenFiles {
  /**
   * Record that this run stored `key` in `bucket` (`UNATTRIBUTED_BUCKET`: in
   * none). The last write at a key decides its provenance.
   */
  readonly record: (bucket: BucketBinding, key: string, provenance: WrittenProvenance) => void
  /** Whether this run stored `key` in `bucket` (`UNATTRIBUTED_BUCKET`: in none). */
  readonly has: (bucket: BucketBinding, key: string) => boolean
  /** Whether this run stored `key` in `bucket` with bytes that came in with the run. */
  readonly hasRunBytes: (bucket: BucketBinding, key: string) => boolean
  /**
   * Whether the object at `key` holds bytes that came in with the run, whatever
   * bucket it was recorded in: keys are flat, so a read that names no bucket
   * reads that one object. False when the run recorded it nowhere.
   */
  readonly keyHasRunBytes: (key: string) => boolean
  /** Give `key` up, in every bucket: the run deleted it, or moved its file away. */
  readonly forget: (key: string) => void
  /** Every entry, in the order first recorded: what a paused run stores. */
  readonly entries: () => readonly RunWrittenEntry[]
}

/** A write whose bytes came in with the run: an upload of new bytes, a generated file. */
export const RUN_BYTES: WrittenProvenance = { carriesRunBytes: true }

/**
 * A write that gives no standing to attach: bytes stored before the run, or a
 * file in no bucket (an artifact, a read key) that no column's bucket holds.
 */
export const PRE_EXISTING_BYTES: WrittenProvenance = { carriesRunBytes: false }

/** One entry per bucket and key, unambiguous whatever either holds; no bucket is `null`. */
const entryOf = (bucket: BucketBinding, key: string): string =>
  JSON.stringify([typeof bucket === 'string' ? bucket : null, key])

/** A ledger for one run: empty, or holding the entries a paused run stored. */
export const createRunWrittenFiles = (
  restored: readonly RunWrittenEntry[] = []
): RunWrittenFiles => {
  // A mutable map is the point: steps record their writes as side effects while
  // the run goes on, and later steps of the same run read them back.
  const written = new Map<string, RunWrittenEntry>(
    restored.map((entry) => [entryOf(entry.bucket ?? UNATTRIBUTED_BUCKET, entry.key), entry])
  )
  const ofKey = (key: string): readonly RunWrittenEntry[] =>
    [...written.values()].filter((entry) => entry.key === key)
  return {
    record: (bucket, key, { carriesRunBytes }) => {
      const at = typeof bucket === 'string' ? bucket : null
      // eslint-disable-next-line functional/immutable-data, functional/no-expression-statements -- the run's ledger; see above
      written.set(entryOf(bucket, key), { bucket: at, key, carriesRunBytes })
    },
    has: (bucket, key) => written.has(entryOf(bucket, key)),
    hasRunBytes: (bucket, key) => written.get(entryOf(bucket, key))?.carriesRunBytes === true,
    keyHasRunBytes: (key) => {
      const held = ofKey(key)
      return held.length > 0 && held.every((entry) => entry.carriesRunBytes)
    },
    forget: (key) => {
      ofKey(key).forEach((entry) =>
        // eslint-disable-next-line functional/immutable-data -- the run's ledger; see above
        written.delete(entryOf(entry.bucket ?? UNATTRIBUTED_BUCKET, entry.key))
      )
    },
    entries: () => [...written.values()],
  }
}

/**
 * Whether a file built from the stored objects at `keys` carries run bytes:
 * only when every one of them does. Built from none — data alone — it does.
 */
export const builtFromRunBytes = (
  written: RunWrittenFiles | undefined,
  keys: readonly string[]
): boolean => keys.every((key) => written?.keyHasRunBytes(key) === true)

/**
 * Record a `file/upload` into `bucket` (`undefined`: a path or a temporary key
 * in no bucket) as this run's own file, whatever its source, so a later step of
 * the same run may move, replace or delete it. Its bytes came in with the run
 * (`carriesRunBytes`) for a `data:` URI or a foreign `http(s)` fetch; an
 * upload from a stored key, or from a URL of the app that serves one, carries
 * that file's standing ({@link uploadSourceStanding}).
 */
export const recordOwnUpload = (
  written: RunWrittenFiles | undefined,
  upload: {
    readonly bucket: string | undefined
    readonly key: string
    readonly carriesRunBytes: boolean
  }
): void => {
  // eslint-disable-next-line functional/no-expression-statements -- the run's ledger; see the module header
  written?.record(upload.bucket ?? UNATTRIBUTED_BUCKET, upload.key, {
    carriesRunBytes: upload.carriesRunBytes,
  })
}

/**
 * Record a `file/copy` (or a `file/move`, which copies then removes) as this
 * run's own file, in `bucket`, the bucket its source is recorded in. Its bytes
 * are the source's: they count as brought in by the run only when the
 * source's did, so a copy of a file stored before the run never does.
 */
export const recordOwnCopy = (
  written: RunWrittenFiles | undefined,
  copy: {
    readonly bucket: BucketBinding
    readonly sourceKey: string
    readonly destinationKey: string
  }
): void => {
  if (written === undefined) return
  const carriesRunBytes = written.keyHasRunBytes(copy.sourceKey)
  written.record(copy.bucket, copy.destinationKey, { carriesRunBytes })
}

/**
 * Give up a key the run removed — a `file/delete`, the source of a
 * `file/move` — in both of its ledgers: a file someone else stores there
 * afterwards is not the run's, nor one it read.
 */
export const forgetRemovedKey = (
  automation: {
    readonly writtenFiles?: RunWrittenFiles | undefined
    readonly readFiles?: RunWrittenFiles | undefined
  },
  key: string
): void => {
  // eslint-disable-next-line functional/no-expression-statements -- the run's ledgers; see the module header
  automation.writtenFiles?.forget(key)
  // eslint-disable-next-line functional/no-expression-statements -- as above
  automation.readFiles?.forget(key)
}

/**
 * Record a file a `file` step wrote in no bucket (a temporary artifact, or the
 * `destination` it was admitted to write) as this run's own, so a later step
 * of the same run may move, replace or delete it. `provenance` is what the
 * file was built from: run bytes only when every file it read was.
 */
export const recordRunArtifact = (
  written: RunWrittenFiles | undefined,
  key: string,
  provenance: WrittenProvenance
): Effect.Effect<void> =>
  Effect.sync(() => written?.record(UNATTRIBUTED_BUCKET, key, provenance)).pipe(
    Effect.withSpan('automations.record-run-artifact')
  )

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
  fresh.forEach(([bucket, key]) => written.record(bucket, key, RUN_BYTES))
}

/**
 * Record the attachment keys a record step READ for its starter: every key the
 * table's own attachment fields hold in the records the scoped read returned,
 * in that field's bucket. Only what the read handed over counts — a record her
 * row rule refused was never returned, and a field she may not read is already
 * absent — and it is recorded at the read itself, never from a later step's
 * output, which is data a step may echo.
 */
export const recordReadAttachments = (
  read: RunWrittenFiles | undefined,
  input: {
    readonly scope: AttachmentScope
    readonly records: readonly Readonly<Record<string, unknown>>[]
  }
): void => {
  if (read === undefined) return
  const { scope, records } = input
  const held = attachmentFieldsOf(scope).flatMap((field) => {
    const bucket = bucketForField(scope, field.name)
    return records.flatMap((record) => {
      const fields = (record['fields'] ?? {}) as Readonly<Record<string, unknown>>
      return [
        ...extractAttachmentReferences(record[field.name]),
        ...extractAttachmentReferences(fields[field.name]),
      ].map((key) => [bucket, key] as const)
    })
  })
  held.forEach(([bucket, key]) => read.record(bucket, key, PRE_EXISTING_BYTES))
}
