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
 * Configuration for merging responsive props
 */
export interface MergeResponsivePropsConfig {
  readonly responsive: Responsive | undefined
  readonly componentProps: Record<string, unknown> | undefined
  readonly children: ReadonlyArray<unknown> | undefined
  readonly content: string | Record<string, unknown> | undefined
  readonly currentBreakpoint: Breakpoint
}

/**
 * Remove className from props object
 */
function removeClassNameFromProps(
  props: Record<string, unknown> | undefined
): Record<string, unknown> | undefined {
  if (!props) return undefined

  return Object.entries(props)
    .filter(([key]) => key !== 'className')
    .reduce<Record<string, unknown>>((acc, [key, value]) => ({ ...acc, [key]: value }), {})
}

/**
 * Check if responsive config has content overrides
 */
function hasContentOverrides(responsive: Responsive | undefined): boolean {
  return responsive
    ? Object.values(responsive).some(
        (override) => (override as VariantOverrides).content !== undefined
      )
    : false
}

/**
 * Check if responsive config has children overrides
 */
function hasChildrenOverrides(responsive: Responsive | undefined): boolean {
  return responsive
    ? Object.values(responsive).some(
        (override) => (override as VariantOverrides).children !== undefined
      )
    : false
}

/**
 * Build visibility classes from responsive configuration
 */
function buildVisibilityClasses(responsive: Responsive | undefined): string | undefined {
  if (!responsive) return undefined

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
}

/**
 * Merges responsive overrides with component props (config object signature)
 */
export function mergeResponsiveProps(config: MergeResponsivePropsConfig): MergedResponsiveProps

/**
 * Merges responsive overrides with component props (individual parameters signature)
 */
// eslint-disable-next-line max-params -- Function overload signature
export function mergeResponsiveProps(
  responsive: Responsive | undefined,
  componentProps: Record<string, unknown> | undefined,
  children: ReadonlyArray<unknown> | undefined,
  content: string | Record<string, unknown> | undefined,
  currentBreakpoint: Breakpoint
): MergedResponsiveProps

/**
 * Implementation
 */
// eslint-disable-next-line max-params, max-lines-per-function, complexity -- Implementation handles both signatures
export function mergeResponsiveProps(
  configOrResponsive: MergeResponsivePropsConfig | Responsive | undefined,
  componentProps?: Record<string, unknown>,
  children?: ReadonlyArray<unknown>,
  content?: string | Record<string, unknown>,
  currentBreakpoint?: Breakpoint
): MergedResponsiveProps {
  // Support both config object and individual parameters
  const config: MergeResponsivePropsConfig =
    configOrResponsive &&
    typeof configOrResponsive === 'object' &&
    'responsive' in configOrResponsive
      ? configOrResponsive
      : {
          responsive: configOrResponsive as Responsive | undefined,
          componentProps: componentProps!,
          children: children!,
          content: content!,
          currentBreakpoint: currentBreakpoint!,
        }

  const {
    responsive,
    componentProps: props,
    children: childrenProp,
    content: contentProp,
    currentBreakpoint: breakpoint,
  } = config

  // Apply responsive overrides for current breakpoint (used for SSR initial render)
  const responsiveOverrides = applyResponsiveOverrides(responsive, breakpoint)

  // Build CSS-based responsive classes (works without JavaScript via Tailwind media queries)
  const baseClassName = props?.className as string | undefined
  const responsiveClassName = buildResponsiveClasses(responsive, baseClassName)

  // Merge responsive overrides with base component values
  // For className, use CSS-based responsive classes instead of JS-based overrides
  const mergedPropsWithoutClassName = removeClassNameFromProps(
    responsiveOverrides?.props ? { ...props, ...responsiveOverrides.props } : props
  )

  const mergedProps: Record<string, unknown> | undefined = responsiveClassName
    ? { ...mergedPropsWithoutClassName, className: responsiveClassName }
    : mergedPropsWithoutClassName

  const mergedChildren = responsiveOverrides?.children ?? childrenProp
  const mergedContent = responsiveOverrides?.content ?? contentProp

  // Build CSS classes for responsive visibility using Tailwind breakpoint utilities
  // This works without JavaScript by using CSS media queries
  // Skip visibility classes when content/children overrides exist (handled by variant builders)
  const shouldBuildVisibility =
    responsive && !hasContentOverrides(responsive) && !hasChildrenOverrides(responsive)

  const visibilityClasses = shouldBuildVisibility ? buildVisibilityClasses(responsive) : undefined

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
