/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { applyResponsiveOverrides, buildResponsiveClasses } from './responsive-resolver'
import type { Responsive, VariantOverrides } from '@/domain/models/app/page/common/responsive'
import type { Breakpoint } from '@/presentation/hooks/use-breakpoint'

/**
 * Result of merging responsive props
 */
export interface MergedResponsiveProps {
  readonly mergedProps: Record<string, unknown> | undefined
  readonly mergedChildren: ReadonlyArray<unknown> | undefined
  readonly mergedContent: string | Record<string, unknown> | undefined
  readonly visibilityClasses: string | undefined
}

/**
 * Merges responsive overrides with component props
 *
 * @param responsive - Responsive configuration
 * @param componentProps - Base component props
 * @param children - Component children
 * @param content - Component content
 * @param currentBreakpoint - Current breakpoint (used for SSR initial render)
 * @returns Merged props, children, content, and visibility classes
 */
// eslint-disable-next-line max-lines-per-function, max-params, complexity -- Extracted helper function maintains original logic
export function mergeResponsiveProps(
  responsive: Responsive | undefined,
  componentProps: Record<string, unknown> | undefined,
  children: ReadonlyArray<unknown> | undefined,
  content: string | Record<string, unknown> | undefined,
  currentBreakpoint: Breakpoint
): MergedResponsiveProps {
  // Apply responsive overrides for current breakpoint (used for SSR initial render)
  const responsiveOverrides = applyResponsiveOverrides(responsive, currentBreakpoint)

  // Build CSS-based responsive classes (works without JavaScript via Tailwind media queries)
  const baseClassName = componentProps?.className as string | undefined
  const responsiveClassName = buildResponsiveClasses(responsive, baseClassName)

  // Merge responsive overrides with base component values
  // For className, use CSS-based responsive classes instead of JS-based overrides
  const mergedPropsWithoutClassName: Record<string, unknown> | undefined =
    responsiveOverrides?.props
      ? Object.entries({ ...componentProps, ...responsiveOverrides.props })
          .filter(([key]) => key !== 'className')
          .reduce<Record<string, unknown>>((acc, [key, value]) => ({ ...acc, [key]: value }), {})
      : componentProps
        ? Object.entries(componentProps)
            .filter(([key]) => key !== 'className')
            .reduce<Record<string, unknown>>((acc, [key, value]) => ({ ...acc, [key]: value }), {})
        : undefined

  const mergedProps: Record<string, unknown> | undefined = responsiveClassName
    ? { ...mergedPropsWithoutClassName, className: responsiveClassName }
    : mergedPropsWithoutClassName

  const mergedChildren = responsiveOverrides?.children ?? children
  const mergedContent = responsiveOverrides?.content ?? content

  // Build CSS classes for responsive visibility using Tailwind breakpoint utilities
  // This works without JavaScript by using CSS media queries
  // Strategy: Convert responsive visibility config into appropriate Tailwind classes
  const visibilityClasses = responsive
    ? (() => {
        const visibilityConfig = (Object.entries(responsive) as [string, VariantOverrides][])
          .filter(([, overrides]) => overrides.visible !== undefined)
          .reduce<Record<string, boolean>>((acc, [bp, overrides]) => {
            return { ...acc, [bp]: overrides.visible! }
          }, {})

        // For mobile:false + lg:true pattern, use max-lg:hidden
        if (visibilityConfig.mobile === false && visibilityConfig.lg === true) {
          return 'max-lg:hidden'
        }

        // For mobile:true + lg:false pattern, use lg:hidden
        if (visibilityConfig.mobile === true && visibilityConfig.lg === false) {
          return 'lg:hidden'
        }

        // Default fallback: build individual responsive classes
        return Object.entries(visibilityConfig)
          .map(([bp, isVisible]) => {
            if (bp === 'mobile') {
              return isVisible ? '' : 'max-sm:hidden'
            }
            return isVisible ? `${bp}:inline` : `${bp}:hidden`
          })
          .filter(Boolean)
          .join(' ')
      })()
    : undefined

  const mergedPropsWithVisibility = visibilityClasses
    ? {
        ...mergedProps,
        className: mergedProps?.className
          ? `${mergedProps.className} ${visibilityClasses}`
          : visibilityClasses,
      }
    : mergedProps

  return {
    mergedProps: mergedPropsWithVisibility,
    mergedChildren,
    mergedContent,
    visibilityClasses,
  }
}
