/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { constantTimeEqual } from '@/presentation/api/runtime/constant-time-equal'

/**
 * The only shape a signed-URL token can have: an HMAC-SHA256 digest rendered
 * by `digest('hex')`, i.e. exactly 64 lowercase hex characters. Uppercase is
 * refused on purpose — no minted token ever contains it, so accepting it would
 * only widen the set of strings that verify.
 */
const SIGNED_URL_TOKEN_PATTERN = /^[0-9a-f]{64}$/

/**
 * Whether a client-supplied signed-URL token matches the expected one.
 *
 * The candidate is shape-checked BEFORE any comparison. The previous version
 * hex-decoded both sides and handed them to `crypto.timingSafeEqual`: a
 * 64-character candidate that was not valid hex decoded to a SHORTER buffer,
 * `timingSafeEqual` threw on the length mismatch, and a refusal (403) became a
 * server error (500). Comparing the validated strings directly never throws.
 */
export const signedUrlTokenMatches = (expected: string, candidate: string): boolean =>
  SIGNED_URL_TOKEN_PATTERN.test(candidate) && constantTimeEqual(expected, candidate)
