/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, test, expect } from 'bun:test'
import { Schema } from 'effect'
import {
  ClickAnimationSchema,
  ElementIdSelectorSchema,
  ClickInteractionSchema,
} from './click-interaction'

describe('ClickAnimationSchema', () => {
  test('should accept all animation types', () => {
    // GIVEN: All valid animation types
    const animations = ['pulse', 'bounce', 'shake', 'flash', 'ripple', 'none'] as const

    // WHEN: Schema validation is performed on each
    const results = animations.map((anim) => Schema.decodeUnknownSync(ClickAnimationSchema)(anim))

    // THEN: All animations should be accepted
    expect(results).toEqual([...animations])
  })

  test('should reject invalid animation type', () => {
    // GIVEN: Invalid animation type
    const animation = 'invalid'

    // WHEN: Schema validation is performed
    // THEN: Should be rejected
    expect(() => Schema.decodeUnknownSync(ClickAnimationSchema)(animation)).toThrow()
  })
})

describe('ElementIdSelectorSchema', () => {
  test('should accept valid element ID selectors', () => {
    // GIVEN: Valid #elementId selectors
    const selectors = ['#hero-section', '#pricing', '#contactForm']

    // WHEN: Schema validation is performed on each
    const results = selectors.map((sel) => Schema.decodeUnknownSync(ElementIdSelectorSchema)(sel))

    // THEN: All selectors should be accepted
    expect(results).toEqual(selectors)
  })

  test('should reject selector without hash', () => {
    // GIVEN: Selector missing # prefix
    const selector = 'hero-section'

    // WHEN: Schema validation is performed
    // THEN: Should be rejected
    expect(() => Schema.decodeUnknownSync(ElementIdSelectorSchema)(selector)).toThrow()
  })

  test('should reject selector starting with number', () => {
    // GIVEN: Selector starting with number after #
    const selector = '#2section'

    // WHEN: Schema validation is performed
    // THEN: Should be rejected
    expect(() => Schema.decodeUnknownSync(ElementIdSelectorSchema)(selector)).toThrow()
  })
})

describe('ClickInteractionSchema', () => {
  test('should accept click interaction with animation and navigate', () => {
    // GIVEN: Click with animation and navigation
    const interaction = {
      animation: 'pulse',
      navigate: '/contact',
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ClickInteractionSchema)(interaction)

    // THEN: Both properties should be accepted
    expect(result.animation).toBe('pulse')
    expect(result.navigate).toBe('/contact')
  })

  test('should accept click interaction with animation and scrollTo', () => {
    // GIVEN: Click with animation and scroll
    const interaction = {
      animation: 'ripple',
      scrollTo: '#pricing-section',
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ClickInteractionSchema)(interaction)

    // THEN: Animation and scrollTo should be accepted
    expect(result.animation).toBe('ripple')
    expect(result.scrollTo).toBe('#pricing-section')
  })

  test('should accept click interaction with external URL', () => {
    // GIVEN: Click to open external URL
    const interaction = {
      openUrl: 'https://example.com',
      openInNewTab: true,
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ClickInteractionSchema)(interaction)

    // THEN: URL and new tab flag should be accepted
    expect(result.openUrl).toBe('https://example.com')
    expect(result.openInNewTab).toBe(true)
  })

  test('should accept click interaction with navigate to anchor', () => {
    // GIVEN: Click to navigate to page anchor
    const interaction = {
      navigate: '#pricing-section',
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ClickInteractionSchema)(interaction)

    // THEN: Anchor navigation should be accepted
    expect(result.navigate).toBe('#pricing-section')
  })

  test('should accept click interaction with toggleElement', () => {
    // GIVEN: Click to toggle element visibility
    const interaction = {
      toggleElement: '#mobile-menu',
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ClickInteractionSchema)(interaction)

    // THEN: Toggle element should be accepted
    expect(result.toggleElement).toBe('#mobile-menu')
  })

  test('should accept click interaction with submitForm', () => {
    // GIVEN: Click to submit form
    const interaction = {
      submitForm: '#contact-form',
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ClickInteractionSchema)(interaction)

    // THEN: Submit form should be accepted
    expect(result.submitForm).toBe('#contact-form')
  })

  test('should accept click interaction with animation pulse and navigate', () => {
    // GIVEN: Animation then navigation
    const interaction = {
      animation: 'pulse',
      navigate: '/signup',
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ClickInteractionSchema)(interaction)

    // THEN: Combined actions should be accepted
    expect(result.animation).toBe('pulse')
    expect(result.navigate).toBe('/signup')
  })

  test('should accept click interaction with animation bounce', () => {
    // GIVEN: Bounce animation only
    const interaction = {
      animation: 'bounce',
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ClickInteractionSchema)(interaction)

    // THEN: Bounce animation should be accepted
    expect(result.animation).toBe('bounce')
  })

  test('should accept click interaction with animation none', () => {
    // GIVEN: No animation
    const interaction = {
      animation: 'none',
      navigate: '/products',
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ClickInteractionSchema)(interaction)

    // THEN: None animation should be accepted
    expect(result.animation).toBe('none')
  })

  test('should accept empty click interaction', () => {
    // GIVEN: Empty interaction (all properties optional)
    const interaction = {}

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ClickInteractionSchema)(interaction)

    // THEN: Empty object should be accepted
    expect(result).toEqual({})
  })
})
