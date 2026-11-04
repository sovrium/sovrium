/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Erase one signer of a request, on her request, before the evidence's
 * retention ends.
 *
 * In one transaction: the signature cell she gave on the record is redacted
 * (her name and the key of her mark removed, the statement and the method
 * kept), her subject rows are deleted (her name, address, phone, network
 * address, browser, the reason she gave if she declined, and the salts that
 * open the commitments to them), and an
 * `erased` event is appended to the chain, and her account link, if any, is
 * cleared. The chain still verifies; its commitments no longer identify her.
 * The frozen document, the signed document, the proof file and her mark stay
 * under the evidence namespace until the request's `keep_until`, when the
 * retention sweep removes them.
 *
 * A signature captured on a record keeps no retention of its own, so its mark
 * is not evidence the request holds: it goes with her erasure, once the
 * erasure committed.
 *
 * Erasing a signer twice records one erasure: the second call answers the
 * first erasure's event, and two erasures racing append one
 * (`SignatureEvidenceRepository.eraseSigner`).
 */

import { Effect } from 'effect'
import { SignatureEvidenceRepository } from '@/application/ports/repositories/signatures/signature-evidence-repository'
import { StorageService, UNATTRIBUTED_BUCKET } from '@/application/ports/services/storage-service'
import { NotFoundError } from '@/domain/errors'
import {
  isRecordCaptureFlowName,
  isSignatureEvidenceKey,
} from '@/domain/models/app/signatures/signature-capture-service'
import { erasedSignatureByEvidence } from '@/domain/models/app/tables/fields/field-types/media/signature-erasure-service'
import { logError } from '@/infrastructure/logging/logger'
import { nowInstant } from './signature-request-effects'
import type { ChainedSignatureEvent } from '@/domain/models/app/signatures/signature-evidence-chain-service'

/** Why an `erased` event was recorded. */
export type SignatureErasureReason = 'request' | 'account-erasure'

/** The evidence ids the signer's signatures were recorded as. */
const evidenceIdsOf = (
  chain: readonly ChainedSignatureEvent[],
  signer: string,
  requestId: string
): ReadonlySet<string> =>
  new Set([
    requestId,
    ...chain
      .filter((event) => event.type === 'signed' && event.signer === signer)
      .map((event) => event.data['evidenceId'])
      .filter((id): id is string => typeof id === 'string'),
  ])

/** The marks of a record capture's signer: the files her `signed` events name, none held by a flow. */
const recordCaptureMarksOf = (
  chain: readonly ChainedSignatureEvent[],
  signer: string
): readonly string[] =>
  chain
    .filter((event) => event.type === 'signed' && event.signer === signer)
    .map((event) => event.data['markKey'])
    .filter((key): key is string => typeof key === 'string' && !isSignatureEvidenceKey(key))

/**
 * Remove the marks of an erased record capture. The bucket is not named: the
 * key comes from the chain, never from a caller, and names an object the
 * capture itself stored. A mark already gone is not a failure.
 */
const removeMarks = (keys: readonly string[]) =>
  Effect.gen(function* () {
    const storage = yield* StorageService
    yield* Effect.forEach(
      keys,
      (key) =>
        storage.delete(key, UNATTRIBUTED_BUCKET).pipe(
          Effect.tapCause((cause) =>
            Effect.sync(() =>
              logError('[signatures] could not remove an erased signer mark', cause, { key })
            )
          ),
          // effect-swallow: logged above; the erasure committed, and a mark left behind is removed with its record.
          Effect.ignoreCause
        ),
      { discard: true }
    )
  })

/** Erase `signer` of request `requestId`; resolves to the `erased` event. */
export const eraseSignatureSigner = (input: {
  readonly requestId: string
  readonly signer: string
  readonly reason?: SignatureErasureReason | undefined
}) =>
  Effect.gen(function* () {
    const repo = yield* SignatureEvidenceRepository
    const request = yield* repo.readRequest(input.requestId)
    if (request === undefined) {
      return yield* Effect.fail(new NotFoundError('Signature request not found', input.requestId))
    }
    const signer = (yield* repo.readSigners(input.requestId)).find(
      (candidate) => candidate.signerName === input.signer
    )
    if (signer === undefined) {
      return yield* Effect.fail(new NotFoundError('Signer not found', input.signer))
    }
    const chain = yield* repo.readChain(input.requestId)
    const ids = evidenceIdsOf(chain, input.signer, input.requestId)
    const erased = yield* repo.eraseSigner({
      ...{ requestId: input.requestId, signerId: signer.id },
      event: {
        ...{ type: 'erased', at: (yield* nowInstant).iso, signer: input.signer },
        data: { reason: input.reason ?? 'request' },
      },
      cell:
        signer.fieldName === undefined
          ? undefined
          : {
              ...{ tableName: request.tableName, recordId: request.recordId },
              field: signer.fieldName,
              redact: (cell) => erasedSignatureByEvidence(cell, ids),
            },
    })
    if (isRecordCaptureFlowName(request.flowName)) {
      yield* removeMarks(recordCaptureMarksOf(chain, input.signer))
    }
    return erased
  }).pipe(Effect.withSpan('signatures.erase-signer', { attributes: { signer: input.signer } }))
