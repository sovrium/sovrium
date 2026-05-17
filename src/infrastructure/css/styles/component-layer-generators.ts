/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { generateClickAnimationCSS } from '@/infrastructure/css/styles/click-animations'
import type { Theme } from '@/domain/models/app/theme'

/**
 * Check if a theme color token is defined
 */
const hasColor = (theme: Theme | undefined, key: string): boolean =>
  Boolean(theme?.colors?.[key as keyof NonNullable<Theme['colors']>])

/**
 * Pick themed or fallback class
 */
const themed = (
  theme: Theme | undefined,
  key: string,
  ifThemed: string,
  fallback: string
): string => (hasColor(theme, key) ? ifThemed : fallback)

/**
 * A single themed slot: when `theme.colors[token]` is defined, emit
 * `ifThemed`; otherwise emit `fallback`. Empty strings are filtered out
 * from the joined output.
 */
type ThemedSlot = {
  readonly token: string
  readonly ifThemed: string
  readonly fallback: string
}

/**
 * Marker recognising a slot vs a static class string in the parts array.
 */
const isSlot = (part: string | ThemedSlot): part is ThemedSlot =>
  typeof part === 'object' && part !== null && 'token' in part

/**
 * Resolve an ordered list of class parts (mixing static strings and themed
 * slots) into a single space-separated class string. Empty strings emitted
 * by slots are dropped, exactly like the previous hand-written builders.
 *
 * @example
 * buildThemedClass(theme, [
 *   'rounded-lg',
 *   'border',
 *   { token: 'border', ifThemed: 'border-border', fallback: 'border-gray-200' },
 *   { token: 'card', ifThemed: 'bg-card', fallback: 'bg-white' },
 *   { token: 'card', ifThemed: 'text-card-foreground', fallback: '' },
 *   'p-6',
 *   'shadow-sm',
 * ])
 */
function buildThemedClass(
  theme: Theme | undefined,
  parts: readonly (string | ThemedSlot)[]
): string {
  return parts
    .map((part) =>
      isSlot(part) ? (hasColor(theme, part.token) ? part.ifThemed : part.fallback) : part
    )
    .filter(Boolean)
    .join(' ')
}

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
 * Build card component classes based on theme tokens
 *
 * @param theme - Optional theme configuration
 * @returns CSS class string for .card
 */
export function buildCardClasses(theme?: Theme): string {
  return buildThemedClass(theme, [
    'rounded-lg',
    'border',
    { token: 'border', ifThemed: 'border-border', fallback: 'border-gray-200' },
    { token: 'card', ifThemed: 'bg-card', fallback: 'bg-white' },
    { token: 'card', ifThemed: 'text-card-foreground', fallback: '' },
    'p-6',
    'shadow-sm',
  ])
}

/**
 * Build badge component classes based on theme tokens
 *
 * @param theme - Optional theme configuration
 * @returns CSS class string for .badge (excluding border-radius which is handled separately)
 */
export function buildBadgeClasses(theme?: Theme): string {
  return buildThemedClass(theme, [
    'border',
    { token: 'border', ifThemed: 'border-border', fallback: 'border-gray-200' },
    { token: 'muted', ifThemed: 'bg-muted', fallback: 'bg-gray-100' },
    { token: 'muted', ifThemed: 'text-muted-foreground', fallback: 'text-gray-700' },
    'px-2',
    'py-1',
    'text-xs',
    'font-medium',
  ])
}

/**
 * Build input element classes based on theme tokens
 *
 * @param theme - Optional theme configuration
 * @returns CSS class string for input/select/textarea base styles
 */
export function buildInputClasses(theme?: Theme): string {
  const border = themed(theme, 'input', 'border-input', 'border-gray-300')
  const bg = themed(theme, 'background', 'bg-background', 'bg-white')
  const text =
    hasColor(theme, 'background') && hasColor(theme, 'foreground') ? 'text-foreground' : ''
  const focusRing = themed(theme, 'ring', 'focus:ring-ring', 'focus:ring-blue-500')

  return [border, bg, text, 'focus:ring-2', focusRing, 'focus:ring-offset-2']
    .filter(Boolean)
    .join(' ')
}

/**
 * Build modal component classes based on theme tokens
 *
 * @param theme - Optional theme configuration
 * @returns Object with overlay and content CSS class strings
 */
export function buildModalClasses(theme?: Theme): {
  readonly overlay: string
  readonly content: string
} {
  return {
    overlay: buildThemedClass(theme, [
      'fixed',
      'inset-0',
      { token: 'background', ifThemed: 'bg-background/80', fallback: 'bg-black/50' },
      'backdrop-blur-sm',
    ]),
    content: buildThemedClass(theme, [
      { token: 'card', ifThemed: 'bg-card', fallback: 'bg-white' },
      { token: 'card', ifThemed: 'text-card-foreground', fallback: '' },
      'border',
      { token: 'border', ifThemed: 'border-border', fallback: 'border-gray-200' },
      'rounded-lg',
      'shadow-lg',
    ]),
  }
}

/**
 * Build alert variant classes based on theme tokens
 *
 * @param theme - Optional theme configuration
 * @returns Object with CSS class strings per alert variant
 */
export function buildAlertClasses(theme?: Theme): {
  readonly info: string
  readonly warning: string
  readonly error: string
  readonly success: string
} {
  return {
    info: themed(
      theme,
      'info',
      'bg-info/10 text-info border border-info/20',
      'bg-blue-50 text-blue-700 border border-blue-200'
    ),
    warning: themed(
      theme,
      'warning',
      'bg-warning/10 text-warning border border-warning/20',
      'bg-yellow-50 text-yellow-700 border border-yellow-200'
    ),
    error: themed(
      theme,
      'destructive',
      'bg-destructive/10 text-destructive border border-destructive/20',
      'bg-red-50 text-red-700 border border-red-200'
    ),
    success: themed(
      theme,
      'success',
      'bg-success/10 text-success border border-success/20',
      'bg-green-50 text-green-700 border border-green-200'
    ),
  }
}

/**
 * Build toast component classes based on theme tokens
 *
 * @param theme - Optional theme configuration
 * @returns CSS class string for .toast
 */
export function buildToastClasses(theme?: Theme): string {
  return buildThemedClass(theme, [
    { token: 'card', ifThemed: 'bg-card', fallback: 'bg-white' },
    { token: 'card', ifThemed: 'text-card-foreground', fallback: '' },
    'border',
    { token: 'border', ifThemed: 'border-border', fallback: 'border-gray-200' },
    'shadow-lg',
    'rounded-lg',
    'p-4',
  ])
}

/**
 * Build navigation component classes based on theme tokens
 *
 * @param theme - Optional theme configuration
 * @returns CSS class string for .nav
 */
export function buildNavClasses(theme?: Theme): string {
  return buildThemedClass(theme, [
    { token: 'background', ifThemed: 'bg-background', fallback: 'bg-white' },
    'border-b',
    { token: 'border', ifThemed: 'border-border', fallback: 'border-gray-200' },
  ])
}

/**
 * Build sidebar component classes based on theme tokens
 *
 * @param theme - Optional theme configuration
 * @returns CSS class string for .sidebar
 */
export function buildSidebarClasses(theme?: Theme): string {
  return buildThemedClass(theme, [
    { token: 'card', ifThemed: 'bg-card', fallback: 'bg-white' },
    'border-r',
    { token: 'border', ifThemed: 'border-border', fallback: 'border-gray-200' },
  ])
}

/**
 * Build data table component classes based on theme tokens
 *
 * @param theme - Optional theme configuration
 * @returns Object with header and row hover CSS class strings
 */
export function buildDataTableClasses(theme?: Theme): {
  readonly header: string
  readonly rowHover: string
} {
  return {
    header: buildThemedClass(theme, [
      { token: 'muted', ifThemed: 'bg-muted', fallback: 'bg-gray-50' },
      { token: 'muted', ifThemed: 'text-muted-foreground', fallback: 'text-gray-600' },
    ]),
    rowHover: buildThemedClass(theme, [
      { token: 'muted', ifThemed: 'bg-muted/50', fallback: 'bg-gray-50' },
    ]),
  }
}

/**
 * Build button variant classes based on theme tokens
 *
 * @param theme - Optional theme configuration
 * @returns Object with CSS class strings per button variant
 */
export function buildButtonVariantClasses(theme?: Theme): {
  readonly secondary: string
  readonly destructive: string
  readonly outline: string
  readonly ghost: string
  readonly link: string
} {
  return {
    secondary: themed(
      theme,
      'secondary',
      'bg-secondary text-secondary-foreground hover:bg-secondary/80',
      'bg-gray-600 text-white hover:bg-gray-700'
    ),
    destructive: themed(
      theme,
      'destructive',
      'bg-destructive text-destructive-foreground hover:bg-destructive/90',
      'bg-red-600 text-white hover:bg-red-700'
    ),
    outline: [
      'border',
      themed(theme, 'input', 'border-input', 'border-gray-300'),
      themed(theme, 'input', 'bg-background', 'bg-white'),
      themed(theme, 'muted', 'hover:bg-muted', 'hover:bg-gray-100'),
      themed(theme, 'muted', 'hover:text-muted-foreground', 'hover:text-gray-700'),
    ].join(' '),
    ghost: (() => {
      if (!hasColor(theme, 'muted')) {
        return 'bg-transparent hover:bg-gray-100 hover:text-gray-700'
      }
      const textClass = hasColor(theme, 'foreground') ? 'text-foreground' : 'text-gray-700'
      return `bg-transparent ${textClass} hover:bg-muted hover:text-muted-foreground`
    })(),
    link: themed(
      theme,
      'primary',
      'text-primary underline-offset-4 hover:underline',
      'text-blue-600 underline-offset-4 hover:underline'
    ),
  }
}

/**
 * Build badge variant classes based on theme tokens
 *
 * @param theme - Optional theme configuration
 * @returns Object with CSS class strings per badge variant
 */
function buildBadgeOutlineClasses(theme?: Theme): string {
  const hasBorderColor = Boolean(theme?.colors?.border)
  if (!hasBorderColor) {
    return 'border border-gray-200 text-gray-900 bg-transparent'
  }
  const textClass = hasColor(theme, 'foreground') ? 'text-foreground' : 'text-gray-900'
  return `border border-border ${textClass} bg-transparent`
}

export function buildBadgeVariantClasses(theme?: Theme): {
  readonly secondary: string
  readonly destructive: string
  readonly outline: string
} {
  const hasSecondaryColor = Boolean(theme?.colors?.secondary)
  const hasDestructiveColor = Boolean(theme?.colors?.destructive)

  return {
    secondary: hasSecondaryColor
      ? 'bg-secondary text-secondary-foreground'
      : 'bg-gray-600 text-white',
    destructive: hasDestructiveColor
      ? 'bg-destructive text-destructive-foreground'
      : 'bg-red-600 text-white',
    outline: buildBadgeOutlineClasses(theme),
  }
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
function generateButtonAndBadgeRules(theme?: Theme): string {
  const hasPrimaryColor = hasColor(theme, 'primary')
  const hasPrimaryHoverColor = hasColor(theme, 'primary-hover')
  const btnClasses = buildButtonClasses(hasPrimaryColor, hasPrimaryHoverColor)
  const btnPrimaryClasses = buildButtonPrimaryClasses(hasPrimaryColor, hasPrimaryHoverColor)
  const btnVariants = buildButtonVariantClasses(theme)
  const badgeVariants = buildBadgeVariantClasses(theme)

  return `
      .btn { @apply ${btnClasses.join(' ')}; }
      .btn-primary { @apply ${btnPrimaryClasses}; }
      .btn-secondary { @apply ${btnVariants.secondary}; }
      .btn-destructive { @apply ${btnVariants.destructive}; }
      .btn-outline { @apply ${btnVariants.outline}; }
      .btn-ghost { @apply ${btnVariants.ghost}; }
      .btn-link { @apply ${btnVariants.link}; }
      .btn-sm { @apply py-1 px-3 text-sm; }
      .btn-lg { @apply py-3 px-6; }
      .btn-icon { @apply p-0 h-9 w-9; }
      .badge-secondary { @apply ${badgeVariants.secondary}; }
      .badge-destructive { @apply ${badgeVariants.destructive}; }
      .badge-outline { @apply ${badgeVariants.outline}; }`
}

function generateLayoutRules(theme?: Theme): string {
  const modalClasses = buildModalClasses(theme)
  const alertClasses = buildAlertClasses(theme)
  const dataTableClasses = buildDataTableClasses(theme)

  return `
      input, select, textarea { @apply ${buildInputClasses(theme)}; }
      .modal-overlay { @apply ${modalClasses.overlay}; }
      .modal-content { @apply ${modalClasses.content}; }
      .toast { @apply ${buildToastClasses(theme)}; }
      .nav { @apply ${buildNavClasses(theme)}; }
      .sidebar { @apply ${buildSidebarClasses(theme)}; }
      .alert-info { @apply ${alertClasses.info}; }
      .alert-warning { @apply ${alertClasses.warning}; }
      .alert-error { @apply ${alertClasses.error}; }
      .alert-success { @apply ${alertClasses.success}; }
      .data-table th { @apply ${dataTableClasses.header}; }
      .data-table tbody tr:hover { @apply ${dataTableClasses.rowHover}; }`
}

export function generateComponentsLayer(theme?: Theme): string {
  return `@layer components {
      .container-page { @apply mx-auto max-w-4xl px-4 py-8; }
      .card { @apply ${buildCardClasses(theme)}; }
      .badge { @apply ${buildBadgeClasses(theme)}; ${buildBadgeBorderRadius(theme)} }
${generateButtonAndBadgeRules(theme)}
${generateLayoutRules(theme)}
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
