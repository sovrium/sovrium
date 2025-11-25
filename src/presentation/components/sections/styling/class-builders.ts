/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { Theme } from '@/domain/models/app/theme'

/**
 * Build flex-specific classes based on props
 */
export function buildFlexClasses(props?: Record<string, unknown>): string {
  const baseClasses = ['flex']
  const alignmentClass =
    props?.align === 'start'
      ? 'items-start'
      : props?.align === 'center'
        ? 'items-center'
        : props?.align === 'end'
          ? 'items-end'
          : undefined
  const gapClass = typeof props?.gap === 'number' ? `gap-${props.gap}` : undefined

  return [...baseClasses, alignmentClass, gapClass].filter(Boolean).join(' ')
}

/**
 * Build grid-specific classes based on columns prop with responsive breakpoints
 */
export function buildGridClasses(props?: Record<string, unknown>): string | undefined {
  const baseClasses = ['grid']

  // Get base column count (default to 1 for mobile-first)
  const baseColumns = typeof props?.columns === 'number' ? props.columns : 1
  const baseClass = `grid-cols-${baseColumns}`

  // Build responsive classes from responsive property
  const responsive = props?.responsive as Record<string, unknown> | undefined
  const mdColumns = typeof responsive?.md === 'number' ? responsive.md : undefined
  const lgColumns = typeof responsive?.lg === 'number' ? responsive.lg : undefined

  const mdClass = mdColumns ? `md:grid-cols-${mdColumns}` : undefined
  const lgClass = lgColumns ? `lg:grid-cols-${lgColumns}` : undefined

  return [...baseClasses, baseClass, mdClass, lgClass].filter(Boolean).join(' ')
}
