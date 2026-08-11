/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { deriveSubkey } from '@/infrastructure/crypto/root-secret'

/**
 * The signing secret behind sessions, cookies and signed storage URLs.
 *
 * `AUTH_SECRET` used to be the weaker of Sovrium's two secrets: nothing
 * validated it, and when it was absent Better Auth substituted its own
 * publicly-documented default, while two Sovrium call sites fell back to a
 * hard-coded `'sovrium-signed-url-dev-secret'`. "No environment variables" was
 * therefore quiet rather than safe. Deriving it from the root secret makes the
 * zero-config install genuinely secret-bearing.
 *
 * An explicitly-set `AUTH_SECRET` still wins, and that precedence is not a
 * nicety — deriving over the top of a deployment that already supplies one
 * would invalidate every live session the moment it upgraded.
 *
 * The derivation uses its OWN scrypt salt rather than the root secret verbatim.
 * Handing the same string to an AES-GCM key and to an HMAC signing secret is a
 * key-reuse anti-pattern: a weakness found in one primitive should not become a
 * weakness in the other.
 */

/** Domain-separation salt. Changing it would sign every user out. */
const AUTH_SALT = 'sovrium-auth-salt'

/**
 * Resolve the effective auth secret: the operator's `AUTH_SECRET` when set,
 * otherwise a stable value derived from the root secret.
 *
 * An empty string reads as unset — that is how a shell blanks a variable it
 * still exports, and an empty signing secret is not a secret.
 */
export const resolveAuthSecret = (): string => {
  const explicit = process.env['AUTH_SECRET']
  if (typeof explicit === 'string' && explicit.length > 0) return explicit
  return deriveSubkey(AUTH_SALT).toString('hex')
}
