/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { randomBytes } from 'node:crypto'
import { parseDuration } from '@/domain/utils/parse-duration'


const base64url = (buffer: Buffer): string =>
  buffer.toString('base64').replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')

export const generateShareToken = (): string => base64url(randomBytes(24))

export const hashSharePassword = async (plaintext: string): Promise<string> => {
  return Bun.password.hash(plaintext)
}

export const verifySharePassword = async (plaintext: string, hash: string): Promise<boolean> => {
  return Bun.password.verify(plaintext, hash)
}

export const resolveExpiryTimestamp = (input: unknown): Date | undefined => {
  if (typeof input !== 'string' || input === '') return undefined

  const asDate = new Date(input)
  if (!Number.isNaN(asDate.getTime()) && /^\d{4}-\d{2}-\d{2}/.test(input)) {
    return asDate
  }

  const ms = parseDuration(input)
  if (!Number.isFinite(ms) || ms <= 0) return undefined
  return new Date(Date.now() + ms)
}
