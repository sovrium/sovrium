/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { createHash, randomBytes } from 'node:crypto'


const HASH_ALGORITHM = 'sha256'

export const FORM_IP_HASH_SALT_ENV = 'FORM_IP_HASH_SALT'

let processFallbackSalt: string | undefined

const buildFallbackSalt = (): string => {
  if (processFallbackSalt !== undefined) return processFallbackSalt
  processFallbackSalt = randomBytes(32).toString('hex')
  return processFallbackSalt
}

export const readIpHashSalt = (
  env: Readonly<Record<string, string | undefined>> = process.env
): string => {
  const configured = env[FORM_IP_HASH_SALT_ENV]
  if (typeof configured === 'string' && configured.length > 0) return configured
  return buildFallbackSalt()
}

export const isIpHashSaltConfigured = (
  env: Readonly<Record<string, string | undefined>> = process.env
): boolean => {
  const configured = env[FORM_IP_HASH_SALT_ENV]
  return typeof configured === 'string' && configured.length > 0
}

export const hashIp = (salt: string, ip: string): string => {
  return createHash(HASH_ALGORITHM)
    .update(salt + ip)
    .digest('hex')
}
