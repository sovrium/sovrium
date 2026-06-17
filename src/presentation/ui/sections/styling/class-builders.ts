/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


const GAP_SCALE: Record<string, string> = {
  none: 'gap-0',
  '0': 'gap-0',
  xs: 'gap-1',
  sm: 'gap-2',
  small: 'gap-2',
  md: 'gap-4',
  medium: 'gap-4',
  lg: 'gap-6',
  large: 'gap-6',
  xl: 'gap-8',
}

const COLUMNS_SCALE: Record<string, number> = {
  sm: 1,
  md: 2,
  lg: 3,
  xl: 4,
}

const ALIGN_MAP: Record<string, string> = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
  stretch: 'items-stretch',
  baseline: 'items-baseline',
}

const JUSTIFY_MAP: Record<string, string> = {
  start: 'justify-start',
  center: 'justify-center',
  end: 'justify-end',
  between: 'justify-between',
  around: 'justify-around',
  evenly: 'justify-evenly',
}

const DIRECTION_MAP: Record<string, string> = {
  row: 'flex-row',
  'row-reverse': 'flex-row-reverse',
  column: 'flex-col',
  col: 'flex-col',
  'column-reverse': 'flex-col-reverse',
  'col-reverse': 'flex-col-reverse',
}

function gapClass(gap: unknown): string | undefined {
  if (typeof gap === 'number') return `gap-${gap}`
  if (typeof gap === 'string') return GAP_SCALE[gap.toLowerCase()]
  return undefined
}

function columnsValue(columns: unknown): number | undefined {
  if (typeof columns === 'number') return columns
  if (typeof columns === 'string') return COLUMNS_SCALE[columns.toLowerCase()]
  return undefined
}

function lookup(map: Record<string, string>, value: unknown): string | undefined {
  return typeof value === 'string' ? map[value.toLowerCase()] : undefined
}

function wrapClass(wrap: unknown): string | undefined {
  if (wrap === true || wrap === 'wrap') return 'flex-wrap'
  if (wrap === 'nowrap') return 'flex-nowrap'
  if (wrap === 'wrap-reverse') return 'flex-wrap-reverse'
  return undefined
}

export function buildFlexClasses(props?: Record<string, unknown>): string {
  return [
    'flex',
    lookup(DIRECTION_MAP, props?.direction),
    lookup(ALIGN_MAP, props?.align),
    lookup(JUSTIFY_MAP, props?.justify),
    gapClass(props?.gap),
    wrapClass(props?.wrap),
  ]
    .filter(Boolean)
    .join(' ')
}

function responsiveColumnsClass(
  breakpoint: 'sm' | 'md' | 'lg',
  value: unknown
): string | undefined {
  const columns = columnsValue(value)
  return columns ? `${breakpoint}:grid-cols-${columns}` : undefined
}

export function buildGridClasses(props?: Record<string, unknown>): string | undefined {
  const baseColumns = columnsValue(props?.columns) ?? 1
  const responsive = props?.responsive as Record<string, unknown> | undefined

  return [
    'grid',
    `grid-cols-${baseColumns}`,
    responsiveColumnsClass('sm', responsive?.sm),
    responsiveColumnsClass('md', responsive?.md),
    responsiveColumnsClass('lg', responsive?.lg),
    gapClass(props?.gap),
  ]
    .filter(Boolean)
    .join(' ')
}
