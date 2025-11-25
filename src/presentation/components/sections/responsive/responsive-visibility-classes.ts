/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Breakpoint visibility class mappings for responsive rendering
 *
 * Mobile-first approach: Each breakpoint defines CSS classes for "show from this breakpoint onwards":
 * - mobile: visible at all sizes (no prefix needed)
 * - sm: hidden <640px, visible ≥640px (hidden sm:block)
 * - md: hidden <768px, visible ≥768px (hidden md:block)
 * - lg: hidden <1024px, visible ≥1024px (hidden lg:block)
 * - xl: hidden <1280px, visible ≥1280px (hidden xl:block)
 * - 2xl: hidden <1536px, visible ≥1536px (hidden 2xl:block)
 *
 * For content that should ONLY show at specific breakpoint (exclusive range),
 * use upper bound hiding:
 * - Mobile only: block sm:hidden (visible <640px, hidden ≥640px)
 * - SM only: hidden sm:block md:hidden (hidden <640px, visible 640-767px, hidden ≥768px)
 * - MD only: hidden md:block lg:hidden (hidden <768px, visible 768-1023px, hidden ≥1024px)
 * - LG only: hidden lg:block xl:hidden (hidden <1024px, visible 1024-1279px, hidden ≥1280px)
 * - XL only: hidden xl:block 2xl:hidden (hidden <1280px, visible 1280-1535px, hidden ≥1536px)
 * - 2XL only: hidden 2xl:block (hidden <1536px, visible ≥1536px)
 *
 * Strategy for responsive children/content variants:
 * - Determine which breakpoints have overrides
 * - For each breakpoint, decide if it should be visible:
 *   - From this breakpoint until next override (inclusive range)
 *   - Only at this specific breakpoint (exclusive range)
 *
 * This constant provides building blocks - actual visibility logic is in the builders.
 *
 * Used by:
 * - responsive-content-builder.tsx (for responsive content variants)
 * - responsive-children-builder.tsx (for responsive children variants)
 */
export const BREAKPOINT_VISIBILITY: Record<string, { show: string; hide: string }> = {
  // Mobile-first: show from breakpoint onwards (inclusive)
  mobile: { show: 'block', hide: 'hidden' },
  sm: { show: 'hidden sm:block', hide: 'hidden sm:hidden' },
  md: { show: 'hidden md:block', hide: 'hidden md:hidden' },
  lg: { show: 'hidden lg:block', hide: 'hidden lg:hidden' },
  xl: { show: 'hidden xl:block', hide: 'hidden xl:hidden' },
  '2xl': { show: 'hidden 2xl:block', hide: 'hidden 2xl:hidden' },
} as const
