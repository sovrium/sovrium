/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A drawer's side and size: the classes each side and size paint, and the
 * inline width or height a custom size needs.
 */

export const SIDE_CLASSES = {
  left: 'inset-y-0 left-0 data-[starting-style]:-translate-x-full data-[ending-style]:-translate-x-full',
  right:
    'inset-y-0 right-0 data-[starting-style]:translate-x-full data-[ending-style]:translate-x-full',
  top: 'inset-x-0 top-0 data-[starting-style]:-translate-y-full data-[ending-style]:-translate-y-full',
  bottom:
    'inset-x-0 bottom-0 data-[starting-style]:translate-y-full data-[ending-style]:translate-y-full',
} as const

/**
 * Standard Tailwind size classes for each drawer size. `lg` augments the class
 * with an inline-style fallback because Sovrium's runtime CSS compiler does not
 * emit arbitrary-value classes (e.g. `w-[32rem]`) — see `SIZE_INLINE_STYLES`.
 */
const SIZE_CLASSES = {
  sm: { horizontal: 'w-64', vertical: 'h-48' }, // 256px / 192px
  md: { horizontal: 'w-80', vertical: 'h-64' }, // 320px / 256px
  lg: { horizontal: 'w-96', vertical: 'h-80' }, // 384px / 320px (overridden via inline style to 512px)
  full: { horizontal: 'w-full', vertical: 'h-full' },
} as const

/**
 * Inline-style width/height overrides for sizes whose target value would
 * otherwise require an arbitrary-value Tailwind class that the runtime CSS
 * compiler does not always emit.
 */
const SIZE_INLINE_STYLES: Record<keyof typeof SIZE_CLASSES, { width?: string; height?: string }> = {
  sm: {},
  md: {},
  lg: { width: '32rem', height: '24rem' }, // 512px / 384px
  full: {},
} as const

export function getSizeClass(
  drawerSide: 'left' | 'right' | 'top' | 'bottom',
  drawerSize: keyof typeof SIZE_CLASSES
): string {
  const isHorizontal = drawerSide === 'left' || drawerSide === 'right'
  return isHorizontal ? SIZE_CLASSES[drawerSize].horizontal : SIZE_CLASSES[drawerSize].vertical
}

/**
 * Returns inline-style width/height for sizes whose target Tailwind class
 * would otherwise need an arbitrary value the runtime CSS compiler skips.
 * Only the relevant axis (horizontal vs vertical) is set so the perpendicular
 * dimension still inherits from the side class (`inset-y-0`, `inset-x-0`).
 */
export function getSizeInlineStyle(
  drawerSide: 'left' | 'right' | 'top' | 'bottom',
  drawerSize: keyof typeof SIZE_CLASSES
): React.CSSProperties {
  const override = SIZE_INLINE_STYLES[drawerSize]
  const isHorizontal = drawerSide === 'left' || drawerSide === 'right'
  if (isHorizontal && override.width) return { width: override.width }
  if (!isHorizontal && override.height) return { height: override.height }
  return {}
}
