/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, test, expect } from 'bun:test'
import { Schema } from 'effect'
import { EntranceAnimationTypeSchema, EntranceAnimationSchema } from './entrance-animation'

describe('EntranceAnimationTypeSchema', () => {
  test('should accept all entrance animation types', () => {
    // GIVEN: All valid entrance animations
    const animations = [
      'fadeIn',
      'fadeInUp',
      'fadeInDown',
      'zoomIn',
      'slideInUp',
      'slideInDown',
    ] as const

    // WHEN: Schema validation is performed on each
    const results = animations.map((anim) =>
      Schema.decodeUnknownSync(EntranceAnimationTypeSchema)(anim)
    )

    // THEN: All animations should be accepted
    expect(results).toEqual([...animations])
  })

  test('should reject invalid animation type', () => {
    // GIVEN: Invalid animation
    const animation = 'invalid'

    // WHEN: Schema validation is performed
    // THEN: Should be rejected
    expect(() => Schema.decodeUnknownSync(EntranceAnimationTypeSchema)(animation)).toThrow()
  })
})

describe('EntranceAnimationSchema', () => {
  test('should accept entrance with fadeIn animation', () => {
    // GIVEN: FadeIn entrance animation
    const entrance = {
      animation: 'fadeIn',
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(EntranceAnimationSchema)(entrance)

    // THEN: FadeIn should be accepted
    expect(result.animation).toBe('fadeIn')
  })

  test('should accept entrance with fadeInUp animation', () => {
    // GIVEN: FadeInUp animation
    const entrance = {
      animation: 'fadeInUp',
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(EntranceAnimationSchema)(entrance)

    // THEN: FadeInUp should be accepted
    expect(result.animation).toBe('fadeInUp')
  })

  test('should accept entrance with zoomIn animation', () => {
    // GIVEN: ZoomIn animation
    const entrance = {
      animation: 'zoomIn',
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(EntranceAnimationSchema)(entrance)

    // THEN: ZoomIn should be accepted
    expect(result.animation).toBe('zoomIn')
  })

  test('should accept entrance with delay', () => {
    // GIVEN: Entrance with delay
    const entrance = {
      animation: 'fadeIn',
      delay: '500ms',
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(EntranceAnimationSchema)(entrance)

    // THEN: Delay should be accepted
    expect(result.delay).toBe('500ms')
  })

  test('should accept entrance with duration', () => {
    // GIVEN: Entrance with custom duration
    const entrance = {
      animation: 'fadeInUp',
      duration: '1000ms',
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(EntranceAnimationSchema)(entrance)

    // THEN: Duration should be accepted
    expect(result.duration).toBe('1000ms')
  })

  test('should accept entrance with stagger for siblings', () => {
    // GIVEN: Entrance with stagger timing
    const entrance = {
      animation: 'fadeIn',
      stagger: '100ms',
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(EntranceAnimationSchema)(entrance)

    // THEN: Stagger should be accepted
    expect(result.stagger).toBe('100ms')
  })

  test('should accept entrance with delay and stagger', () => {
    // GIVEN: Entrance with both delay and stagger
    const entrance = {
      animation: 'fadeInUp',
      delay: '200ms',
      stagger: '50ms',
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(EntranceAnimationSchema)(entrance)

    // THEN: Both timing properties should be accepted
    expect(result.delay).toBe('200ms')
    expect(result.stagger).toBe('50ms')
  })

  test('should accept entrance with all properties configured', () => {
    // GIVEN: Complete entrance configuration
    const entrance = {
      animation: 'fadeInUp',
      delay: '200ms',
      duration: '800ms',
      stagger: '100ms',
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(EntranceAnimationSchema)(entrance)

    // THEN: All properties should be accepted
    expect(result.animation).toBe('fadeInUp')
    expect(result.delay).toBe('200ms')
    expect(result.duration).toBe('800ms')
    expect(result.stagger).toBe('100ms')
  })

  test('should reject entrance without required animation', () => {
    // GIVEN: Entrance missing animation property
    const entrance = {
      delay: '200ms',
    }

    // WHEN: Schema validation is performed
    // THEN: Should be rejected (animation is required)
    expect(() => Schema.decodeUnknownSync(EntranceAnimationSchema)(entrance)).toThrow()
  })
})
