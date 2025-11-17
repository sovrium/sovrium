/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Build inline color styles from backgroundColor and textColor props
 *
 * This utility consolidates common color styling logic used across layout components
 * (navigation, footer, banner, hero). It follows the DRY principle by providing a
 * single source of truth for color-based inline styles.
 *
 * @param backgroundColor - Background color (hex, rgb, or named color)
 * @param textColor - Text color (hex, rgb, or named color)
 * @returns CSS properties object or undefined if no colors provided
 *
 * @example
 * ```typescript
 * // Returns undefined when no colors
 * buildColorStyles(undefined, undefined) // undefined
 *
 * // Returns background only
 * buildColorStyles('#000000', undefined) // { backgroundColor: '#000000' }
 *
 * // Returns text color only
 * buildColorStyles(undefined, '#ffffff') // { color: '#ffffff' }
 *
 * // Returns both
 * buildColorStyles('#000000', '#ffffff')
 * // { backgroundColor: '#000000', color: '#ffffff' }
 * ```
 */
export function buildColorStyles(
  backgroundColor: string | undefined,
  textColor: string | undefined
): React.CSSProperties | undefined {
  const hasBackgroundColor = backgroundColor !== undefined
  const hasTextColor = textColor !== undefined

  if (!hasBackgroundColor && !hasTextColor) {
    return undefined
  }

  return {
    ...(hasBackgroundColor && { backgroundColor }),
    ...(hasTextColor && { color: textColor }),
  }
}
