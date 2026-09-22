/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The console's inherited-token projection — what an app SHIPS when it declares nothing.
 *
 * AUTO-GENERATED from `apps/admin/config/design.ts` — DO NOT EDIT.
 *
 * Regenerate: `bun run build:default-design`
 */

export const INHERITED_COLOR_TOKENS: Readonly<Record<string, string>> = {
  background: 'oklch(0.985 0 0)',
  'background-subtle': 'oklch(0.965 0 0)',
  'background-raised': 'oklch(0.995 0 0)',
  'background-overlay': 'oklch(0.995 0 0)',
  'background-inset': 'oklch(0.952 0 0)',
  foreground: 'oklch(0.14 0 0)',
  'foreground-muted': 'oklch(0.445 0 0)',
  'foreground-subtle': 'oklch(0.54 0 0)',
  'foreground-disabled': 'oklch(0.71 0 0)',
  'foreground-inverse': 'oklch(0.985 0 0)',
  border: 'oklch(0.92 0 0)',
  ring: 'oklch(0.205 0 0)',
  primary: 'oklch(0.205 0 0)',
  'primary-hover': 'oklch(0.272 0 0)',
  'primary-active': 'oklch(0.14 0 0)',
  'primary-foreground': 'oklch(0.985 0 0)',
  'primary-subtle': 'oklch(0.965 0 0)',
  'primary-subtle-foreground': 'oklch(0.205 0 0)',
  success: 'oklch(0.45 0 0)',
  warning: 'oklch(0.72 0 0)',
  error: '#c13520',
  info: '#398ad6',
}

export const INHERITED_RADIUS_TOKENS: Readonly<Record<string, string>> = {
  none: '0px',
  sm: '2px',
  base: '4px',
  md: '6px',
  lg: '8px',
  xl: '12px',
  full: '9999px',
}

export const INHERITED_DURATION_TOKENS: Readonly<Record<string, string>> = {
  fast: '120ms',
  base: '180ms',
  slow: '260ms',
}

export const INHERITED_SHADOW_TOKENS: Readonly<Record<string, string>> = {
  sm: '0 1px 2px rgb(0 0 0 / 0.08)',
  md: '0 4px 12px rgb(0 0 0 / 0.06)',
  lg: '0 8px 24px rgb(0 0 0 / 0.12)',
}

export const INHERITED_EASING_TOKENS: Readonly<Record<string, string>> = {
  default: 'cubic-bezier(0.2, 0, 0, 1)',
  enter: 'cubic-bezier(0, 0, 0.2, 1)',
  exit: 'cubic-bezier(0.4, 0, 1, 1)',
}

export const INHERITED_FONT_TOKENS: Readonly<Record<string, readonly string[]>> = {
  sans: [
    'IBM Plex Sans Variable',
    'IBM Plex Sans',
    '-apple-system',
    'BlinkMacSystemFont',
    'Segoe UI',
    'system-ui',
    'sans-serif',
  ],
  mono: [
    'JetBrains Mono Variable',
    'JetBrains Mono',
    'ui-monospace',
    'SF Mono',
    'Menlo',
    'Consolas',
    'monospace',
  ],
}

export const PLATFORM_TYPE_LADDER: readonly (readonly [string, number, number])[] = [
  ['text-2xs', 10, 14],
  ['text-xs', 11, 16],
  ['text-sm', 12, 18],
  ['text-base', 13, 20],
  ['text-md', 14, 22],
  ['text-lg', 16, 24],
  ['text-xl', 18, 28],
  ['text-2xl', 20, 28],
  ['text-3xl', 24, 32],
  ['text-4xl', 30, 36],
  ['text-5xl', 40, 40],
  ['text-6xl', 48, 48],
]

export const INHERITED_SPACING_TOKENS: Readonly<Record<string, string>> = {}

export const INHERITED_BREAKPOINT_TOKENS: Readonly<Record<string, string>> = {
  sm: '40rem',
  md: '48rem',
  lg: '64rem',
  xl: '80rem',
  '2xl': '96rem',
}

export const ROLE_COLOR_PROPERTY: Readonly<Record<string, string>> = {
  ring: 'focus-ring',
  'primary-foreground': 'primary-fg',
  'primary-subtle-foreground': 'primary-subtle-fg',
  success: 'success-solid',
  warning: 'warning-solid',
  error: 'error-solid',
  info: 'info-solid',
}
