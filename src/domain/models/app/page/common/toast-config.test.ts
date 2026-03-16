/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { Schema } from 'effect'
import { ToastPositionSchema, PageToastConfigSchema } from './toast-config'

describe('ToastPositionSchema', () => {
  const decode = Schema.decodeUnknownSync(ToastPositionSchema)

  test('should accept all valid positions', () => {
    const positions = [
      'top-right',
      'top-left',
      'top-center',
      'bottom-right',
      'bottom-left',
      'bottom-center',
    ] as const

    for (const position of positions) {
      expect(decode(position)).toBe(position)
    }
  })

  test('should reject invalid position', () => {
    expect(() => decode('center')).toThrow()
    expect(() => decode('left')).toThrow()
    expect(() => decode('')).toThrow()
  })
})

describe('PageToastConfigSchema', () => {
  const decode = Schema.decodeUnknownSync(PageToastConfigSchema)

  test('should accept empty object (all optional)', () => {
    const result = decode({})
    expect(result.position).toBeUndefined()
    expect(result.duration).toBeUndefined()
  })

  test('should accept valid position', () => {
    const result = decode({ position: 'top-right' })
    expect(result.position).toBe('top-right')
  })

  test('should accept valid duration', () => {
    const result = decode({ duration: 5000 })
    expect(result.duration).toBe(5000)
  })

  test('should accept full config', () => {
    const result = decode({ position: 'bottom-left', duration: 3000 })
    expect(result.position).toBe('bottom-left')
    expect(result.duration).toBe(3000)
  })

  test('should reject non-integer duration', () => {
    expect(() => decode({ duration: 3.5 })).toThrow()
  })

  test('should reject zero duration', () => {
    expect(() => decode({ duration: 0 })).toThrow()
  })

  test('should reject negative duration', () => {
    expect(() => decode({ duration: -1000 })).toThrow()
  })
})
