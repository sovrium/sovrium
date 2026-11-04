/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The width each breakpoint starts at: Tailwind's, in rem, so this agrees with
 * the `max-md:hidden` / `md:hidden` classes the server banded the panels by.
 */
const BREAKPOINT_MIN_WIDTH = {
  sm: '40rem',
  md: '48rem',
  lg: '64rem',
  xl: '80rem',
  '2xl': '96rem',
} as const

/**
 * The tab open on arrival at the window's width, mobile first: the widest
 * matched breakpoint naming one, else `mobile`'s, else `undefined` (the base
 * `defaultTab` then applies). Read once, at mount: it is the tab the server's
 * CSS already shows at this width, so nothing changes on screen.
 */
export function arrivalTabAtWidth(
  overrides: Readonly<Record<string, string>> | undefined
): string | undefined {
  if (overrides === undefined || typeof window === 'undefined') return undefined
  return Object.entries(BREAKPOINT_MIN_WIDTH).reduce<string | undefined>(
    (tab, [breakpoint, width]) =>
      window.matchMedia(`(min-width: ${width})`).matches ? (overrides[breakpoint] ?? tab) : tab,
    overrides['mobile']
  )
}
