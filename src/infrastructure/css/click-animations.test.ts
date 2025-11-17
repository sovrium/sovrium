/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, test, expect } from 'bun:test'
import { generateClickAnimationCSS } from './click-animations'

describe('Click Animations', () => {
  describe('generateClickAnimationCSS', () => {
    test('should generate complete click animation CSS', () => {
      // When
      const result = generateClickAnimationCSS()

      // Then
      expect(result).toContain('/* Click interaction animations */')
    })

    test('should include pulse animation keyframes', () => {
      // When
      const result = generateClickAnimationCSS()

      // Then
      expect(result).toContain('@keyframes pulse')
      expect(result).toContain('transform: scale(1)')
      expect(result).toContain('transform: scale(1.05)')
      expect(result).toContain('.animate-pulse')
      expect(result).toContain('animation: pulse 300ms ease-in-out')
    })

    test('should include bounce animation keyframes', () => {
      // When
      const result = generateClickAnimationCSS()

      // Then
      expect(result).toContain('@keyframes bounce')
      expect(result).toContain('transform: translateY(0)')
      expect(result).toContain('transform: translateY(-8px)')
      expect(result).toContain('transform: translateY(-4px)')
      expect(result).toContain('transform: translateY(-2px)')
      expect(result).toContain('.animate-bounce')
      expect(result).toContain('animation: bounce 300ms ease-out')
    })

    test('should include shake animation keyframes', () => {
      // When
      const result = generateClickAnimationCSS()

      // Then
      expect(result).toContain('@keyframes shake')
      expect(result).toContain('transform: translateX(0)')
      expect(result).toContain('transform: translateX(-4px)')
      expect(result).toContain('transform: translateX(4px)')
      expect(result).toContain('.animate-shake')
      expect(result).toContain('animation: shake 300ms ease-in-out')
    })

    test('should include flash animation keyframes', () => {
      // When
      const result = generateClickAnimationCSS()

      // Then
      expect(result).toContain('@keyframes flash')
      expect(result).toContain('opacity: 1')
      expect(result).toContain('opacity: 0.4')
      expect(result).toContain('.animate-flash')
      expect(result).toContain('animation: flash 300ms ease-in-out')
    })

    test('should include ripple animation keyframes', () => {
      // When
      const result = generateClickAnimationCSS()

      // Then
      expect(result).toContain('@keyframes ripple')
      expect(result).toContain('transform: scale(0)')
      expect(result).toContain('transform: scale(4)')
      expect(result).toContain('opacity: 0')
      expect(result).toContain('.animate-ripple')
      expect(result).toContain('position: relative')
      expect(result).toContain('overflow: hidden')
    })

    test('should include ripple pseudo-element styles', () => {
      // When
      const result = generateClickAnimationCSS()

      // Then
      expect(result).toContain('.animate-ripple::after')
      expect(result).toContain("content: ''")
      expect(result).toContain('position: absolute')
      expect(result).toContain('top: 50%')
      expect(result).toContain('left: 50%')
      expect(result).toContain('width: 100px')
      expect(result).toContain('height: 100px')
      expect(result).toContain('background: rgba(255, 255, 255, 0.5)')
      expect(result).toContain('border-radius: 50%')
      expect(result).toContain('transform: translate(-50%, -50%) scale(0)')
      expect(result).toContain('animation: ripple 600ms ease-out')
    })

    test('should maintain consistent animation durations', () => {
      // When
      const result = generateClickAnimationCSS()

      // Then
      // Most animations should be 300ms
      const pulseMatch = result.match(/animation: pulse (\d+)ms/)
      const bounceMatch = result.match(/animation: bounce (\d+)ms/)
      const shakeMatch = result.match(/animation: shake (\d+)ms/)
      const flashMatch = result.match(/animation: flash (\d+)ms/)
      const rippleMatch = result.match(/animation: ripple (\d+)ms/)

      expect(pulseMatch?.[1]).toBe('300')
      expect(bounceMatch?.[1]).toBe('300')
      expect(shakeMatch?.[1]).toBe('300')
      expect(flashMatch?.[1]).toBe('300')
      expect(rippleMatch?.[1]).toBe('600') // Ripple is longer
    })

    test('should generate valid CSS syntax', () => {
      // When
      const result = generateClickAnimationCSS()

      // Then
      // Check for proper CSS syntax patterns
      expect(result).toMatch(/@keyframes \w+ \{[\s\S]+?\}/) // Keyframes blocks
      expect(result).toMatch(/\.\w+(-\w+)* \{[\s\S]+?\}/) // Class blocks
      expect(result).toMatch(/\d+%,?\s*\d*%?\s*\{/) // Percentage keyframes
      expect(result).not.toContain('undefined')
      expect(result).not.toContain('null')
    })

    test('should include all five animation types', () => {
      // When
      const result = generateClickAnimationCSS()

      // Then
      const animations = ['pulse', 'bounce', 'shake', 'flash', 'ripple']
      animations.forEach((animation) => {
        expect(result).toContain(`@keyframes ${animation}`)
        expect(result).toContain(`.animate-${animation}`)
      })
    })

    test('should return consistent output', () => {
      // Given/When
      const result1 = generateClickAnimationCSS()
      const result2 = generateClickAnimationCSS()

      // Then
      expect(result1).toBe(result2)
    })
  })
})