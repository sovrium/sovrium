/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { deriveSubkey } from '@/infrastructure/crypto/root-secret'
import { EncryptionKeyMismatchError } from '@/infrastructure/errors/encryption-key-mismatch-error'

/**
 * AES-256-GCM token-at-rest encryption.
 *
 * Used by `ConnectionTokenRepository` to encrypt OAuth access/refresh tokens
 * before they hit `system.connection_tokens`. The repository encrypts on write
 * and decrypts on read; callers above the repo never see ciphertext. Those two
 * columns are the ONLY thing this key protects — and they hold live delegated
 * credentials to users' third-party accounts, which is why losing the key is
 * expensive and why losing it silently is unacceptable.
 *
 * Key derivation: `deriveSubkey('sovrium-token-salt')` over the process root
 * secret (`crypto/root-secret.ts`). The salt is deliberately unchanged from when
 * the env var was read directly here — that is what keeps every ciphertext
 * written before the root secret existed readable today. A static salt is
 * acceptable because the root secret IS the secret; a per-row salt stored beside
 * the ciphertext would add nothing once the master key leaks.
 *
 * Storage shape, versioned in the prefix:
 *
 *   v1:{"ciphertext":…,"iv":…,"authTag":…}            ← legacy, no key identity
 *   v2:<keyId>:{"ciphertext":…,"iv":…,"authTag":…}    ← current
 *
 * `keyId` is the first 16 hex of `sha256(derivedKey)`. It is a FINGERPRINT, not
 * a secret: 64 bits of a hash of a scrypt output reveals nothing usable about
 * the key, and it is what turns "this token is gone forever and nobody noticed"
 * into a named error and a boot warning. Reads accept both shapes forever —
 * dropping v1 would strand every install that upgraded.
 *
 * Nothing here resolves a secret at module load. This module sits behind the
 * token repository, which the table layer pulls in, which the CLI's command
 * handlers pull in, so an eager resolution would make `sovrium --help`
 * provision a key file as a side effect of describing itself.
 */

const KEY_LEN = 32 // AES-256
const IV_LEN = 12 // GCM standard
const KEY_SALT = 'sovrium-token-salt'
const V1_PREFIX = 'v1:'
const V2_PREFIX = 'v2:'
/** Hex characters of sha256(key) kept as the envelope's key fingerprint. */
const KEY_ID_LEN = 16

// eslint-disable-next-line functional/no-let -- one-shot process-lifetime memo; scrypt is intentionally slow and the root secret is constant across a run
let cachedKey: Buffer | undefined

/**
 * Resolve the token key once, on first use.
 *
 * Lazy for the reason in the module docstring, memoized because scrypt is
 * deliberately expensive and the root secret cannot change mid-process.
 */
const tokenKey = (): Buffer => {
  if (cachedKey !== undefined) return cachedKey
  // eslint-disable-next-line functional/no-expression-statements -- memo assignment
  cachedKey = deriveSubkey(KEY_SALT, KEY_LEN)
  return cachedKey
}

/**
 * Fingerprint of the key this process encrypts with.
 *
 * Exported so the boot-time survey can count stored rows that were written
 * under a different key without decrypting any of them.
 */
export const currentTokenKeyId = (): string =>
  createHash('sha256').update(tokenKey()).digest('hex').slice(0, KEY_ID_LEN)

/**
 * The key fingerprint an envelope declares, or `undefined` for a legacy `v1:`
 * envelope (which declares none) and for anything unrecognised.
 *
 * Pure and cheap: it reads a prefix, never a key, so a survey over every stored
 * row costs one string scan per row rather than one scrypt.
 */
export const envelopeKeyId = (envelope: string): string | undefined => {
  if (!envelope.startsWith(V2_PREFIX)) return undefined
  const rest = envelope.slice(V2_PREFIX.length)
  const separator = rest.indexOf(':')
  return separator > 0 ? rest.slice(0, separator) : undefined
}

interface EncryptedPayload {
  readonly ciphertext: string
  readonly iv: string
  readonly authTag: string
}

/**
 * Encrypt `plaintext` to a fingerprinted base64-JSON envelope. Returns a single
 * string suitable for storage in a TEXT column.
 */
export const encryptToken = (plaintext: string): string => {
  const iv = randomBytes(IV_LEN)
  const cipher = createCipheriv('aes-256-gcm', tokenKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  const payload: EncryptedPayload = {
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
  }
  return `${V2_PREFIX}${currentTokenKeyId()}:${JSON.stringify(payload)}`
}

/** Split an envelope into its JSON body, refusing anything unrecognised. */
const envelopeBody = (envelope: string): string => {
  if (envelope.startsWith(V2_PREFIX)) {
    const rest = envelope.slice(V2_PREFIX.length)
    const separator = rest.indexOf(':')
    if (separator <= 0) {
      // eslint-disable-next-line functional/no-throw-statements -- decryption-failure must surface to the caller as a 500-class error
      throw new Error('decryptToken: v2 envelope is missing its key id; the row is corrupt')
    }
    const keyId = rest.slice(0, separator)
    if (keyId !== currentTokenKeyId()) {
      // Fail BEFORE attempting the cipher: a mismatched fingerprint is a fact
      // about provenance, and reporting it as a generic auth-tag failure is how
      // this became indistinguishable from corruption in the first place.
      // eslint-disable-next-line functional/no-throw-statements -- named failure, caught and reported by the caller
      throw new EncryptionKeyMismatchError({
        message:
          'stored value was encrypted with a different encryption key ' +
          `(${keyId}, this deployment uses ${currentTokenKeyId()})`,
      })
    }
    return rest.slice(separator + 1)
  }
  if (envelope.startsWith(V1_PREFIX)) return envelope.slice(V1_PREFIX.length)
  // eslint-disable-next-line functional/no-throw-statements -- decryption-failure must surface to the caller as a 500-class error
  throw new Error('decryptToken: missing version prefix; envelope is corrupt or wrong format')
}

/**
 * Decrypt a stored envelope back to plaintext.
 *
 * Throws {@link EncryptionKeyMismatchError} when the envelope was written under
 * a different key — declared outright by a `v2:` fingerprint, or inferred from a
 * GCM authentication failure on a legacy `v1:` envelope, which carries no
 * identity to compare. The inference is sound in practice: the auth tag fails
 * for exactly two reasons, a wrong key and deliberate tampering, and both leave
 * the operator with the same next action.
 *
 * Callers above the repo treat decryption failures as 500-class — a stored token
 * that cannot be decrypted is unusable and the user must re-authorize.
 */
export const decryptToken = (envelope: string): string => {
  const json = envelopeBody(envelope)
  const payload = JSON.parse(json) as EncryptedPayload
  const iv = Buffer.from(payload.iv, 'base64')
  const ciphertext = Buffer.from(payload.ciphertext, 'base64')
  const authTag = Buffer.from(payload.authTag, 'base64')
  const decipher = createDecipheriv('aes-256-gcm', tokenKey(), iv)
  // eslint-disable-next-line functional/no-expression-statements -- node:crypto Decipher API is mutator-style
  decipher.setAuthTag(authTag)
  try {
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
  } catch (cause) {
    // eslint-disable-next-line functional/no-throw-statements -- translate an anonymous GCM failure into the actionable diagnosis
    throw new EncryptionKeyMismatchError({
      message:
        'stored value could not be decrypted — it was encrypted with a different encryption key ' +
        `(${cause instanceof Error ? cause.message : String(cause)})`,
    })
  }
}
