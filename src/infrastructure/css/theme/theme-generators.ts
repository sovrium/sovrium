/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { BorderRadiusConfig } from '@/domain/models/app/theme/border-radius'
import type { BreakpointsConfig } from '@/domain/models/app/theme/breakpoints'
import type { ColorsConfig } from '@/domain/models/app/theme/colors'
import type { FontsConfig } from '@/domain/models/app/theme/fonts'
import type { ShadowsConfig } from '@/domain/models/app/theme/shadows'
import type { SpacingConfig } from '@/domain/models/app/theme/spacing'

const COLORS_NEEDING_FOREGROUND = [
  'primary',
  'secondary',
  'destructive',
  'card',
  'muted',
  'accent',
  'popover',
] as const

const COLOR_TO_SV_TOKEN: Record<string, string> = {
  primary: 'primary',
  'primary-hover': 'primary-hover',
  'primary-active': 'primary-active',
  'primary-foreground': 'primary-fg',
  'primary-subtle': 'primary-subtle',
  'primary-subtle-foreground': 'primary-subtle-fg',
  background: 'bg',
  'background-subtle': 'bg-subtle',
  'background-raised': 'bg-raised',
  'background-overlay': 'bg-overlay',
  foreground: 'fg',
  'foreground-muted': 'fg-muted',
  'foreground-subtle': 'fg-subtle',
  'foreground-disabled': 'fg-disabled',
  'foreground-inverse': 'fg-inverse',
  muted: 'bg-subtle',
  'muted-foreground': 'fg-muted',
  card: 'bg-raised',
  popover: 'bg-overlay',
  border: 'border',
  ring: 'focus-ring',
  warmth: 'warmth',
  'warmth-fg': 'warmth-fg',
  'warmth-foreground': 'warmth-fg',
  'warmth-subtle': 'warmth-subtle',
  'warmth-border': 'warmth-border',
  success: 'success-solid',
  warning: 'warning-solid',
  error: 'error-solid',
  destructive: 'error-solid',
  'destructive-foreground': 'error-solid-fg',
  info: 'info-solid',
}

export function generateThemeColors(colors?: ColorsConfig): string {
  if (!colors || Object.keys(colors).length === 0) return ''

  const colorEntries = Object.entries(colors).map(([name, value]) => {
    return `    --color-${name}: ${value};`
  })

  const derivedForegrounds = COLORS_NEEDING_FOREGROUND.flatMap((base) => {
    const foregroundKey = `${base}-foreground`
    if (colors[base] && !colors[foregroundKey]) {
      return [`    --color-${foregroundKey}: #ffffff;`]
    }
    return []
  })

  const baseForeground =
    colors['background'] && !colors['foreground'] ? ['    --color-foreground: #09090b;'] : []

  return [...colorEntries, ...derivedForegrounds, ...baseForeground].join('\n')
}

export function generateAuthorSvBridge(colors?: ColorsConfig): string {
  if (!colors || Object.keys(colors).length === 0) return ''

  const svBridgeEntries = Object.entries(colors).flatMap(([name, value]) => {
    const svKey = COLOR_TO_SV_TOKEN[name]
    if (!svKey) return []
    return [`    --sv-${svKey}: ${value};`]
  })

  const derivedBorderStrong =
    colors['border'] && !colors['border-strong']
      ? [`    --sv-border-strong: ${colors['border']};`]
      : []

  const allEntries = [...svBridgeEntries, ...derivedBorderStrong]
  if (allEntries.length === 0) return ''

  return `:root {\n${allEntries.join('\n')}\n  }`
}

export function generateThemeFonts(fonts?: FontsConfig): string {
  if (!fonts || Object.keys(fonts).length === 0) return ''

  const fontEntries = Object.entries(fonts).flatMap(([category, config]) => {
    const fontConfig = config as {
      family: string
      fallback?: string
      style?: string
      transform?: string
      letterSpacing?: string
    }
    const fontStack = fontConfig.fallback
      ? `${fontConfig.family}, ${fontConfig.fallback}`
      : fontConfig.family

    const baseEntry = `    --font-${category}: ${fontStack};`

    const styleEntry =
      fontConfig.style && fontConfig.style !== 'normal'
        ? `    --font-${category}-style: ${fontConfig.style};`
        : undefined

    const transformEntry =
      fontConfig.transform && fontConfig.transform !== 'none'
        ? `    --font-${category}-transform: ${fontConfig.transform};`
        : undefined

    const letterSpacingEntry = fontConfig.letterSpacing
      ? `    --font-${category}-letter-spacing: ${fontConfig.letterSpacing};`
      : undefined

    return [baseEntry, styleEntry, transformEntry, letterSpacingEntry].filter(
      (entry): entry is string => entry !== undefined
    )
  })

  return fontEntries.join('\n')
}

function generateVarBlock(
  config: Readonly<Record<string, string>> | undefined,
  prefix: string,
  options?: {
    readonly filter?: (key: string, value: string) => boolean
    readonly varName?: (key: string) => string
  }
): string {
  if (!config || Object.keys(config).length === 0) return ''

  const varName = options?.varName ?? ((key: string) => `${prefix}-${key}`)

  return Object.entries(config)
    .filter(([key, value]) => options?.filter?.(key, value) ?? true)
    .map(([key, value]) => `    --${varName(key)}: ${value};`)
    .join('\n')
}

export function generateThemeSpacing(spacing?: SpacingConfig): string {
  return generateVarBlock(spacing as Record<string, string> | undefined, 'spacing', {
    filter: (_key, value) => /^[0-9.]+(?:rem|px|em|%)$/.test(value),
  })
}

export function generateThemeShadows(shadows?: ShadowsConfig): string {
  return generateVarBlock(shadows as Record<string, string> | undefined, 'shadow')
}

export function generateThemeBorderRadius(borderRadius?: BorderRadiusConfig): string {
  return generateVarBlock(borderRadius as Record<string, string> | undefined, 'radius', {
    varName: (key) => (key === 'DEFAULT' ? 'radius' : `radius-${key}`),
  })
}

export function generateThemeBreakpoints(breakpoints?: BreakpointsConfig): string {
  return generateVarBlock(breakpoints as Record<string, string> | undefined, 'breakpoint')
}
