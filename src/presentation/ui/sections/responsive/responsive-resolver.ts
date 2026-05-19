/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { Responsive, VariantOverrides } from '@/domain/models/app/pages/components/responsive'
import type { Breakpoint } from '@/presentation/hooks/use-breakpoint'

export const BREAKPOINT_ORDER: readonly Breakpoint[] = [
  'mobile',
  'sm',
  'md',
  'lg',
  'xl',
  '2xl',
] as const

const BREAKPOINT_PREFIX: Record<Breakpoint, string> = {
  mobile: '',
  sm: 'sm:',
  md: 'md:',
  lg: 'lg:',
  xl: 'xl:',
  '2xl': '2xl:',
} as const

function getActiveBreakpoints(currentBreakpoint: Breakpoint): readonly Breakpoint[] {
  const currentIndex = BREAKPOINT_ORDER.indexOf(currentBreakpoint)
  return BREAKPOINT_ORDER.slice(0, currentIndex + 1)
}

function mergeClassNames(
  base: string | undefined,
  override: string | undefined
): string | undefined {
  return override ?? base
}

type PropsValue = string | number | boolean | readonly unknown[] | { readonly [x: string]: unknown }

type PropsRecord = { readonly [x: string]: PropsValue }

function mergeProps(
  base: PropsRecord | undefined,
  override: PropsRecord | undefined
): PropsRecord | undefined {
  if (!base && !override) return undefined
  if (!base) return override
  if (!override) return base

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

export function applyResponsiveOverrides(
  responsive: Responsive | undefined,
  currentBreakpoint: Breakpoint
): VariantOverrides | undefined {
  if (!responsive) return undefined

  const activeBreakpoints = getActiveBreakpoints(currentBreakpoint)

  const result = activeBreakpoints.reduce<VariantOverrides>((acc, bp) => {
    const overrides = responsive[bp]
    if (!overrides) return acc

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

export function buildResponsiveClasses(
  responsive: Responsive | undefined,
  baseClassName: string | undefined
): string | undefined {
  if (!responsive) return baseClassName

  const classNamesByBreakpoint = BREAKPOINT_ORDER.reduce<Record<string, string>>((acc, bp) => {
    const overrides = responsive[bp]
    const className = overrides?.props?.className as string | undefined
    return className ? { ...acc, [bp]: className } : acc
  }, {})

  if (Object.keys(classNamesByBreakpoint).length === 0) return baseClassName

  const mobileClassName = classNamesByBreakpoint.mobile
  const effectiveBase = mobileClassName ?? baseClassName

  const responsiveClasses = BREAKPOINT_ORDER.filter((bp) => bp !== 'mobile')
    .map((bp) => {
      const className = classNamesByBreakpoint[bp]
      if (!className) return undefined

      const prefix = BREAKPOINT_PREFIX[bp]
      return className
        .split(' ')
        .filter(Boolean)
        .map((cls) => `${prefix}${cls}`)
        .join(' ')
    })
    .filter(Boolean)
    .join(' ')

  return [effectiveBase, responsiveClasses].filter(Boolean).join(' ').trim() || undefined
}
