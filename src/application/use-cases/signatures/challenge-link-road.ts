/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The link road's lockout: an address that opened twenty links leading
 * nowhere within the hour is answered not-found for every link until the
 * hour has passed, a valid one included, so guessing tokens costs an hour
 * per twenty tries. The count is durable: a restart reopens nothing.
 */

import { Effect } from 'effect'
import { SignatureChallengeRepository } from '@/application/ports/repositories/signatures/signature-challenge-repository'
import {
  MAX_INVALID_SIGNING_LINKS_PER_ADDRESS,
  SIGNATURE_ADDRESS_WINDOW_MS,
} from '@/domain/models/app/signatures/signature-challenge-service'
import { nowInstant } from './signature-request-effects'

/** Whether the link road is closed to `address` now. */
export const isSigningLinkRoadClosed = Effect.fn('signatures.link-road-closed')(function* (
  address: string
) {
  const now = yield* nowInstant
  const invalid = yield* (yield* SignatureChallengeRepository).addressEvents({
    ...{ address, event: 'invalid-link' },
    ...{ sinceMs: now.ms - SIGNATURE_ADDRESS_WINDOW_MS, nowMs: now.ms },
  })
  return invalid >= MAX_INVALID_SIGNING_LINKS_PER_ADDRESS
})

/** Count one link from `address` that led nowhere, for the hour to come. */
export const countInvalidSigningLink = Effect.fn('signatures.count-invalid-link')(function* (
  address: string
) {
  const now = yield* nowInstant
  yield* (yield* SignatureChallengeRepository).recordAddressEvent({
    ...{ address, event: 'invalid-link' },
    ...{ nowMs: now.ms, untilMs: now.ms + SIGNATURE_ADDRESS_WINDOW_MS },
  })
})
