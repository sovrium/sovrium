/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { Schema } from 'effect'
import { BuiltInAnalyticsSchema } from '.'

describe('BuiltInAnalyticsSchema', () => {
  describe('valid configurations', () => {
    test('should accept true (enable with all defaults)', () => {
      const result = Schema.decodeUnknownSync(BuiltInAnalyticsSchema)(true)
      expect(result).toBe(true)
    })

    test('should accept false (explicitly disabled)', () => {
      const result = Schema.decodeUnknownSync(BuiltInAnalyticsSchema)(false)
      expect(result).toBe(false)
    })

    test('should accept empty object (enable with all defaults)', () => {
      const result = Schema.decodeUnknownSync(BuiltInAnalyticsSchema)({})
      expect(result).toEqual({})
    })

    test('should accept valid retentionDays within range', () => {
      const result = Schema.decodeUnknownSync(BuiltInAnalyticsSchema)({ retentionDays: 90 })
      expect(result).toEqual({ retentionDays: 90 })
    })

    test('should accept minimum retentionDays (1)', () => {
      const result = Schema.decodeUnknownSync(BuiltInAnalyticsSchema)({ retentionDays: 1 })
      expect(result).toEqual({ retentionDays: 1 })
    })

    test('should accept maximum retentionDays (730)', () => {
      const result = Schema.decodeUnknownSync(BuiltInAnalyticsSchema)({ retentionDays: 730 })
      expect(result).toEqual({ retentionDays: 730 })
    })

    test('should accept excludedPaths array', () => {
      const result = Schema.decodeUnknownSync(BuiltInAnalyticsSchema)({
        excludedPaths: ['/admin/*', '/api/**'],
      })
      expect(result).toEqual({ excludedPaths: ['/admin/*', '/api/**'] })
    })

    test('should accept empty excludedPaths array', () => {
      const result = Schema.decodeUnknownSync(BuiltInAnalyticsSchema)({ excludedPaths: [] })
      expect(result).toEqual({ excludedPaths: [] })
    })

    test('should accept respectDoNotTrack flag', () => {
      const result = Schema.decodeUnknownSync(BuiltInAnalyticsSchema)({
        respectDoNotTrack: false,
      })
      expect(result).toEqual({ respectDoNotTrack: false })
    })

    test('should accept valid sessionTimeout within range', () => {
      const result = Schema.decodeUnknownSync(BuiltInAnalyticsSchema)({ sessionTimeout: 15 })
      expect(result).toEqual({ sessionTimeout: 15 })
    })

    test('should accept minimum sessionTimeout (1)', () => {
      const result = Schema.decodeUnknownSync(BuiltInAnalyticsSchema)({ sessionTimeout: 1 })
      expect(result).toEqual({ sessionTimeout: 1 })
    })

    test('should accept maximum sessionTimeout (120)', () => {
      const result = Schema.decodeUnknownSync(BuiltInAnalyticsSchema)({ sessionTimeout: 120 })
      expect(result).toEqual({ sessionTimeout: 120 })
    })

    test('should accept full configuration with all fields', () => {
      const result = Schema.decodeUnknownSync(BuiltInAnalyticsSchema)({
        retentionDays: 90,
        excludedPaths: ['/admin/*'],
        respectDoNotTrack: true,
        sessionTimeout: 15,
      })
      expect(result).toEqual({
        retentionDays: 90,
        excludedPaths: ['/admin/*'],
        respectDoNotTrack: true,
        sessionTimeout: 15,
      })
    })
  })

  describe('invalid configurations', () => {
    test('should reject retentionDays below minimum (0)', () => {
      expect(() => Schema.decodeUnknownSync(BuiltInAnalyticsSchema)({ retentionDays: 0 })).toThrow()
    })

    test('should reject retentionDays above maximum (731)', () => {
      expect(() =>
        Schema.decodeUnknownSync(BuiltInAnalyticsSchema)({ retentionDays: 731 })
      ).toThrow()
    })

    test('should reject non-integer retentionDays', () => {
      expect(() =>
        Schema.decodeUnknownSync(BuiltInAnalyticsSchema)({ retentionDays: 90.5 })
      ).toThrow()
    })

    test('should reject sessionTimeout below minimum (0)', () => {
      expect(() =>
        Schema.decodeUnknownSync(BuiltInAnalyticsSchema)({ sessionTimeout: 0 })
      ).toThrow()
    })

    test('should reject sessionTimeout above maximum (121)', () => {
      expect(() =>
        Schema.decodeUnknownSync(BuiltInAnalyticsSchema)({ sessionTimeout: 121 })
      ).toThrow()
    })

    test('should reject non-integer sessionTimeout', () => {
      expect(() =>
        Schema.decodeUnknownSync(BuiltInAnalyticsSchema)({ sessionTimeout: 30.5 })
      ).toThrow()
    })

    test('should reject non-array excludedPaths', () => {
      expect(() =>
        Schema.decodeUnknownSync(BuiltInAnalyticsSchema)({ excludedPaths: '/admin/*' })
      ).toThrow()
    })

    test('should reject non-boolean for boolean shorthand', () => {
      expect(() => Schema.decodeUnknownSync(BuiltInAnalyticsSchema)('yes')).toThrow()
    })
  })
})
