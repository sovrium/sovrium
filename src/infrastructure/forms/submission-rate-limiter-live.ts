/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Layer } from 'effect'
import { SubmissionRateLimiter } from '@/application/ports/services/submission-rate-limiter'
import { checkAndRecord } from './form-rate-limiter'

/** Live `SubmissionRateLimiter` over the process-local sliding windows. */
export const SubmissionRateLimiterLive = Layer.succeed(
  SubmissionRateLimiter,
  SubmissionRateLimiter.of({
    checkAndRecord: (input) => Effect.sync(() => checkAndRecord(input)),
  })
)
