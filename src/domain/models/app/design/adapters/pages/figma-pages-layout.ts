/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The vocabulary the Figma page document shares with the design tree: how a
 * container layout becomes Figma auto-layout, and how auto-layout reads back.
 *
 * Both halves of the Figma page adapter (`figma-pages-export.ts`,
 * `figma-pages-parse.ts`) read the SAME tables, so a value the export writes is
 * a value the parse reads back as it was. A length is drawn in px at a 16px
 * root; a token is bound by the name the Figma token files give it, the dotted
 * path with `/` for each `.` (`spacing.4` is `spacing/4`).
 */

import { REM_BASE_PX, roundTo } from '../adapter-units'
import type { PageDesignTreeNode } from '@/domain/models/api/admin/design-system/page-design-tree'

/** A design tree node's layout. */
export type PageLayout = NonNullable<PageDesignTreeNode['layout']>

/** One layout value and the token it is on the scale of. */
export type PageLayoutValue = NonNullable<PageLayout['gap']>

/** The board every page is drawn on first, below the smallest breakpoint, in px. */
export const FIGMA_BASE_BOARD_WIDTH = 375

/** The px a CSS length draws at, or `undefined` for a relative length (`100%`, `auto`). */
export const cssLengthInPx = (value: string): number | undefined => {
  const match = /^(\d+(?:\.\d+)?|\.\d+)(px|rem)?$/.exec(value.trim())
  if (match === null) return undefined
  const amount = Number(match[1])
  if (match[2] === undefined) return amount === 0 ? 0 : undefined
  return match[2] === 'rem' ? roundTo(amount * REM_BASE_PX) : amount
}

/** The Figma variable name of a token path: `spacing.4` is `spacing/4`. */
export const figmaVariableName = (token: string): string => token.replaceAll('.', '/')

/** The token path a Figma variable name stands for: `spacing/4` is `spacing.4`. */
export const tokenOfFigmaVariable = (name: string): string => name.replaceAll('/', '.')

/** A tree direction, as the auto-layout axis it runs along. */
export const LAYOUT_MODE_OF_DIRECTION: Readonly<Record<string, 'HORIZONTAL' | 'VERTICAL'>> = {
  row: 'HORIZONTAL',
  'row-reverse': 'HORIZONTAL',
  column: 'VERTICAL',
  'column-reverse': 'VERTICAL',
}

/** An auto-layout axis, as the tree direction it reads back as. */
export const DIRECTION_OF_LAYOUT_MODE: Readonly<Record<string, string>> = {
  HORIZONTAL: 'row',
  VERTICAL: 'column',
}

/** A tree `align`, as Figma's counter-axis alignment. */
export const COUNTER_AXIS_OF_ALIGN: Readonly<
  Record<string, 'MIN' | 'CENTER' | 'MAX' | 'BASELINE'>
> = { start: 'MIN', center: 'CENTER', end: 'MAX', baseline: 'BASELINE' }

/** A tree `justify`, as Figma's primary-axis distribution. */
export const PRIMARY_AXIS_OF_JUSTIFY: Readonly<
  Record<string, 'MIN' | 'CENTER' | 'MAX' | 'SPACE_BETWEEN'>
> = { start: 'MIN', center: 'CENTER', end: 'MAX', 'space-between': 'SPACE_BETWEEN' }

/** A table read the other way round. */
export const inverted = (
  table: Readonly<Record<string, string>>
): Readonly<Record<string, string>> =>
  Object.fromEntries(Object.entries(table).map(([key, value]) => [value, key]))

/** The four padding fields, in CSS shorthand order. */
export const PADDING_FIELDS = [
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
] as const

/**
 * A node's layout as it applies at a breakpoint: its base layout, then each
 * breakpoint up to and including `breakpoint`, smallest first, as the cascade
 * applies them. `breakpoint` is `base` or one of `order`, which lists the
 * breakpoints smallest first. `undefined` when nothing is set.
 */
export const effectiveLayoutAt = (
  node: Pick<PageDesignTreeNode, 'layout' | 'responsive'>,
  breakpoint: string,
  order: readonly string[]
): PageLayout | undefined => {
  const upTo = breakpoint === 'base' ? [] : order.slice(0, order.indexOf(breakpoint) + 1)
  const merged = upTo.reduce<PageLayout>(
    (acc, step) => ({ ...acc, ...node.responsive?.[step] }),
    node.layout ?? {}
  )
  return Object.keys(merged).length === 0 ? undefined : merged
}
