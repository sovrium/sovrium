/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { Responsive, VariantOverrides } from '@/domain/models/app/page/common/responsive'
import type { Breakpoint } from '@/presentation/hooks/use-breakpoint'

/**
 * Breakpoint order for progressive enhancement (mobile-first)
 */
const BREAKPOINT_ORDER: readonly Breakpoint[] = ['mobile', 'sm', 'md', 'lg', 'xl', '2xl'] as const

/**
 * Map breakpoints to Tailwind responsive prefixes
 */
const BREAKPOINT_PREFIX: Record<Breakpoint, string> = {
  mobile: '', // Mobile is base (no prefix)
  sm: 'sm:',
  md: 'md:',
  lg: 'lg:',
  xl: 'xl:',
  '2xl': '2xl:',
} as const

/**
 * Gets active breakpoints up to and including current breakpoint
 *
 * @param currentBreakpoint - Current viewport breakpoint
 * @returns Array of active breakpoints in order
 */
function getActiveBreakpoints(currentBreakpoint: Breakpoint): readonly Breakpoint[] {
  const currentIndex = BREAKPOINT_ORDER.indexOf(currentBreakpoint)
  return BREAKPOINT_ORDER.slice(0, currentIndex + 1)
}

/**
 * Merges className strings
 *
 * Override replaces base (no concatenation)
 *
 * @param base - Base className
 * @param override - Override className
 * @returns Override className if present, else base
 */
function mergeClassNames(base: string | undefined, override: string | undefined): string | undefined {
  return override ?? base
}

/**
 * Props value type from VariantOverrides
 */
type PropsValue =
  | string
  | number
  | boolean
  | readonly unknown[]
  | { readonly [x: string]: unknown }

/**
 * Props record type from VariantOverrides
 */
type PropsRecord = { readonly [x: string]: PropsValue }

/**
 * Merges props objects, handling className specially
 *
 * @param base - Base props
 * @param override - Override props
 * @returns Merged props
 */
function mergeProps(
  base: PropsRecord | undefined,
  override: PropsRecord | undefined
): PropsRecord | undefined {
  if (!base && !override) return undefined
  if (!base) return override
  if (!override) return base

  // Use reduce for functional approach
  const overrideEntries = Object.entries(override).reduce<Record<string, PropsValue>>(
    (acc, [key, value]) => {
      if (key === 'className') {
        const mergedClassName = mergeClassNames(
          base.className as string | undefined,
          value as string
        )
        return mergedClassName !== undefined ? { ...acc, className: mergedClassName } : acc
      }
      return { ...acc, [key]: value }
    },
    {}
  )

  return { ...base, ...overrideEntries }
}

/**
 * Applies responsive overrides for current breakpoint
 *
 * Uses mobile-first approach: applies base values, then progressively
 * overrides with larger breakpoint values up to current breakpoint.
 *
 * @param responsive - Responsive configuration
 * @param currentBreakpoint - Current viewport breakpoint
 * @returns Merged overrides for current breakpoint
 */
export function applyResponsiveOverrides(
  responsive: Responsive | undefined,
  currentBreakpoint: Breakpoint
): VariantOverrides | undefined {
  if (!responsive) return undefined

  const activeBreakpoints = getActiveBreakpoints(currentBreakpoint)

  // Use reduce for functional approach
  const result = activeBreakpoints.reduce<VariantOverrides>((acc, bp) => {
    const overrides = responsive[bp]
    if (!overrides) return acc

    // Build updated object functionally without let/mutations
    const withProps = overrides.props
      ? { ...acc, props: mergeProps(acc.props, overrides.props) }
      : acc

    const withContent =
      overrides.content !== undefined ? { ...withProps, content: overrides.content } : withProps

    const withVisible =
      overrides.visible !== undefined ? { ...withContent, visible: overrides.visible } : withContent

    const withChildren =
      overrides.children !== undefined
        ? { ...withVisible, children: overrides.children }
        : withVisible

    return withChildren
  }, {})

  return Object.keys(result).length > 0 ? result : undefined
}

/**
 * Builds responsive CSS classes from responsive configuration
 *
 * Converts responsive className overrides into Tailwind responsive prefixes.
 * Uses mobile-first approach: base className from props, then breakpoint-prefixed overrides.
 *
 * @example
 * ```typescript
 * buildResponsiveClasses(
 *   {
 *     mobile: { props: { className: 'text-sm' } },
 *     md: { props: { className: 'p-8 max-w-4xl' } }
 *   },
 *   'p-4'  // Base className from props
 * )
 * // Returns: 'text-sm md:p-8 md:max-w-4xl'
 * // Note: mobile override replaces base, md classes prefixed
 * ```
 *
 * @param responsive - Responsive configuration
 * @param baseClassName - Base className from component props
 * @returns Combined CSS classes with responsive prefixes
 */
export function buildResponsiveClasses(
  responsive: Responsive | undefined,
  baseClassName: string | undefined
): string | undefined {
  if (!responsive) return baseClassName

  // Extract className from each breakpoint's props
  const classNamesByBreakpoint = BREAKPOINT_ORDER.reduce<Record<string, string>>((acc, bp) => {
    const overrides = responsive[bp]
    const className = overrides?.props?.className as string | undefined
    return className ? { ...acc, [bp]: className } : acc
  }, {})

  // If no responsive classNames, return base
  if (Object.keys(classNamesByBreakpoint).length === 0) return baseClassName

  // Determine base classes (mobile override takes precedence over props.className)
  const mobileClassName = classNamesByBreakpoint.mobile
  const effectiveBase = mobileClassName ?? baseClassName

  // Build responsive classes for breakpoints larger than mobile
  const responsiveClasses = BREAKPOINT_ORDER.filter((bp) => bp !== 'mobile')
    .map((bp) => {
      const className = classNamesByBreakpoint[bp]
      if (!className) return undefined

      const prefix = BREAKPOINT_PREFIX[bp]
      // Prefix each class with breakpoint
      return className
        .split(' ')
        .filter(Boolean)
        .map((cls) => `${prefix}${cls}`)
        .join(' ')
    })
    .filter(Boolean)
    .join(' ')

  // Combine base with responsive classes
  return [effectiveBase, responsiveClasses].filter(Boolean).join(' ').trim() || undefined
}
