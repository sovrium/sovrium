/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { applyResponsiveOverrides, buildResponsiveClasses } from './responsive-resolver'
import type { Responsive, VariantOverrides } from '@/domain/models/app/pages/components/responsive'
import type { Breakpoint } from '@/presentation/hooks/use-breakpoint'

export interface MergedResponsiveProps {
  readonly mergedProps: Record<string, unknown> | undefined
  readonly mergedChildren: ReadonlyArray<unknown> | undefined
  readonly mergedContent: string | Record<string, unknown> | undefined
  readonly visibilityClasses: string | undefined
}

export interface MergeResponsivePropsConfig {
  readonly responsive: Responsive | undefined
  readonly componentProps: Record<string, unknown> | undefined
  readonly children: ReadonlyArray<unknown> | undefined
  readonly content: string | Record<string, unknown> | undefined
  readonly currentBreakpoint: Breakpoint
}

function removeClassNameFromProps(
  props: Record<string, unknown> | undefined
): Record<string, unknown> | undefined {
  if (!props) return undefined

  return Object.entries(props)
    .filter(([key]) => key !== 'className')
    .reduce<Record<string, unknown>>((acc, [key, value]) => ({ ...acc, [key]: value }), {})
}

function hasContentOverrides(responsive: Responsive | undefined): boolean {
  return responsive
    ? Object.values(responsive).some(
        (override) => (override as VariantOverrides).content !== undefined
      )
    : false
}

function hasChildrenOverrides(responsive: Responsive | undefined): boolean {
  return responsive
    ? Object.values(responsive).some(
        (override) => (override as VariantOverrides).children !== undefined
      )
    : false
}

function buildVisibilityClasses(responsive: Responsive | undefined): string | undefined {
  if (!responsive) return undefined

  const visibilityConfig = (Object.entries(responsive) as [string, VariantOverrides][])
    .filter(([, overrides]) => overrides.visible !== undefined)
    .reduce<Record<string, boolean>>((acc, [bp, overrides]) => {
      return { ...acc, [bp]: overrides.visible! }
    }, {})

  if (visibilityConfig.mobile === false && visibilityConfig.lg === true) {
    return 'max-lg:hidden'
  }

  if (visibilityConfig.mobile === true && visibilityConfig.lg === false) {
    return 'lg:hidden'
  }

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

export function mergeResponsiveProps(config: MergeResponsivePropsConfig): MergedResponsiveProps

export function mergeResponsiveProps(
  responsive: Responsive | undefined,
  componentProps: Record<string, unknown> | undefined,
  children: ReadonlyArray<unknown> | undefined,
  content: string | Record<string, unknown> | undefined,
  currentBreakpoint: Breakpoint
): MergedResponsiveProps

export function mergeResponsiveProps(
  configOrResponsive: MergeResponsivePropsConfig | Responsive | undefined,
  componentProps?: Record<string, unknown>,
  children?: ReadonlyArray<unknown>,
  content?: string | Record<string, unknown>,
  currentBreakpoint?: Breakpoint
): MergedResponsiveProps {
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

  const responsiveOverrides = applyResponsiveOverrides(responsive, breakpoint)

  const baseClassName = props?.className as string | undefined
  const responsiveClassName = buildResponsiveClasses(responsive, baseClassName)

  const mergedPropsWithoutClassName = removeClassNameFromProps(
    responsiveOverrides?.props ? { ...props, ...responsiveOverrides.props } : props
  )

  const mergedProps: Record<string, unknown> | undefined = responsiveClassName
    ? { ...mergedPropsWithoutClassName, className: responsiveClassName }
    : mergedPropsWithoutClassName

  const mergedChildren = responsiveOverrides?.children ?? childrenProp
  const mergedContent = responsiveOverrides?.content ?? contentProp

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
