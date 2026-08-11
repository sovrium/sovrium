/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Data } from 'effect'

/**
 * A stored ciphertext was written under a different encryption key.
 *
 * This error exists to make a previously SILENT failure loud. Stored OAuth
 * tokens are the only thing the encryption key protects, and before the key
 * carried an identity a key change made every one of them permanently
 * unreadable while every surface kept reporting the connection healthy: the
 * decrypt failure was swallowed into "user has no stored token", and the admin
 * listing never decrypts at all. An operator investigating that report goes
 * looking for a user who never connected, while the real cause is that every
 * connected user's credentials just became garbage.
 *
 * It lives in `infrastructure/errors` rather than beside the cipher because the
 * layer that has to ACT on it — the automation auth-header resolver — is an
 * application use-case, and use-cases may reach infrastructure for error types
 * but not for cryptographic behaviour.
 */
export class EncryptionKeyMismatchError extends Data.TaggedError('EncryptionKeyMismatchError')<{
  readonly message: string
}> {}

/**
 * True when `cause` is — or wraps — an {@link EncryptionKeyMismatchError}.
 *
 * Repositories adapt every failure into their own tagged error, so by the time
 * a mismatch reaches a use-case it is one `cause` hop down. The walk is bounded
 * to a few hops so a self-referential cause chain cannot spin.
 */
export const isEncryptionKeyMismatch = (cause: unknown, depth = 4): boolean => {
  if (depth <= 0 || cause === null || typeof cause !== 'object') return false
  if ((cause as { readonly _tag?: unknown })._tag === 'EncryptionKeyMismatchError') return true
  return isEncryptionKeyMismatch((cause as { readonly cause?: unknown }).cause, depth - 1)
}
