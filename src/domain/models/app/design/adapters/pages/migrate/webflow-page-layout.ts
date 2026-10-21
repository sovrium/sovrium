/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { MIGRATED_GRID_MAX_COLUMNS, type MigratedLayoutProperty } from './migrated-page-mapping'
import { WEBFLOW_PAGE_MAPPINGS } from './webflow-page-mappings'

/**
 * A Webflow element's LAYOUT, read from the declarations its classes set in
 * the site stylesheet, written as the utility classes of a kit node — or
 * reported, never rounded.
 *
 * Only the CSS properties the Webflow layout table holds are read
 * (`WEBFLOW_PAGE_MAPPINGS.layout`); a colour, a font or a margin is the
 * site's look, which a migration does not carry.
 *
 * - A length is written as a step of the app's `design.spacing` only when a
 *   step holds exactly that length (`16px` is `1rem`); any other length is
 *   reported with the nearest step for the operator to choose, and no class
 *   is written for it. Zero writes nothing: it is no gap and no padding.
 * - A flex box's gap is the one along its axis (Webflow writes both
 *   `grid-row-gap` and `grid-column-gap`): a column's row gap, a row's column
 *   gap. A grid writes one gap when both are the same, else each axis.
 * - A grid's columns are written only for `repeat(n, 1fr)` or
 *   `repeat(n, minmax(0, 1fr))` with n up to 12; any other track list is
 *   reported as it is.
 */

/** `design.spacing`: a step name to its CSS length. */
export type SpacingScale = Readonly<Record<string, string>>

/** The kit node a layout is written on. */
export type LayoutTarget = 'flex' | 'grid' | 'container'

/** A value off the scale, as the report names it, before it is placed on a page. */
export interface LayoutFinding {
  readonly property: MigratedLayoutProperty
  readonly value: string
  readonly nearestToken?: string
}

/** The classes written, and what could not be. */
export interface LayoutRead {
  readonly classes: readonly string[]
  readonly offScale: readonly LayoutFinding[]
}

const NOTHING: LayoutRead = { classes: [], offScale: [] }

const join = (...reads: readonly LayoutRead[]): LayoutRead => ({
  classes: reads.flatMap((read) => read.classes),
  offScale: reads.flatMap((read) => read.offScale),
})

/** A length in px, for `px`, `rem` and a bare zero; `undefined` for anything else. */
export const pixelsOf = (length: string): number | undefined => {
  const trimmed = length.trim()
  if (/^[+-]?0+(?:\.0+)?$/.test(trimmed)) return 0
  const match = /^([+-]?\d*\.?\d+)(px|rem)$/i.exec(trimmed)
  if (match === null) return undefined
  const amount = Number(match[1])
  return match[2]?.toLowerCase() === 'rem' ? amount * 16 : amount
}

/** The steps of the scale whose length resolves, in the scale's own order. */
const stepsOf = (spacing: SpacingScale): readonly (readonly [string, number])[] =>
  Object.entries(spacing).flatMap(([step, value]) => {
    const pixels = pixelsOf(value)
    return pixels === undefined ? [] : [[step, pixels] as const]
  })

/** The nearest step to a length, ties going to the step first in the scale. */
const nearestStepOf = (pixels: number, spacing: SpacingScale): string | undefined =>
  stepsOf(spacing).reduce<readonly [string, number] | undefined>((best, [step, value]) => {
    const distance = Math.abs(value - pixels)
    return best === undefined || distance < best[1] ? [step, distance] : best
  }, undefined)?.[0]

/** One length as `<prefix>-<step>`, nothing for zero, or the finding when no step holds it. */
const spacedClass = (
  prefix: string,
  property: MigratedLayoutProperty,
  length: string,
  spacing: SpacingScale
): LayoutRead => {
  const pixels = pixelsOf(length)
  if (pixels === 0) return NOTHING
  const step =
    pixels === undefined
      ? undefined
      : stepsOf(spacing).find(([, value]) => Math.abs(value - pixels) < 1e-6)?.[0]
  if (step !== undefined) return { classes: [`${prefix}-${step}`], offScale: [] }
  const nearest = pixels === undefined ? undefined : nearestStepOf(pixels, spacing)
  return {
    classes: [],
    offScale: [
      {
        property,
        value: length.trim(),
        ...(nearest === undefined ? {} : { nearestToken: `spacing.${nearest}` }),
      },
    ],
  }
}

/** Whether the layout table reads a CSS property. */
const reads = (property: string): boolean => Object.hasOwn(WEBFLOW_PAGE_MAPPINGS.layout, property)

const valueOf = (declarations: ReadonlyMap<string, string>, ...names: readonly string[]) =>
  names
    .filter(reads)
    .map((name) => declarations.get(name))
    .find((value) => value !== undefined)

const DIRECTIONS: Readonly<Record<string, string>> = {
  row: 'flex-row',
  column: 'flex-col',
  'row-reverse': 'flex-row-reverse',
  'column-reverse': 'flex-col-reverse',
}

/** A flex box's direction: its `flex-direction`, else the direction half of `flex-flow`. */
const directionOf = (declarations: ReadonlyMap<string, string>, fallback: string): string => {
  const direct = valueOf(declarations, 'flex-direction')
  const flow = valueOf(declarations, 'flex-flow')
    ?.split(/\s+/)
    .find((part) => Object.hasOwn(DIRECTIONS, part))
  const direction = direct ?? flow ?? fallback
  return Object.hasOwn(DIRECTIONS, direction) ? direction : fallback
}

/** The two gaps a rule sets, `[row, column]`, from `gap` and its longhands in both spellings. */
const gapsOf = (
  declarations: ReadonlyMap<string, string>
): readonly [string | undefined, string | undefined] => {
  const [shortRow, shortColumn = shortRow] = (valueOf(declarations, 'gap') ?? '')
    .split(/\s+/)
    .filter((part) => part !== '')
  return [
    valueOf(declarations, 'row-gap', 'grid-row-gap') ?? shortRow,
    valueOf(declarations, 'column-gap', 'grid-column-gap') ?? shortColumn,
  ]
}

const gapRead = (
  target: LayoutTarget,
  direction: string,
  declarations: ReadonlyMap<string, string>,
  spacing: SpacingScale
): LayoutRead => {
  const [row, column] = gapsOf(declarations)
  if (target === 'flex') {
    const along = direction.startsWith('column') ? row : column
    return along === undefined ? NOTHING : spacedClass('gap', 'gap', along, spacing)
  }
  if (target !== 'grid') return NOTHING
  if (row !== undefined && row.trim() === column?.trim())
    return spacedClass('gap', 'gap', row, spacing)
  return join(
    column === undefined ? NOTHING : spacedClass('gap-x', 'gap', column, spacing),
    row === undefined ? NOTHING : spacedClass('gap-y', 'gap', row, spacing)
  )
}

const ALIGNMENTS: Readonly<Record<string, string>> = {
  'flex-start': 'start',
  start: 'start',
  center: 'center',
  'flex-end': 'end',
  end: 'end',
  stretch: 'stretch',
  baseline: 'baseline',
}

const JUSTIFICATIONS: Readonly<Record<string, string>> = {
  'flex-start': 'start',
  start: 'start',
  left: 'start',
  center: 'center',
  'flex-end': 'end',
  end: 'end',
  right: 'end',
  'space-between': 'between',
  'space-around': 'around',
  'space-evenly': 'evenly',
}

/** An enumerated value as its utility, `normal` writing nothing, anything else reported. */
const keywordRead = (
  prefix: string,
  property: MigratedLayoutProperty,
  table: Readonly<Record<string, string>>,
  value: string | undefined
): LayoutRead => {
  if (value === undefined || value === 'normal') return NOTHING
  const keyword = Object.hasOwn(table, value) ? table[value] : undefined
  return keyword === undefined
    ? { classes: [], offScale: [{ property, value }] }
    : { classes: [`${prefix}-${keyword}`], offScale: [] }
}

/** Which written length each side takes, by how many `padding` lists: top, right, bottom, left. */
const SIDE_INDEXES: Readonly<Record<number, readonly number[]>> = {
  1: [0, 0, 0, 0],
  2: [0, 1, 0, 1],
  3: [0, 1, 2, 1],
  4: [0, 1, 2, 3],
}

/** `padding`'s one to four lengths, as top, right, bottom, left. */
const sidesOf = (value: string): readonly string[] | undefined => {
  const parts = value.split(/\s+/).filter((part) => part !== '')
  return SIDE_INDEXES[parts.length]?.map((index) => parts[index] ?? '')
}

/** The fewest utilities that spell four sides: one, a pair, or each side. */
const paddingGroups = (sides: readonly string[]): readonly (readonly [string, string])[] => {
  const [top = '', right = '', bottom = '', left = ''] = sides
  if (top === bottom && right === left) {
    return top === right
      ? [['p', top]]
      : [
          ['py', top],
          ['px', right],
        ]
  }
  return [
    ['pt', top],
    ['pr', right],
    ['pb', bottom],
    ['pl', left],
  ]
}

/** The padding classes: written whole, or not at all when any side is off the scale. */
const paddingRead = (value: string | undefined, spacing: SpacingScale): LayoutRead => {
  if (value === undefined) return NOTHING
  const sides = sidesOf(value)
  if (sides === undefined) return { classes: [], offScale: [{ property: 'padding', value }] }
  const read = join(
    ...paddingGroups(sides).map(([prefix, side]) => spacedClass(prefix, 'padding', side, spacing))
  )
  const nearestToken = read.offScale[0]?.nearestToken
  return read.offScale.length === 0
    ? read
    : {
        classes: [],
        offScale: [
          { property: 'padding', value, ...(nearestToken === undefined ? {} : { nearestToken }) },
        ],
      }
}

/** A width limit as `max-w-<step>` or `max-w-full`; `none` writes nothing. */
const widthRead = (value: string | undefined, spacing: SpacingScale): LayoutRead => {
  if (value === undefined || value === 'none') return NOTHING
  if (value === '100%') return { classes: ['max-w-full'], offScale: [] }
  return spacedClass('max-w', 'width', value, spacing)
}

const EQUAL_COLUMNS = /^repeat\(\s*(\d+)\s*,\s*(?:1fr|minmax\(\s*0(?:px)?\s*,\s*1fr\s*\))\s*\)$/

const columnsRead = (value: string | undefined): LayoutRead => {
  if (value === undefined || value === 'none') return NOTHING
  const count = Number(EQUAL_COLUMNS.exec(value.trim())?.[1] ?? Number.NaN)
  return count >= 1 && count <= MIGRATED_GRID_MAX_COLUMNS
    ? { classes: [`grid-cols-${count}`], offScale: [] }
    : { classes: [], offScale: [{ property: 'columns', value }] }
}

/**
 * The classes a kit node of `target` is written with, read from the
 * declarations its Webflow classes set. `direction` is the flex direction the
 * element has before its classes say otherwise (a Webflow `VFlex` is a column).
 */
export const layoutOf = (
  target: LayoutTarget,
  declarations: ReadonlyMap<string, string>,
  spacing: SpacingScale,
  direction = 'row'
): LayoutRead => {
  const axis = target === 'flex' ? directionOf(declarations, direction) : direction
  const flexOrGrid = target === 'flex' || target === 'grid'
  return join(
    target === 'flex' && axis !== 'row'
      ? { classes: [DIRECTIONS[axis] ?? ''], offScale: [] }
      : NOTHING,
    target === 'grid' ? columnsRead(valueOf(declarations, 'grid-template-columns')) : NOTHING,
    gapRead(target, axis, declarations, spacing),
    flexOrGrid
      ? keywordRead('items', 'align', ALIGNMENTS, valueOf(declarations, 'align-items'))
      : NOTHING,
    flexOrGrid
      ? keywordRead('justify', 'justify', JUSTIFICATIONS, valueOf(declarations, 'justify-content'))
      : NOTHING,
    paddingRead(valueOf(declarations, 'padding'), spacing),
    widthRead(valueOf(declarations, 'max-width'), spacing)
  )
}
