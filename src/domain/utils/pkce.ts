/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { createHash, randomBytes } from 'node:crypto'


const base64url = (buffer: Buffer): string =>
  buffer.toString('base64').replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')

export const generateCodeVerifier = (): string => base64url(randomBytes(32))

export const computeCodeChallenge = (verifier: string, method: 'S256' | 'plain'): string => {
  if (method === 'plain') return verifier
  return base64url(createHash('sha256').update(verifier).digest())
}

export const generateOAuthState = (): string => base64url(randomBytes(32))
