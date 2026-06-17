/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto'
import { isDevKeyAllowed } from '@/infrastructure/utils/security-posture'


const KEY_LEN = 32
const IV_LEN = 12
const KEY_SALT = 'sovrium-token-salt'
const VERSION_PREFIX = 'v1:'
const DEV_KEY_FALLBACK = 'sovrium-dev-encryption-key-do-not-use-in-production-environments-12345678'

const resolveMasterKey = (): Buffer => {
  const envKey = process.env['SOVRIUM_ENCRYPTION_KEY']
  if (typeof envKey === 'string' && envKey.length > 0) {
    return scryptSync(envKey, KEY_SALT, KEY_LEN)
  }
  if (!isDevKeyAllowed()) {
    throw new Error(
      'SOVRIUM_ENCRYPTION_KEY is required. ' +
        'Generate a strong random value (e.g. `openssl rand -base64 32`) and set it in the deployment environment, ' +
        'or set SOVRIUM_ALLOW_DEV_KEY=1 to use the deterministic dev fallback for local development only.'
    )
  }
  const nodeEnv = process.env['NODE_ENV']
  if (nodeEnv !== undefined && nodeEnv !== '' && nodeEnv !== 'development') {
    console.warn(
      '[crypto] SOVRIUM_ENCRYPTION_KEY not set; using deterministic dev fallback. Do NOT run this configuration in production.'
    )
  }
  return scryptSync(DEV_KEY_FALLBACK, KEY_SALT, KEY_LEN)
}

const masterKey = resolveMasterKey()

interface EncryptedPayload {
  readonly ciphertext: string
  readonly iv: string
  readonly authTag: string
}

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

export const decryptToken = (envelope: string): string => {
  if (!envelope.startsWith(VERSION_PREFIX)) {
    throw new Error('decryptToken: missing version prefix; envelope is corrupt or wrong format')
  }
  const json = envelope.slice(VERSION_PREFIX.length)
  const payload = JSON.parse(json) as EncryptedPayload
  const iv = Buffer.from(payload.iv, 'base64')
  const ciphertext = Buffer.from(payload.ciphertext, 'base64')
  const authTag = Buffer.from(payload.authTag, 'base64')
  const decipher = createDecipheriv('aes-256-gcm', masterKey, iv)
  decipher.setAuthTag(authTag)
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  return plaintext.toString('utf8')
}
