/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { isEncryptionKeyMismatch } from '@/domain/errors/encryption-key-mismatch-error'
import {
  currentTokenKeyId,
  decryptToken,
  envelopeKeyId,
} from '@/infrastructure/crypto/token-encrypt'
import { resolveDialectSchema } from '@/infrastructure/database/drizzle/dialect-schema'
import { connectionTokens as connectionTokensPg } from '@/infrastructure/database/drizzle/schema/connection'
import { connectionTokens as connectionTokensSqlite } from '@/infrastructure/database/drizzle/schema-sqlite/connection'
import type { PortableDb } from '@/infrastructure/database/drizzle/db'

/**
 * The boot survey of stored connection tokens: how many this deployment's key
 * can no longer read. It counts and warns, and changes nothing.
 */

const connectionTokens = resolveDialectSchema(connectionTokensPg, connectionTokensSqlite)

/**
 * Is this stored envelope unreadable under the key this process holds?
 *
 * Two envelope shapes, two honest answers:
 *
 *   - `v2:` declares a key fingerprint, so comparing it answers the question
 *     with no cryptography at all — a string scan per row rather than a cipher.
 *   - `v1:` predates the fingerprint and declares nothing. The only truthful
 *     test is to try: one AES-GCM open against an already-derived key. Skipping
 *     these would stay silent for precisely the population most at risk — an
 *     install that upgraded and then changed its key — while calling them all
 *     foreign would cry wolf on every install that has ever upgraded.
 *
 * A row that fails for any reason OTHER than the key (a truncated or hand-edited
 * envelope) is not counted: the warning names a cause, and naming the wrong one
 * sends the operator to re-authorize users whose tokens were never the problem.
 */
const isUnreadableUnderCurrentKey = (envelope: string, currentKeyId: string): boolean => {
  const declared = envelopeKeyId(envelope)
  if (declared !== undefined) return declared !== currentKeyId
  try {
    decryptToken(envelope)
    return false
  } catch (error) {
    return isEncryptionKeyMismatch(error)
  }
}

/**
 * Count stored token rows that this deployment's key cannot read.
 *
 * Best-effort by construction: a failure here must never keep a server down, so
 * it resolves to `0`. Feeds the boot ⚠ described in a connection keyid spec.
 */
export const countTokensEncryptedWithAnotherKey = async (db: PortableDb): Promise<number> => {
  try {
    const rows = await db
      .select({ accessToken: connectionTokens.accessToken })
      .from(connectionTokens)
    const current = currentTokenKeyId()
    return rows.filter((row) => isUnreadableUnderCurrentKey(String(row.accessToken), current))
      .length
  } catch {
    return 0
  }
}
