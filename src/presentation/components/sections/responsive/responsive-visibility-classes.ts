/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Breakpoint visibility class mappings for responsive rendering
 *
 * Each breakpoint defines CSS classes that control when content is shown or hidden:
 * - mobile: visible <640px, hidden ≥640px
 * - sm: hidden <640px, visible 640-767px, hidden ≥768px
 * - md: hidden <768px, visible 768-1023px, hidden ≥1024px
 * - lg: hidden <1024px, visible 1024-1279px, hidden ≥1280px
 * - xl: hidden <1280px, visible 1280-1535px, hidden ≥1536px
 * - 2xl: hidden <1536px, visible ≥1536px
 *
 * This constant is shared across multiple responsive rendering modules to ensure
 * consistent visibility behavior throughout the application.
 *
 * Used by:
 * - responsive-content-builder.tsx (for responsive content variants)
 * - responsive-children-builder.tsx (for responsive children variants)
 */
export const BREAKPOINT_VISIBILITY: Record<string, { show: string; hide: string }> = {
  mobile: { show: 'block sm:hidden', hide: 'hidden' },
  sm: { show: 'hidden sm:block md:hidden', hide: 'hidden sm:hidden' },
  md: { show: 'hidden md:block lg:hidden', hide: 'hidden md:hidden' },
  lg: { show: 'hidden lg:block xl:hidden', hide: 'hidden lg:hidden' },
  xl: { show: 'hidden xl:block 2xl:hidden', hide: 'hidden xl:hidden' },
  '2xl': { show: 'hidden 2xl:block', hide: 'hidden 2xl:hidden' },
} as const
