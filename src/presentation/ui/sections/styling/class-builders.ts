/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
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

export function buildGridClasses(props?: Record<string, unknown>): string | undefined {
  const baseClasses = ['grid']

  const baseColumns = typeof props?.columns === 'number' ? props.columns : 1
  const baseClass = `grid-cols-${baseColumns}`

  const responsive = props?.responsive as Record<string, unknown> | undefined
  const mdColumns = typeof responsive?.md === 'number' ? responsive.md : undefined
  const lgColumns = typeof responsive?.lg === 'number' ? responsive.lg : undefined

  const mdClass = mdColumns ? `md:grid-cols-${mdColumns}` : undefined
  const lgClass = lgColumns ? `lg:grid-cols-${lgColumns}` : undefined

  return [...baseClasses, baseClass, mdClass, lgClass].filter(Boolean).join(' ')
}
