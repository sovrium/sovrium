/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


const toHex = (buffer: ArrayBuffer): string =>
  Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

const sha256 = async (input: string): Promise<string> => {
  const encoder = new TextEncoder()
  const data = encoder.encode(input)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return toHex(hash)
}

export const computeVisitorHash = async (
  ip: string,
  userAgent: string,
  salt: string
): Promise<string> => {
  const today = new Date().toISOString().slice(0, 10)
  return sha256(`${today}|${ip}|${userAgent}|${salt}`)
}

export const computeSessionHash = async (
  visitorHash: string,
  sessionTimeoutMinutes: number = 30
): Promise<string> => {
  const now = new Date()
  const minutesSinceMidnight = now.getHours() * 60 + now.getMinutes()
  const timeWindow = Math.floor(minutesSinceMidnight / sessionTimeoutMinutes)
  const dateStr = now.toISOString().slice(0, 10)
  return sha256(`${visitorHash}|${dateStr}|${timeWindow}`)
}
