/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The retention sweep of signing evidence: every request whose `keep_until`
 * has passed loses its evidence, rows and files.
 *
 * "Now" is the engine clock (`Clock`), so a server started with
 * `SOVRIUM_DEV_CLOCK` sweeps on the instant it was pinned to.
 *
 * For each request due, in this order:
 *
 * 1. its rows go, in one transaction (`SignatureEvidenceRepository.deleteRequest`):
 *    the chain, the subjects, the challenges, the signers, the request. The
 *    database's own guard refuses the chain's delete until `keep_until` has
 *    passed, so the transaction, not this program, is the gate;
 * 2. only then its files go: every object under the request's own evidence
 *    prefix (`signature-evidence/requests/<id>/`), the frozen document, the
 *    marks, the signed document and the proof file.
 *
 * Step 2 is the only place evidence files are deleted. Every other road (a
 * record purge, an account erasure, a replaced attachment, the bucket delete
 * route, a `file` step) skips them (`isSignatureEvidenceKey`). It is confined
 * twice: it reaches no key outside the prefix of the one request it was given,
 * and it runs only after the database let that request's rows go.
 *
 * The record the request signed stays: evidence is independent of records.
 * A request that fails is logged and left for the next pass; the others go on.
 */

import { Clock, Effect } from 'effect'
import { SignatureEvidenceRepository } from '@/application/ports/repositories/signatures/signature-evidence-repository'
import { StorageService, UNATTRIBUTED_BUCKET } from '@/application/ports/services/storage-service'
import { signatureRequestEvidenceKey } from '@/domain/models/app/signatures/signature-capture-service'
import { logError } from '@/infrastructure/logging/logger'

/**
 * Delete the files of request `requestId`, whose rows the database has just
 * let go: every object under its own evidence prefix, and nothing else. A file
 * that cannot be removed is logged.
 */
const deleteRequestFiles = (requestId: string) =>
  Effect.gen(function* () {
    const storage = yield* StorageService
    const prefix = signatureRequestEvidenceKey(requestId, '')
    const keys = (yield* storage.list(prefix)).filter((key) => key.startsWith(prefix))
    yield* Effect.forEach(
      keys,
      (key) =>
        storage.delete(key, UNATTRIBUTED_BUCKET).pipe(
          Effect.tapCause((cause) =>
            Effect.sync(() =>
              logError('[signatures] could not delete an evidence file past its retention', cause, {
                key,
              })
            )
          ),
          // effect-swallow: logged above; the rows are gone, and one stuck file must not keep the others.
          Effect.ignoreCause
        ),
      { discard: true }
    )
  })

/** Let one request's evidence go: its rows, then its files. */
const letRequestGo = (requestId: string) =>
  Effect.gen(function* () {
    const repo = yield* SignatureEvidenceRepository
    yield* repo.deleteRequest(requestId)
    yield* deleteRequestFiles(requestId)
    return true
  }).pipe(
    Effect.tapCause((cause) =>
      Effect.sync(() =>
        logError('[signatures] could not delete a request past its retention', cause, {
          requestId,
        })
      )
    ),
    // effect-swallow: logged above; the request stays for the next pass, and the others go on.
    Effect.catchCause(() => Effect.succeed(false))
  )

/** One pass of the retention sweep; resolves to how many requests it let go. */
export const sweepSignatureEvidence = Effect.gen(function* () {
  const repo = yield* SignatureEvidenceRepository
  const now = yield* Clock.currentTimeMillis
  const due = yield* repo.dueForDeletion(now)
  const gone = yield* Effect.forEach(due, letRequestGo)
  return gone.filter(Boolean).length
}).pipe(Effect.withSpan('signatures.sweep-evidence'))
