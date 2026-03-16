/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, test, expect } from 'bun:test'
import { Schema } from 'effect'
import { AnimationValueSchema, AnimationsConfigSchema } from './animations'

describe('AnimationValueSchema', () => {
  test('should accept boolean values', () => {
    // GIVEN: Simple boolean enable/disable
    const enabled = true
    const disabled = false

    // WHEN: Schema validation is performed
    const result1 = Schema.decodeUnknownSync(AnimationValueSchema)(enabled)
    const result2 = Schema.decodeUnknownSync(AnimationValueSchema)(disabled)

    // THEN: Booleans should be accepted
    expect(result1).toBe(true)
    expect(result2).toBe(false)
  })

  test('should accept string values', () => {
    // GIVEN: CSS animation class name
    const className = 'animate-fade-in'

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(AnimationValueSchema)(className)

    // THEN: String should be accepted
    expect(result).toBe('animate-fade-in')
  })

  test('should accept object configuration', () => {
    // GIVEN: Detailed animation config
    const config = {
      enabled: true,
      duration: '300ms',
      easing: 'ease-in-out' as const,
      delay: '0ms',
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(AnimationValueSchema)(config)

    // THEN: Object should be accepted
    expect(result).toEqual(config)
  })
})

describe('AnimationsConfigSchema', () => {
  test('should accept boolean animations', () => {
    // GIVEN: Simple enable/disable animations
    const animations = {
      fadeIn: true,
      slideUp: false,
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(AnimationsConfigSchema)(animations)

    // THEN: Booleans should be accepted
    expect(result.fadeIn).toBe(true)
    expect(result.slideUp).toBe(false)
  })

  test('should accept string animations', () => {
    // GIVEN: CSS class name animations
    const animations = {
      fadeIn: 'animate-fade-in',
      slideUp: 'animate-slide-up',
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(AnimationsConfigSchema)(animations)

    // THEN: Strings should be accepted
    expect(result.fadeIn).toBe('animate-fade-in')
    expect(result.slideUp).toBe('animate-slide-up')
  })

  test('should accept object animations', () => {
    // GIVEN: Detailed animation configurations
    const animations = {
      modalOpen: {
        enabled: true,
        duration: '300ms',
        easing: 'ease-in-out',
      },
      tooltipShow: {
        enabled: true,
        duration: '150ms',
        easing: 'ease-out',
        delay: '100ms',
      },
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(AnimationsConfigSchema)(animations)

    // THEN: Objects should be accepted
    expect(result.modalOpen).toEqual({
      enabled: true,
      duration: '300ms',
      easing: 'ease-in-out',
    })
    expect(result.tooltipShow).toEqual({
      enabled: true,
      duration: '150ms',
      easing: 'ease-out',
      delay: '100ms',
    })
  })

  test('should accept mixed animation types', () => {
    // GIVEN: Mix of boolean, string, and object animations
    const animations = {
      fadeIn: true,
      slideUp: 'animate-slide-up',
      modalOpen: {
        enabled: true,
        duration: '300ms',
      },
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(AnimationsConfigSchema)(animations)

    // THEN: All types should be accepted
    expect(result.fadeIn).toBe(true)
    expect(result.slideUp).toBe('animate-slide-up')
    expect(result.modalOpen).toEqual({
      enabled: true,
      duration: '300ms',
    })
  })

  test('should accept alphanumeric keys', () => {
    // GIVEN: Animation keys with camelCase
    const animations = {
      fadeIn: true,
      fadeInUp: true,
      slideLeft: true,
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(AnimationsConfigSchema)(animations)

    // THEN: All keys should be accepted
    expect(Object.keys(result)).toHaveLength(3)
  })

  test('should reject keys starting with numbers', () => {
    // GIVEN: Invalid key starting with number
    const animations = {
      '2xFade': true,
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(AnimationsConfigSchema)(animations)

    // THEN: Invalid key should be filtered out
    expect(result['2xFade']).toBeUndefined()
  })
})
