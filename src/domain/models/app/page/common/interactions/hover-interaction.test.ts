/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, test, expect } from 'bun:test'
import { Schema } from 'effect'
import { EasingFunctionSchema, DurationSchema, HoverInteractionSchema } from './hover-interaction'

describe('EasingFunctionSchema', () => {
  test('should accept all easing function types', () => {
    // GIVEN: All valid easing functions
    const easings = ['linear', 'ease', 'ease-in', 'ease-out', 'ease-in-out'] as const

    // WHEN: Schema validation is performed on each
    const results = easings.map((easing) => Schema.decodeUnknownSync(EasingFunctionSchema)(easing))

    // THEN: All easing functions should be accepted
    expect(results).toEqual([...easings])
  })

  test('should reject invalid easing function', () => {
    // GIVEN: Invalid easing function
    const easing = 'invalid'

    // WHEN: Schema validation is performed
    // THEN: Should be rejected
    expect(() => Schema.decodeUnknownSync(EasingFunctionSchema)(easing)).toThrow()
  })
})

describe('DurationSchema', () => {
  test('should accept duration in milliseconds', () => {
    // GIVEN: Duration in ms
    const duration = '200ms'

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(DurationSchema)(duration)

    // THEN: Millisecond duration should be accepted
    expect(result).toBe('200ms')
  })

  test('should accept duration in seconds', () => {
    // GIVEN: Duration in seconds
    const duration = '0.5s'

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(DurationSchema)(duration)

    // THEN: Second duration should be accepted
    expect(result).toBe('0.5s')
  })

  test('should accept various duration formats', () => {
    // GIVEN: Various duration formats
    const durations = ['200ms', '0.5s', '1s', '1500ms']

    // WHEN: Schema validation is performed on each
    const results = durations.map((d) => Schema.decodeUnknownSync(DurationSchema)(d))

    // THEN: All formats should be accepted
    expect(results).toEqual(durations)
  })

  test('should reject duration without unit', () => {
    // GIVEN: Duration missing ms/s unit
    const duration = '200'

    // WHEN: Schema validation is performed
    // THEN: Should be rejected
    expect(() => Schema.decodeUnknownSync(DurationSchema)(duration)).toThrow()
  })
})

describe('HoverInteractionSchema', () => {
  test('should accept hover with transform scale', () => {
    // GIVEN: Hover with scale transform
    const hover = {
      transform: 'scale(1.05)',
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(HoverInteractionSchema)(hover)

    // THEN: Transform should be accepted
    expect(result.transform).toBe('scale(1.05)')
  })

  test('should accept hover with opacity', () => {
    // GIVEN: Hover with opacity change
    const hover = {
      opacity: 0.8,
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(HoverInteractionSchema)(hover)

    // THEN: Opacity should be accepted
    expect(result.opacity).toBe(0.8)
  })

  test('should accept hover with backgroundColor and color', () => {
    // GIVEN: Hover with color changes
    const hover = {
      backgroundColor: '#007bff',
      color: '#ffffff',
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(HoverInteractionSchema)(hover)

    // THEN: Both colors should be accepted
    expect(result.backgroundColor).toBe('#007bff')
    expect(result.color).toBe('#ffffff')
  })

  test('should accept hover with shadow', () => {
    // GIVEN: Hover with box shadow
    const hover = {
      shadow: '0 10px 25px rgba(0,0,0,0.1)',
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(HoverInteractionSchema)(hover)

    // THEN: Shadow should be accepted
    expect(result.shadow).toBe('0 10px 25px rgba(0,0,0,0.1)')
  })

  test('should accept hover with custom duration and easing', () => {
    // GIVEN: Hover with timing configuration
    const hover = {
      transform: 'scale(1.05)',
      duration: '200ms',
      easing: 'ease-out',
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(HoverInteractionSchema)(hover)

    // THEN: All timing properties should be accepted
    expect(result.duration).toBe('200ms')
    expect(result.easing).toBe('ease-out')
  })

  test('should accept hover with multiple effects', () => {
    // GIVEN: Hover with multiple simultaneous effects
    const hover = {
      transform: 'scale(1.05)',
      shadow: '0 10px 25px rgba(0,0,0,0.15)',
      duration: '200ms',
      easing: 'ease-out',
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(HoverInteractionSchema)(hover)

    // THEN: All effects should be accepted
    expect(result.transform).toBe('scale(1.05)')
    expect(result.shadow).toBe('0 10px 25px rgba(0,0,0,0.15)')
    expect(result.duration).toBe('200ms')
    expect(result.easing).toBe('ease-out')
  })

  test('should accept hover with borderColor', () => {
    // GIVEN: Hover with border color change
    const hover = {
      borderColor: '#007bff',
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(HoverInteractionSchema)(hover)

    // THEN: Border color should be accepted
    expect(result.borderColor).toBe('#007bff')
  })

  test('should accept hover with opacity at maximum', () => {
    // GIVEN: Hover with full opacity
    const hover = {
      opacity: 1.0,
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(HoverInteractionSchema)(hover)

    // THEN: Maximum opacity should be accepted
    expect(result.opacity).toBe(1.0)
  })

  test('should accept hover with opacity at minimum', () => {
    // GIVEN: Hover with zero opacity
    const hover = {
      opacity: 0.0,
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(HoverInteractionSchema)(hover)

    // THEN: Minimum opacity should be accepted
    expect(result.opacity).toBe(0.0)
  })

  test('should reject hover with opacity above 1', () => {
    // GIVEN: Invalid opacity value
    const hover = {
      opacity: 1.5,
    }

    // WHEN: Schema validation is performed
    // THEN: Should be rejected
    expect(() => Schema.decodeUnknownSync(HoverInteractionSchema)(hover)).toThrow()
  })

  test('should reject hover with opacity below 0', () => {
    // GIVEN: Invalid negative opacity
    const hover = {
      opacity: -0.1,
    }

    // WHEN: Schema validation is performed
    // THEN: Should be rejected
    expect(() => Schema.decodeUnknownSync(HoverInteractionSchema)(hover)).toThrow()
  })

  test('should accept hover with scale number', () => {
    // GIVEN: Hover with scale factor
    const hover = {
      scale: 1.05,
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(HoverInteractionSchema)(hover)

    // THEN: Scale should be accepted
    expect(result.scale).toBe(1.05)
  })

  test('should accept hover with scale and other properties', () => {
    // GIVEN: Hover with scale and additional effects
    const hover = {
      scale: 1.1,
      shadow: '0 10px 25px rgba(0,0,0,0.15)',
      duration: '300ms',
      easing: 'ease-out',
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(HoverInteractionSchema)(hover)

    // THEN: All properties should be accepted
    expect(result.scale).toBe(1.1)
    expect(result.shadow).toBe('0 10px 25px rgba(0,0,0,0.15)')
    expect(result.duration).toBe('300ms')
    expect(result.easing).toBe('ease-out')
  })

  test('should accept empty hover interaction', () => {
    // GIVEN: Empty hover config
    const hover = {}

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(HoverInteractionSchema)(hover)

    // THEN: Empty object should be accepted
    expect(result).toEqual({})
  })
})
