/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { TEMP_STORAGE_PREFIX } from '@/domain/models/app/automations/actions/file/shared'
import { parseStorageTempCleanupAfter } from '@/domain/models/env/storage/storage-temp-cleanup-after'
import type { StorageService } from '@/application/ports/services/storage-service'

/**
 * Reclamation of automation temp storage (`tmp/automations/`).
 *
 * File actions that omit a destination write to a temp key, and nothing else
 * ever removes those files. The sweep below is what makes `tmp/` mean what it
 * says: any temp file older than `STORAGE_TEMP_CLEANUP_AFTER` is deleted.
 *
 * The sweep is opportunistic — it runs as part of the NEXT temp write rather
 * than on a timer. An app with no file actions therefore does no cleanup work
 * at all, and multi-instance deployments do not each schedule a duplicate
 * pass. The accepted cost is that the last temp file written before an app
 * goes idle lingers until the next temp write.
 *
 * Composed entirely from the storage port (`list` / `getMetadata` / `delete`),
 * so it works identically on every backend — including the local filesystem,
 * which is the zero-config default and has no lifecycle rules of its own.
 */

type StoragePort = Effect.Success<typeof StorageService>

/**
 * The prefix handed to `list()`, without the canonical trailing slash: the
 * local-filesystem adapter joins the prefix and each entry with `/`, so the
 * canonical `tmp/automations/` would produce double-slashed keys that no
 * `delete()` could resolve. Results are re-filtered on the canonical prefix,
 * so a sibling key such as `tmp/automations-archive/report.csv` can never be
 * mistaken for a temp file.
 */
const TEMP_LIST_PREFIX = TEMP_STORAGE_PREFIX.replace(/\/$/, '')

export interface SweepTempStorageOptions {
  /**
   * A key to leave alone regardless of age — the file the triggering write
   * just produced. Age alone would normally spare it, but excluding it
   * structurally means a misconfigured TTL can never destroy the output of
   * the very step that fired the sweep.
   */
  readonly preserve?: string
  readonly env?: Readonly<Record<string, string | undefined>>
}

/**
 * Delete `key` when its stored age is at or beyond `cutoff`.
 *
 * Every failure is swallowed deliberately. Reclamation is best-effort
 * housekeeping riding along on a user-visible action, so it must never turn a
 * successful automation step into a failed one. In particular, a `delete` of
 * an already-deleted key — the shape a concurrent sweep produces — is treated
 * as success, which is what makes concurrent sweeps safe.
 */
const reclaimIfAged = (
  storage: StoragePort,
  key: string,
  cutoff: number
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const metadata = yield* Effect.result(storage.getMetadata(key))
    // No catalog row means the age is unknown (or the file is already gone).
    // Keeping it is the safe branch: an unsweepable file is a smaller problem
    // than a file deleted on a guess.
    if (metadata._tag === 'Failure') return
    const lastModified = Date.parse(metadata.success.lastModified)
    if (!Number.isFinite(lastModified) || lastModified > cutoff) return
    // eslint-disable-next-line drizzle/enforce-delete-with-where -- StorageService port, not a Drizzle query builder
    yield* Effect.ignore(storage.delete(key))
  })

/**
 * Remove every temp file that has aged past `STORAGE_TEMP_CLEANUP_AFTER`.
 *
 * Never fails: a storage backend that cannot be listed simply gets no sweep
 * this pass, and the next temp write tries again.
 */
export const sweepAgedTempFiles = (
  storage: StoragePort,
  options?: SweepTempStorageOptions
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const ttlMs = parseStorageTempCleanupAfter(options?.env ?? process.env)
    if (ttlMs <= 0) return

    const listed = yield* Effect.result(storage.list(TEMP_LIST_PREFIX))
    if (listed._tag === 'Failure') return

    const cutoff = Date.now() - ttlMs
    const candidates = listed.success.filter(
      (key) => key.startsWith(TEMP_STORAGE_PREFIX) && key !== options?.preserve
    )
    yield* Effect.forEach(candidates, (key) => reclaimIfAged(storage, key, cutoff), {
      discard: true,
    })
  })
