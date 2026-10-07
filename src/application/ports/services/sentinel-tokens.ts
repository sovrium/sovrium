/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context } from 'effect'

/**
 * Recognises the placeholder credential the test-mode token seeder writes.
 *
 * The seeder (infrastructure) upserts a sentinel access token for every new
 * user so the encryption-at-rest specs have a row to decrypt. Everything that
 * READS a stored credential has to treat that placeholder as "not authorised":
 * the connection status programs report it disconnected, and the outbound
 * auth-header paths refuse to send it upstream as a Bearer token.
 *
 * A port rather than an import because the knowledge of what the seeder writes
 * belongs with the seeder. The use-cases ask the question; the infrastructure
 * that owns the placeholder's shape answers it, and a change to that shape
 * lands in one Live instead of four call sites.
 */
export class SentinelTokens extends Context.Service<
  SentinelTokens,
  {
    /**
     * Whether a decrypted access-token plaintext is the seeder's placeholder.
     * `undefined` (no token) is not a placeholder.
     */
    readonly isSentinelAccessToken: (plaintext: string | undefined) => boolean
  }
>()('SentinelTokens') {}
