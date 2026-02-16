/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { generateClickAnimationCSS } from '@/infrastructure/css/styles/click-animations'
import type { Theme } from '@/domain/models/app/theme'

/**
 * Build button classes with optional primary colors
 *
 * @param hasPrimaryColor - Whether theme defines primary color
 * @param hasPrimaryHoverColor - Whether theme defines primary hover color
 * @returns Array of CSS class names for button elements
 */
export function buildButtonClasses(
  hasPrimaryColor: boolean,
  hasPrimaryHoverColor: boolean
): readonly string[] {
  const baseClasses = [
    'inline-flex',
    'items-center',
    'justify-center',
    'rounded-md',
    'px-4',
    'py-2',
    'font-medium',
    'transition-colors',
  ]

  if (hasPrimaryColor && hasPrimaryHoverColor) {
    return [...baseClasses, 'bg-primary', 'text-white', 'hover:bg-primary-hover']
  }
  if (hasPrimaryColor) {
    return [...baseClasses, 'bg-primary', 'text-white']
  }
  return [...baseClasses, 'bg-blue-600', 'text-white', 'hover:bg-blue-700']
}

/**
 * Build button primary utility classes
 *
 * @param hasPrimaryColor - Whether theme defines primary color
 * @param hasPrimaryHoverColor - Whether theme defines primary hover color
 * @returns CSS class string for primary button variant
 */
export function buildButtonPrimaryClasses(
  hasPrimaryColor: boolean,
  hasPrimaryHoverColor: boolean
): string {
  if (hasPrimaryColor && hasPrimaryHoverColor) {
    return 'bg-primary text-white hover:bg-primary-hover'
  }
  if (hasPrimaryColor) {
    return 'bg-primary text-white'
  }
  return 'bg-blue-600 text-white hover:bg-blue-700'
}

/**
 * Build badge border-radius based on theme configuration
 * Uses theme.borderRadius.full if defined, otherwise falls back to rounded-full
 *
 * @param theme - Optional theme configuration
 * @returns CSS rule for badge border-radius
 */
export function buildBadgeBorderRadius(theme?: Theme): string {
  const hasFullRadius = Boolean(theme?.borderRadius?.full)
  return hasFullRadius ? 'border-radius: var(--radius-full);' : '@apply rounded-full;'
}

/**
 * Generate components layer styles with theme color applications
 * Applies theme colors to component classes and button elements
 *
 * @param theme - Optional theme configuration
 * @returns CSS @layer components rule as string
 *
 * @example
 * generateComponentsLayer(theme)
 * // => '@layer components { .container-page { ... } .card { ... } ... }'
 */
export function generateComponentsLayer(theme?: Theme): string {
  const hasPrimaryColor = Boolean(theme?.colors?.primary)
  const hasPrimaryHoverColor = Boolean(theme?.colors?.['primary-hover'])

  const btnClasses = buildButtonClasses(hasPrimaryColor, hasPrimaryHoverColor)
  const btnPrimaryClasses = buildButtonPrimaryClasses(hasPrimaryColor, hasPrimaryHoverColor)
  const badgeBorderRadius = buildBadgeBorderRadius(theme)

  return `@layer components {
      .container-page {
        @apply mx-auto max-w-4xl px-4 py-8;
      }

      .card {
        @apply rounded-lg border border-gray-200 bg-white p-6 shadow-sm;
      }

      .badge {
        @apply border border-gray-200 bg-white px-2 py-1 text-xs font-medium;
        ${badgeBorderRadius}
      }

      button {
        @apply ${btnClasses.join(' ')};
      }

      .btn {
        @apply ${btnClasses.join(' ')};
      }

      .btn-primary {
        @apply ${btnPrimaryClasses};
      }
    }`
}

/**
 * Generate utilities layer styles
 * Combines static utilities with click interaction animations
 *
 * @returns CSS @layer utilities rule as string
 *
 * @example
 * generateUtilitiesLayer()
 * // => '@layer utilities { .text-balance { ... } ... }'
 */
export function generateUtilitiesLayer(): string {
  const clickAnimations = generateClickAnimationCSS()

  return `@layer utilities {
      .text-balance {
        text-wrap: balance;
      }

      /* Safelist: Ensure critical utility classes are always included */
      .text-center {
        text-align: center;
      }

      /* Override Tailwind v4's multi-layer shadow system for shadow-none */
      .shadow-none {
        box-shadow: none !important;
      }

      ${clickAnimations}
    }`
}
