/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, test, expect } from 'bun:test'
import { healthResponseSchema } from './health'

describe('healthResponseSchema', () => {
  test('validates valid health response', () => {
    const input = {
      status: 'ok',
      timestamp: '2025-01-15T10:30:00.000Z',
      app: { name: 'sovrium-test' },
    }
    const result = healthResponseSchema.parse(input)
    expect(result.status).toBe('ok')
    expect(result.app.name).toBe('sovrium-test')
  })

  test('validates timestamp with offset', () => {
    const input = {
      status: 'ok',
      timestamp: '2025-01-15T10:30:00.000+02:00',
      app: { name: 'test-app' },
    }
    const result = healthResponseSchema.parse(input)
    expect(result.timestamp).toBe('2025-01-15T10:30:00.000+02:00')
  })

  test('rejects non-ok status', () => {
    expect(() =>
      healthResponseSchema.parse({
        status: 'error',
        timestamp: '2025-01-15T10:30:00.000Z',
        app: { name: 'test' },
      })
    ).toThrow()
  })

  test('rejects invalid timestamp format', () => {
    expect(() =>
      healthResponseSchema.parse({
        status: 'ok',
        timestamp: 'not-a-date',
        app: { name: 'test' },
      })
    ).toThrow()
  })

  test('rejects missing app name', () => {
    expect(() =>
      healthResponseSchema.parse({
        status: 'ok',
        timestamp: '2025-01-15T10:30:00.000Z',
        app: {},
      })
    ).toThrow()
  })

  test('rejects missing fields', () => {
    expect(() => healthResponseSchema.parse({ status: 'ok' })).toThrow()
    expect(() => healthResponseSchema.parse({})).toThrow()
  })
})
