/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * When a record goes for good, the evidence of the signatures captured on it
 * goes with it.
 *
 * A signature captured on a record (a `signature-pad` bound to a field, or a
 * form's signature field) belongs to no signing flow and keeps no retention of
 * its own: its evidence follows its record and its signer. So a permanent
 * delete or a purge of the record deletes those requests' rows
 * (`SignatureEvidenceRepository.deleteRecordCaptures`), then their marks.
 *
 * The evidence of a signing FLOW is untouched: it is independent of the record
 * and kept until its `evidence.keep` ends, whatever happens to the record.
 *
 * Runs once the record's delete committed. Total: a failure is logged, and the
 * evidence it left is the record capture's only, never a flow's.
 */

import { Effect } from 'effect'
import { SignatureEvidenceRepository } from '@/application/ports/repositories/signatures/signature-evidence-repository'
import { StorageService, UNATTRIBUTED_BUCKET } from '@/application/ports/services/storage-service'
import { isSignatureEvidenceKey } from '@/domain/models/app/signatures/signature-capture-service'
import { logError } from '@/infrastructure/logging/logger'

/** What letting a record's stored files and its captures' evidence go needs. */
export type RecordEvidenceRequirements = SignatureEvidenceRepository | StorageService

/** Remove one mark a record capture stored; a mark already gone is not a failure. */
const removeMark = (key: string, forgetDerivedVariants: (key: string) => void) =>
  Effect.gen(function* () {
    const storage = yield* StorageService
    // Never a flow's evidence: those keys go with their request's retention only.
    if (isSignatureEvidenceKey(key)) return
    yield* storage.delete(key, UNATTRIBUTED_BUCKET)
  }).pipe(
    Effect.tapCause((cause) =>
      Effect.sync(() =>
        logError('[signatures] could not remove a record capture mark', cause, { key })
      )
    ),
    // effect-swallow: logged above; the record and its evidence rows are gone, and a mark left behind names nobody's request.
    Effect.ignoreCause,
    Effect.andThen(Effect.sync(() => forgetDerivedVariants(key)))
  )

/** Delete the evidence of the signatures captured on record `recordId` of `tableName`. */
export const forgetRecordSignatures = (input: {
  readonly tableName: string
  readonly recordId: string
  readonly forgetDerivedVariants: (key: string) => void
}) =>
  Effect.gen(function* () {
    const repo = yield* SignatureEvidenceRepository
    const marks = yield* repo.deleteRecordCaptures({
      ...{ tableName: input.tableName, recordId: input.recordId },
    })
    yield* Effect.forEach(marks, (key) => removeMark(key, input.forgetDerivedVariants), {
      discard: true,
    })
  }).pipe(
    Effect.tapCause((cause) =>
      Effect.sync(() =>
        logError('[signatures] could not delete the signature evidence of a record', cause, {
          tableName: input.tableName,
          recordId: input.recordId,
        })
      )
    ),
    // effect-swallow: logged above; the record's delete committed and must answer as such.
    Effect.ignoreCause,
    Effect.withSpan('signatures.forget-record-signatures', {
      attributes: { tableName: input.tableName },
    })
  )
