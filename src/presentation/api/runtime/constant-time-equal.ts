/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { timingSafeEqual } from 'node:crypto'

/**
 * Constant-time string comparison, the one every secret check on the HTTP
 * surface uses (scheduler token, webhook credentials, signed-URL tokens).
 *
 * Both sides are compared as UTF-8 bytes, so any string is a valid input and
 * the call never throws. `crypto.timingSafeEqual` throws on buffers of unequal
 * length, which is why the length check comes first; a mismatched length still
 * runs a same-buffer compare so the cost stays roughly constant and response
 * timing cannot reveal the expected length.
 */
export const constantTimeEqual = (a: string, b: string): boolean => {
  const bufferA = Buffer.from(a, 'utf8')
  const bufferB = Buffer.from(b, 'utf8')
  if (bufferA.length !== bufferB.length) {
    return timingSafeEqual(bufferA, bufferA) && false
  }
  return timingSafeEqual(bufferA, bufferB)
}
