/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

export const DEFAULT_THEME_COLORS = {
  orange: '#F97316',
  blue: '#3B82F6',
  green: '#10B981',
  red: '#EF4444',
} as const

export type ThemeColorName = keyof typeof DEFAULT_THEME_COLORS

export function resolveThemeColor(color: string | undefined): string | undefined {
  if (!color) {
    return undefined
  }
  return DEFAULT_THEME_COLORS[color as ThemeColorName]
}
