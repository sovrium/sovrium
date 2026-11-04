/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The HTTP status of each refusal a signer can act on, the same on every road
 * that signs: the signing page's sign, decline and code roads, and a form
 * bound to a signing flow.
 */
export const SIGNING_REFUSAL_STATUS = {
  CONSENT_REQUIRED: 400,
  IMAGE_INVALID: 400,
  STATEMENT_CHANGED: 409,
  VERIFICATION_REQUIRED: 403,
  CODE_INVALID: 400,
  CODE_EXPIRED: 400,
  CHANNEL_UNAVAILABLE: 400,
  SMS_UNAVAILABLE: 503,
  TOO_MANY_CODE_ATTEMPTS: 429,
  RESEND_TOO_SOON: 429,
  TOO_MANY_CODES_SENT: 429,
  NOT_YOUR_TURN: 409,
} as const
