/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { createHash, randomBytes } from 'node:crypto'

/**
 * PKCE (RFC 7636) helpers for the OAuth2 Authorization Code flow.
 *
 * The S256 method (default) sends a SHA-256 hash of the verifier as the
 * code_challenge during /authorize, then sends the verifier itself
 * during the token exchange so the provider can rehash and compare.
 * This binds the authorize call to the same client that ends up
 * exchanging the code, defeating interception attacks.
 *
 * The `plain` method sends the verifier as both challenge and verifier.
 * It's still permitted by the spec but provides much weaker security;
 * we support it because some providers don't accept S256.
 *
 * Verifier is 32 random bytes encoded base64url — RFC 7636 specifies
 * 43–128 characters; 32 raw bytes encodes to 43 characters of
 * base64url, which is the minimum spec-compliant length.
 */

const base64url = (buffer: Buffer): string =>
  buffer.toString('base64').replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')

export const generateCodeVerifier = (): string => base64url(randomBytes(32))

export const computeCodeChallenge = (verifier: string, method: 'S256' | 'plain'): string => {
  if (method === 'plain') return verifier
  return base64url(createHash('sha256').update(verifier).digest())
}

/**
 * Generate a cryptographically random `state` value for the OAuth
 * authorize URL. 32 bytes of entropy, base64url-encoded. The provider
 * echoes this back on /callback for replay-protection / state-binding.
 */
export const generateOAuthState = (): string => base64url(randomBytes(32))
