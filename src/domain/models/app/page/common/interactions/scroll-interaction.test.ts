/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, test, expect } from 'bun:test'
import { Schema } from 'effect'
import { ScrollAnimationSchema, ScrollInteractionSchema } from './scroll-interaction'

describe('ScrollAnimationSchema', () => {
  test('should accept all scroll animation types', () => {
    // GIVEN: All valid scroll animations
    const animations = [
      'fadeIn',
      'fadeInUp',
      'fadeInDown',
      'fadeInLeft',
      'fadeInRight',
      'zoomIn',
      'slideInUp',
      'slideInDown',
    ] as const

    // WHEN: Schema validation is performed on each
    const results = animations.map((anim) => Schema.decodeUnknownSync(ScrollAnimationSchema)(anim))

    // THEN: All animations should be accepted
    expect(results).toEqual([...animations])
  })

  test('should reject invalid animation type', () => {
    // GIVEN: Invalid animation
    const animation = 'invalid'

    // WHEN: Schema validation is performed
    // THEN: Should be rejected
    expect(() => Schema.decodeUnknownSync(ScrollAnimationSchema)(animation)).toThrow()
  })
})

describe('ScrollInteractionSchema', () => {
  test('should accept scroll with fadeInUp animation', () => {
    // GIVEN: Basic scroll animation
    const scroll = {
      animation: 'fadeInUp',
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ScrollInteractionSchema)(scroll)

    // THEN: Animation should be accepted
    expect(result.animation).toBe('fadeInUp')
  })

  test('should accept scroll with fadeIn animation', () => {
    // GIVEN: FadeIn animation
    const scroll = {
      animation: 'fadeIn',
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ScrollInteractionSchema)(scroll)

    // THEN: FadeIn should be accepted
    expect(result.animation).toBe('fadeIn')
  })

  test('should accept scroll with zoomIn animation', () => {
    // GIVEN: ZoomIn animation
    const scroll = {
      animation: 'zoomIn',
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ScrollInteractionSchema)(scroll)

    // THEN: ZoomIn should be accepted
    expect(result.animation).toBe('zoomIn')
  })

  test('should accept scroll with fadeInLeft animation', () => {
    // GIVEN: FadeInLeft animation
    const scroll = {
      animation: 'fadeInLeft',
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ScrollInteractionSchema)(scroll)

    // THEN: FadeInLeft should be accepted
    expect(result.animation).toBe('fadeInLeft')
  })

  test('should accept scroll with threshold 0.1', () => {
    // GIVEN: Scroll with 10% threshold
    const scroll = {
      animation: 'fadeInUp',
      threshold: 0.1,
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ScrollInteractionSchema)(scroll)

    // THEN: Threshold should be accepted
    expect(result.threshold).toBe(0.1)
  })

  test('should accept scroll with threshold 0.5', () => {
    // GIVEN: Scroll with 50% threshold
    const scroll = {
      animation: 'fadeInUp',
      threshold: 0.5,
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ScrollInteractionSchema)(scroll)

    // THEN: 50% threshold should be accepted
    expect(result.threshold).toBe(0.5)
  })

  test('should accept scroll with threshold 1.0', () => {
    // GIVEN: Scroll with 100% threshold
    const scroll = {
      animation: 'fadeInUp',
      threshold: 1.0,
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ScrollInteractionSchema)(scroll)

    // THEN: Full visibility threshold should be accepted
    expect(result.threshold).toBe(1.0)
  })

  test('should accept scroll with delay', () => {
    // GIVEN: Scroll with delay
    const scroll = {
      animation: 'fadeInUp',
      delay: '200ms',
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ScrollInteractionSchema)(scroll)

    // THEN: Delay should be accepted
    expect(result.delay).toBe('200ms')
  })

  test('should accept scroll with duration', () => {
    // GIVEN: Scroll with custom duration
    const scroll = {
      animation: 'fadeInUp',
      duration: '1000ms',
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ScrollInteractionSchema)(scroll)

    // THEN: Duration should be accepted
    expect(result.duration).toBe('1000ms')
  })

  test('should accept scroll with once set to true', () => {
    // GIVEN: Scroll animation triggered once
    const scroll = {
      animation: 'fadeInUp',
      once: true,
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ScrollInteractionSchema)(scroll)

    // THEN: Once flag should be accepted
    expect(result.once).toBe(true)
  })

  test('should accept scroll with once set to false', () => {
    // GIVEN: Scroll animation repeating
    const scroll = {
      animation: 'fadeInUp',
      once: false,
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ScrollInteractionSchema)(scroll)

    // THEN: Repeating animation should be accepted
    expect(result.once).toBe(false)
  })

  test('should accept scroll with all properties configured', () => {
    // GIVEN: Complete scroll configuration
    const scroll = {
      animation: 'fadeInUp',
      threshold: 0.2,
      delay: '100ms',
      duration: '600ms',
      once: true,
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ScrollInteractionSchema)(scroll)

    // THEN: All properties should be accepted
    expect(result.animation).toBe('fadeInUp')
    expect(result.threshold).toBe(0.2)
    expect(result.delay).toBe('100ms')
    expect(result.duration).toBe('600ms')
    expect(result.once).toBe(true)
  })

  test('should reject scroll without required animation', () => {
    // GIVEN: Scroll missing animation property
    const scroll = {
      threshold: 0.5,
    }

    // WHEN: Schema validation is performed
    // THEN: Should be rejected (animation is required)
    expect(() => Schema.decodeUnknownSync(ScrollInteractionSchema)(scroll)).toThrow()
  })

  test('should reject threshold above 1', () => {
    // GIVEN: Invalid threshold
    const scroll = {
      animation: 'fadeInUp',
      threshold: 1.5,
    }

    // WHEN: Schema validation is performed
    // THEN: Should be rejected
    expect(() => Schema.decodeUnknownSync(ScrollInteractionSchema)(scroll)).toThrow()
  })

  test('should reject threshold below 0', () => {
    // GIVEN: Negative threshold
    const scroll = {
      animation: 'fadeInUp',
      threshold: -0.1,
    }

    // WHEN: Schema validation is performed
    // THEN: Should be rejected
    expect(() => Schema.decodeUnknownSync(ScrollInteractionSchema)(scroll)).toThrow()
  })
})
