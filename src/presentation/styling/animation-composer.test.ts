/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/// <reference lib="dom" />

import { describe, test, expect } from 'bun:test'
import { composeAnimation } from './animation-composer'
import type { Theme } from '@/domain/models/app/theme'

describe('Animation Composer', () => {
  describe('composeAnimation', () => {
    test('should return empty object when no theme animations', () => {
      // Given
      const config = {
        animationName: 'fadeIn',
        defaultDuration: '300ms',
        defaultEasing: 'ease-out',
      }

      // When
      const result = composeAnimation(config)

      // Then
      expect(result).toEqual({})
    })

    test('should return baseStyle when no animation config', () => {
      // Given
      const baseStyle = { color: 'red', padding: '10px' }
      const config = {
        baseStyle,
        animationName: 'fadeIn',
        defaultDuration: '300ms',
        defaultEasing: 'ease-out',
      }

      // When
      const result = composeAnimation(config)

      // Then
      expect(result).toEqual(baseStyle)
    })

    test('should compose animation with default timing', () => {
      // Given
      const theme: Theme = {
        animations: {
          fadeIn: true,
        },
      } as Theme
      const config = {
        animationName: 'fadeIn',
        theme,
        defaultDuration: '300ms',
        defaultEasing: 'ease-out',
      }

      // When
      const result = composeAnimation(config)

      // Then
      expect(result).toEqual({
        animation: 'fade-in 300ms ease-out',
      })
    })

    test('should convert camelCase animation name to kebab-case', () => {
      // Given
      const theme: Theme = {
        animations: {
          slideInUp: true,
        },
      } as Theme
      const config = {
        animationName: 'slideInUp',
        theme,
        defaultDuration: '500ms',
        defaultEasing: 'ease-in',
      }

      // When
      const result = composeAnimation(config)

      // Then
      expect(result).toEqual({
        animation: 'slide-in-up 500ms ease-in',
      })
    })

    test('should use custom duration from theme', () => {
      // Given
      const theme: Theme = {
        animations: {
          fadeOut: {
            duration: '1s',
          },
        },
      } as Theme
      const config = {
        animationName: 'fadeOut',
        theme,
        defaultDuration: '300ms',
        defaultEasing: 'ease-out',
      }

      // When
      const result = composeAnimation(config)

      // Then
      expect(result).toEqual({
        animation: 'fade-out 1s ease-out',
      })
    })

    test('should use custom easing from theme', () => {
      // Given
      const theme: Theme = {
        animations: {
          bounce: {
            easing: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
          },
        },
      } as Theme
      const config = {
        animationName: 'bounce',
        theme,
        defaultDuration: '300ms',
        defaultEasing: 'ease-out',
      }

      // When
      const result = composeAnimation(config)

      // Then
      expect(result).toEqual({
        animation: 'bounce 300ms cubic-bezier(0.68, -0.55, 0.265, 1.55)',
      })
    })

    test('should use both custom duration and easing from theme', () => {
      // Given
      const theme: Theme = {
        animations: {
          pulse: {
            duration: '2s',
            easing: 'linear',
          },
        },
      } as Theme
      const config = {
        animationName: 'pulse',
        theme,
        defaultDuration: '300ms',
        defaultEasing: 'ease-out',
      }

      // When
      const result = composeAnimation(config)

      // Then
      expect(result).toEqual({
        animation: 'pulse 2s linear',
      })
    })

    test('should merge with baseStyle', () => {
      // Given
      const theme: Theme = {
        animations: {
          fadeIn: true,
        },
      } as Theme
      const config = {
        baseStyle: {
          color: 'blue',
          padding: '20px',
        },
        animationName: 'fadeIn',
        theme,
        defaultDuration: '300ms',
        defaultEasing: 'ease-out',
      }

      // When
      const result = composeAnimation(config)

      // Then
      expect(result).toEqual({
        color: 'blue',
        padding: '20px',
        animation: 'fade-in 300ms ease-out',
      })
    })

    test('should add infinite suffix when option is set', () => {
      // Given
      const theme: Theme = {
        animations: {
          spin: true,
        },
      } as Theme
      const config = {
        animationName: 'spin',
        theme,
        defaultDuration: '1s',
        defaultEasing: 'linear',
        options: {
          infinite: true,
        },
      }

      // When
      const result = composeAnimation(config)

      // Then
      expect(result).toEqual({
        animation: 'spin 1s linear infinite',
      })
    })

    test('should not add infinite suffix when option is false', () => {
      // Given
      const theme: Theme = {
        animations: {
          spin: true,
        },
      } as Theme
      const config = {
        animationName: 'spin',
        theme,
        defaultDuration: '1s',
        defaultEasing: 'linear',
        options: {
          infinite: false,
        },
      }

      // When
      const result = composeAnimation(config)

      // Then
      expect(result).toEqual({
        animation: 'spin 1s linear',
      })
    })

    test('should add animationPlayState when option is set', () => {
      // Given
      const theme: Theme = {
        animations: {
          fadeIn: true,
        },
      } as Theme
      const config = {
        animationName: 'fadeIn',
        theme,
        defaultDuration: '300ms',
        defaultEasing: 'ease-out',
        options: {
          animationPlayState: 'paused',
        },
      }

      // When
      const result = composeAnimation(config)

      // Then
      expect(result).toEqual({
        animation: 'fade-in 300ms ease-out',
        animationPlayState: 'paused',
      })
    })

    test('should add animationFillMode when option is set', () => {
      // Given
      const theme: Theme = {
        animations: {
          slideOut: true,
        },
      } as Theme
      const config = {
        animationName: 'slideOut',
        theme,
        defaultDuration: '300ms',
        defaultEasing: 'ease-in',
        options: {
          animationFillMode: 'forwards',
        },
      }

      // When
      const result = composeAnimation(config)

      // Then
      expect(result).toEqual({
        animation: 'slide-out 300ms ease-in',
        animationFillMode: 'forwards',
      })
    })

    test('should add opacity when option is set', () => {
      // Given
      const theme: Theme = {
        animations: {
          fadeIn: true,
        },
      } as Theme
      const config = {
        animationName: 'fadeIn',
        theme,
        defaultDuration: '300ms',
        defaultEasing: 'ease-out',
        options: {
          opacity: 0,
        },
      }

      // When
      const result = composeAnimation(config)

      // Then
      expect(result).toEqual({
        animation: 'fade-in 300ms ease-out',
        opacity: 0,
      })
    })

    test('should handle opacity value of 1', () => {
      // Given
      const theme: Theme = {
        animations: {
          fadeIn: true,
        },
      } as Theme
      const config = {
        animationName: 'fadeIn',
        theme,
        defaultDuration: '300ms',
        defaultEasing: 'ease-out',
        options: {
          opacity: 1,
        },
      }

      // When
      const result = composeAnimation(config)

      // Then
      expect(result).toEqual({
        animation: 'fade-in 300ms ease-out',
        opacity: 1,
      })
    })

    test('should apply multiple options together', () => {
      // Given
      const theme: Theme = {
        animations: {
          slideIn: {
            duration: '500ms',
            easing: 'ease-in-out',
          },
        },
      } as Theme
      const config = {
        baseStyle: {
          position: 'absolute',
        },
        animationName: 'slideIn',
        theme,
        defaultDuration: '300ms',
        defaultEasing: 'ease-out',
        options: {
          infinite: true,
          animationPlayState: 'running',
          animationFillMode: 'both',
          opacity: 0.5,
        },
      }

      // When
      const result = composeAnimation(config)

      // Then
      expect(result).toEqual({
        position: 'absolute',
        animation: 'slide-in 500ms ease-in-out infinite',
        animationPlayState: 'running',
        animationFillMode: 'both',
        opacity: 0.5,
      })
    })

    test('should create new object, not mutate baseStyle', () => {
      // Given
      const baseStyle = { color: 'red' }
      const theme: Theme = {
        animations: {
          fadeIn: true,
        },
      } as Theme
      const config = {
        baseStyle,
        animationName: 'fadeIn',
        theme,
        defaultDuration: '300ms',
        defaultEasing: 'ease-out',
      }

      // When
      const result = composeAnimation(config)

      // Then
      expect(result).not.toBe(baseStyle) // Different object reference
      expect(baseStyle).toEqual({ color: 'red' }) // Original unchanged
      expect(result).toEqual({
        color: 'red',
        animation: 'fade-in 300ms ease-out',
      })
    })
  })
})
