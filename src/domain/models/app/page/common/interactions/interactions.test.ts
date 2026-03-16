/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, test, expect } from 'bun:test'
import { Schema } from 'effect'
import { InteractionsSchema } from './interactions'

describe('InteractionsSchema', () => {
  test('should accept interactions with only hover', () => {
    // GIVEN: Hover-only interaction
    const interactions = {
      hover: {
        transform: 'scale(1.05)',
        duration: '200ms',
      },
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(InteractionsSchema)(interactions)

    // THEN: Hover interaction should be accepted
    expect(result.hover?.transform).toBe('scale(1.05)')
    expect(result.hover?.duration).toBe('200ms')
  })

  test('should accept interactions with only click', () => {
    // GIVEN: Click-only interaction
    const interactions = {
      click: {
        animation: 'pulse',
        navigate: '/contact',
      },
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(InteractionsSchema)(interactions)

    // THEN: Click interaction should be accepted
    expect(result.click?.animation).toBe('pulse')
    expect(result.click?.navigate).toBe('/contact')
  })

  test('should accept interactions with only scroll', () => {
    // GIVEN: Scroll-only interaction
    const interactions = {
      scroll: {
        animation: 'fadeInUp',
        threshold: 0.2,
      },
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(InteractionsSchema)(interactions)

    // THEN: Scroll interaction should be accepted
    expect(result.scroll?.animation).toBe('fadeInUp')
    expect(result.scroll?.threshold).toBe(0.2)
  })

  test('should accept interactions with only entrance', () => {
    // GIVEN: Entrance-only interaction
    const interactions = {
      entrance: {
        animation: 'zoomIn',
        delay: '100ms',
      },
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(InteractionsSchema)(interactions)

    // THEN: Entrance animation should be accepted
    expect(result.entrance?.animation).toBe('zoomIn')
    expect(result.entrance?.delay).toBe('100ms')
  })

  test('should accept interactions with hover and click', () => {
    // GIVEN: Combined hover and click interactions
    const interactions = {
      hover: {
        transform: 'scale(1.05)',
        duration: '200ms',
        easing: 'ease-out',
      },
      click: {
        animation: 'pulse',
        navigate: '/contact',
      },
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(InteractionsSchema)(interactions)

    // THEN: Both interaction types should be accepted
    expect(result.hover?.transform).toBe('scale(1.05)')
    expect(result.click?.navigate).toBe('/contact')
  })

  test('should accept interactions with entrance and scroll', () => {
    // GIVEN: Entrance and scroll interactions
    const interactions = {
      entrance: {
        animation: 'fadeInUp',
        delay: '100ms',
      },
      scroll: {
        animation: 'zoomIn',
        threshold: 0.5,
      },
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(InteractionsSchema)(interactions)

    // THEN: Both animations should be accepted
    expect(result.entrance?.animation).toBe('fadeInUp')
    expect(result.scroll?.animation).toBe('zoomIn')
  })

  test('should accept interactions with all four types', () => {
    // GIVEN: All interaction types configured
    const interactions = {
      hover: {
        transform: 'scale(1.05)',
        duration: '200ms',
        easing: 'ease-out',
      },
      click: {
        animation: 'pulse',
        navigate: '/contact',
      },
      scroll: {
        animation: 'fadeInUp',
        threshold: 0.2,
      },
      entrance: {
        animation: 'fadeIn',
        delay: '100ms',
      },
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(InteractionsSchema)(interactions)

    // THEN: All four interaction types should be accepted
    expect(result.hover?.transform).toBe('scale(1.05)')
    expect(result.click?.navigate).toBe('/contact')
    expect(result.scroll?.animation).toBe('fadeInUp')
    expect(result.entrance?.animation).toBe('fadeIn')
  })

  test('should accept interactions with hover transform and click navigation', () => {
    // GIVEN: Button with hover and click behaviors
    const interactions = {
      hover: {
        transform: 'scale(1.05)',
      },
      click: {
        navigate: '/signup',
      },
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(InteractionsSchema)(interactions)

    // THEN: Both behaviors should work independently
    expect(result.hover?.transform).toBe('scale(1.05)')
    expect(result.click?.navigate).toBe('/signup')
  })

  test('should accept empty interactions object', () => {
    // GIVEN: Empty interactions (all optional)
    const interactions = {}

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(InteractionsSchema)(interactions)

    // THEN: Empty object should be accepted
    expect(result).toEqual({})
  })
})
