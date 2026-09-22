/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Flex/grid class builders translate a component's layout `props` into Tailwind
 * utility classes. Authors may express layout either numerically (`gap: 4`) or
 * with a named size scale (`gap: 'md'`); both resolve here. Any non-numeric
 * utility emitted below MUST also live in `LAYOUT_UTILITY_SAFELIST`
 * (`src/infrastructure/css/compiler.ts`) — these classes are composed at runtime
 * and are invisible to Tailwind's build-time source scan.
 */

/** Named gap scale → Tailwind `gap-*`. Mirrors the spacing rhythm in the design system. */
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

/** Named column scale → grid column count. */
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

/** `gap` accepts a number (`gap-${n}`) or a named scale key; anything else is dropped. */
function gapClass(gap: unknown): string | undefined {
  if (typeof gap === 'number') return `gap-${gap}`
  if (typeof gap === 'string') return GAP_SCALE[gap.toLowerCase()]
  return undefined
}

/** `columns` accepts a number or a named scale key; returns the resolved column count. */
function columnsValue(columns: unknown): number | undefined {
  if (typeof columns === 'number') return columns
  if (typeof columns === 'string') return COLUMNS_SCALE[columns.toLowerCase()]
  return undefined
}

function lookup(map: Record<string, string>, value: unknown): string | undefined {
  return typeof value === 'string' ? map[value.toLowerCase()] : undefined
}

/** `wrap`: `true`/`'wrap'` → flex-wrap, `'nowrap'`/`'wrap-reverse'` → matching utility. */
function wrapClass(wrap: unknown): string | undefined {
  if (wrap === true || wrap === 'wrap') return 'flex-wrap'
  if (wrap === 'nowrap') return 'flex-nowrap'
  if (wrap === 'wrap-reverse') return 'flex-wrap-reverse'
  return undefined
}

/**
 * Build flex-specific classes from props: `direction`, `align`, `justify`, `gap`
 * (number or named scale), and `wrap`.
 */
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

/** Resolve a responsive `grid-cols-*` utility for a breakpoint, or `undefined` if unset. */
function responsiveColumnsClass(
  breakpoint: 'sm' | 'md' | 'lg',
  value: unknown
): string | undefined {
  const columns = columnsValue(value)
  return columns ? `${breakpoint}:grid-cols-${columns}` : undefined
}

/**
 * Build grid-specific classes from props: `columns` (number or named scale) with
 * `responsive.{sm,md,lg}` breakpoints, plus `gap` (number or named scale).
 */
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
