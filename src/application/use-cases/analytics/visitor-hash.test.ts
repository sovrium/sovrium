/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, test, expect } from 'bun:test'
import { computeVisitorHash, computeSessionHash } from './visitor-hash'

describe('computeVisitorHash', () => {
  test('returns a 64-character hex string (SHA-256)', async () => {
    const hash = await computeVisitorHash('192.168.1.1', 'Mozilla/5.0', 'test-app')
    expect(hash).toHaveLength(64)
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })

  test('same inputs produce same hash', async () => {
    const hash1 = await computeVisitorHash('10.0.0.1', 'Chrome/120', 'app-a')
    const hash2 = await computeVisitorHash('10.0.0.1', 'Chrome/120', 'app-a')
    expect(hash1).toBe(hash2)
  })

  test('different IPs produce different hashes', async () => {
    const hash1 = await computeVisitorHash('10.0.0.1', 'Chrome/120', 'app')
    const hash2 = await computeVisitorHash('10.0.0.2', 'Chrome/120', 'app')
    expect(hash1).not.toBe(hash2)
  })

  test('different user agents produce different hashes', async () => {
    const hash1 = await computeVisitorHash('10.0.0.1', 'Chrome/120', 'app')
    const hash2 = await computeVisitorHash('10.0.0.1', 'Firefox/119', 'app')
    expect(hash1).not.toBe(hash2)
  })

  test('different salts produce different hashes', async () => {
    const hash1 = await computeVisitorHash('10.0.0.1', 'Chrome/120', 'app-a')
    const hash2 = await computeVisitorHash('10.0.0.1', 'Chrome/120', 'app-b')
    expect(hash1).not.toBe(hash2)
  })

  test('handles empty strings gracefully', async () => {
    const hash = await computeVisitorHash('', '', '')
    expect(hash).toHaveLength(64)
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe('computeSessionHash', () => {
  test('returns a 64-character hex string (SHA-256)', async () => {
    const hash = await computeSessionHash('abc123', 30)
    expect(hash).toHaveLength(64)
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })

  test('same inputs within same time window produce same hash', async () => {
    const hash1 = await computeSessionHash('visitor-hash-abc', 30)
    const hash2 = await computeSessionHash('visitor-hash-abc', 30)
    expect(hash1).toBe(hash2)
  })

  test('different visitor hashes produce different session hashes', async () => {
    const hash1 = await computeSessionHash('visitor-a', 30)
    const hash2 = await computeSessionHash('visitor-b', 30)
    expect(hash1).not.toBe(hash2)
  })

  test('uses default timeout of 30 minutes', async () => {
    const hash1 = await computeSessionHash('visitor-a')
    const hash2 = await computeSessionHash('visitor-a', 30)
    expect(hash1).toBe(hash2)
  })
})
