/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto'

/**
 * AES-256-GCM token-at-rest encryption.
 *
 * Used by `ConnectionTokenRepository` to encrypt OAuth access/refresh
 * tokens before they hit `system.connection_tokens`. The repository
 * encrypts on write and decrypts on read; callers above the repo never
 * see ciphertext.
 *
 * Key derivation: scryptSync(env, 'sovrium-token-salt', 32). Static salt
 * is acceptable because the env var IS the secret — adding a per-row
 * salt would require storing it alongside the ciphertext, which is fine
 * but doesn't add security beyond the master key. If the master key
 * leaks, every token is compromised either way.
 *
 * Storage shape: a JSON object with three base64 fields, encoded as a
 * single string so the existing TEXT column can hold it. The format is
 * versioned in the leading `v1:` prefix so a future migration can
 * detect-and-rewrite if we change algorithms.
 *
 * Production hardness:
 *   - Missing env var in production: fails loud at module load (throws).
 *   - Missing env var in test/dev: falls back to a deterministic dev key
 *     with a console.warn. Tests can decrypt without setting up env.
 */

const KEY_LEN = 32 // AES-256
const IV_LEN = 12 // GCM standard
const KEY_SALT = 'sovrium-token-salt'
const VERSION_PREFIX = 'v1:'
const DEV_KEY_FALLBACK = 'sovrium-dev-encryption-key-do-not-use-in-production-environments-12345678'

const resolveMasterKey = (): Buffer => {
  const envKey = process.env['SOVRIUM_ENCRYPTION_KEY']
  if (typeof envKey === 'string' && envKey.length > 0) {
    return scryptSync(envKey, KEY_SALT, KEY_LEN)
  }
  if (process.env['NODE_ENV'] === 'production') {
    // eslint-disable-next-line functional/no-throw-statements -- intentional fail-loud at module load when a required production secret is missing
    throw new Error(
      'SOVRIUM_ENCRYPTION_KEY is required in production. ' +
        'Generate a strong random value (e.g. `openssl rand -base64 32`) and set it in the deployment environment.'
    )
  }
  console.warn(
    '[crypto] SOVRIUM_ENCRYPTION_KEY not set; using deterministic dev fallback. Do NOT run this configuration in production.'
  )
  return scryptSync(DEV_KEY_FALLBACK, KEY_SALT, KEY_LEN)
}

// Resolve once per process. Re-deriving on every call would be wasteful
// (scrypt is intentionally slow) and doesn't add security since the env
// var is constant across the process lifetime.
const masterKey = resolveMasterKey()

interface EncryptedPayload {
  readonly ciphertext: string
  readonly iv: string
  readonly authTag: string
}

/**
 * Encrypt `plaintext` to a base64-JSON envelope. Returns a single string
 * suitable for storage in a TEXT column.
 */
export const encryptToken = (plaintext: string): string => {
  const iv = randomBytes(IV_LEN)
  const cipher = createCipheriv('aes-256-gcm', masterKey, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  const payload: EncryptedPayload = {
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
  }
  return VERSION_PREFIX + JSON.stringify(payload)
}

/**
 * Decrypt a stored envelope back to plaintext.
 *
 * Throws when:
 *   - the input doesn't start with `v1:` (corrupt or wrong-key)
 *   - the JSON envelope is malformed
 *   - the auth tag doesn't validate (tampering or wrong key)
 *
 * Callers above the repo treat decryption failures as 500-class — a
 * stored token that can't be decrypted is unusable; the user must
 * re-authorize.
 */
export const decryptToken = (envelope: string): string => {
  if (!envelope.startsWith(VERSION_PREFIX)) {
    // eslint-disable-next-line functional/no-throw-statements -- decryption-failure must surface to caller as a 500-class error
    throw new Error('decryptToken: missing version prefix; envelope is corrupt or wrong format')
  }
  const json = envelope.slice(VERSION_PREFIX.length)
  const payload = JSON.parse(json) as EncryptedPayload
  const iv = Buffer.from(payload.iv, 'base64')
  const ciphertext = Buffer.from(payload.ciphertext, 'base64')
  const authTag = Buffer.from(payload.authTag, 'base64')
  const decipher = createDecipheriv('aes-256-gcm', masterKey, iv)
  // eslint-disable-next-line functional/no-expression-statements -- node:crypto Decipher API is mutator-style
  decipher.setAuthTag(authTag)
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  return plaintext.toString('utf8')
}
