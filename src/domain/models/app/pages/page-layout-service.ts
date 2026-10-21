/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A node's LAYOUT, read off the utility classes it is drawn with, each value
 * resolved to the design token it is on the scale of.
 *
 * The page export's design tree carries a container's direction, gap,
 * alignment, padding and width at the base and at each breakpoint, so a design
 * tool can bind them to the same variables. They are read from the node's
 * `props.className` and from each `responsive.<bp>.props.className` — and from
 * a `<bp>:` prefix inside either — because that is where a page writes them.
 *
 * A spacing step (`gap-4`, `p-6`) is the token `spacing.<step>` when the app's
 * `design.spacing` declares that step, at its declared value; a step it does not
 * declare is Tailwind's own `0.25rem` multiple and names no token. An
 * enumerated value (a direction, an alignment) names none either. A class this
 * reader does not know is left alone: the tree describes what it can read, and
 * the drawing still shows the rest.
 *
 * The other way, `layoutClassNameOf` writes a tree layout back as the utility
 * classes that read as it, so a drawing can carry a node's own layout apart
 * from the classes its component paints with.
 */

import type { PageDesignTreeNode } from '@/domain/models/api/admin/design-system/page-design-tree'

/** `design.spacing`: a step name to its CSS length. */
export type SpacingScale = Readonly<Record<string, string>>

type Layout = NonNullable<PageDesignTreeNode['layout']>
type LayoutValue = NonNullable<Layout['gap']>
type MutableLayout = { -readonly [P in keyof Layout]: Layout[P] }

const DIRECTIONS: Readonly<Record<string, string>> = {
  'flex-row': 'row',
  'flex-col': 'column',
  'flex-row-reverse': 'row-reverse',
  'flex-col-reverse': 'column-reverse',
}

const ALIGNMENTS: Readonly<Record<string, string>> = {
  start: 'start',
  center: 'center',
  end: 'end',
  stretch: 'stretch',
  baseline: 'baseline',
}

const JUSTIFICATIONS: Readonly<Record<string, string>> = {
  start: 'start',
  center: 'center',
  end: 'end',
  between: 'space-between',
  around: 'space-around',
  evenly: 'space-evenly',
}

const WIDTHS: Readonly<Record<string, string>> = { full: '100%', screen: '100vw', auto: 'auto' }

/** A spacing step, on the app's scale when it declares the step. */
const spacingValue = (step: string, spacing: SpacingScale): LayoutValue => {
  const declared = spacing[step]
  if (declared !== undefined) return { value: declared, token: `spacing.${step}` }
  return { value: `${Number(step) * 0.25}rem` }
}

/** The keyword utilities, by prefix: the property each sets and its value table. */
const KEYWORD_UTILITIES: Readonly<
  Record<string, readonly [keyof Layout, Readonly<Record<string, string>>]>
> = {
  items: ['align', ALIGNMENTS],
  justify: ['justify', JUSTIFICATIONS],
  w: ['width', WIDTHS],
}

/** The spacing utilities, by prefix: the property each sets on the scale. */
const SPACING_UTILITIES: Readonly<Record<string, keyof Layout>> = {
  gap: 'gap',
  p: 'padding',
  w: 'width',
}

/** The layout property one utility class sets, or `undefined` for any other class. */
const layoutOfClass = (
  utility: string,
  spacing: SpacingScale
): readonly [keyof Layout, LayoutValue] | undefined => {
  const direction = DIRECTIONS[utility]
  if (direction !== undefined) return ['direction', { value: direction }]
  const [, prefix = '', suffix = ''] = /^([a-z]+)-([a-z0-9.]+)$/.exec(utility) ?? []
  const spaced = SPACING_UTILITIES[prefix]
  if (spaced !== undefined && /^\d+(?:\.\d+)?$/.test(suffix)) {
    return [spaced, spacingValue(suffix, spacing)]
  }
  const keyword = KEYWORD_UTILITIES[prefix]
  const value = keyword?.[1][suffix]
  return keyword === undefined || value === undefined ? undefined : [keyword[0], { value }]
}

/** The class list of a node's `props`, or `''`. */
const classNameOf = (holder: unknown): string => {
  const className = (holder as { readonly props?: { readonly className?: unknown } } | undefined)
    ?.props?.className
  return typeof className === 'string' ? className : ''
}

/** Every `[breakpoint, property, value]` a class list sets; `''` is the base. */
const settingsOf = (
  className: string,
  breakpoint: string,
  spacing: SpacingScale
): readonly (readonly [string, keyof Layout, LayoutValue])[] =>
  className
    .split(/\s+/)
    .filter((token) => token !== '')
    .flatMap((token) => {
      const separator = token.lastIndexOf(':')
      const at = separator < 0 ? breakpoint : token.slice(0, separator)
      const setting = layoutOfClass(token.slice(separator + 1), spacing)
      return setting === undefined ? [] : [[at, setting[0], setting[1]] as const]
    })

/**
 * The base layout and the per-breakpoint layouts of one node, each absent when
 * it sets nothing. A later class wins over an earlier one, as in the cascade.
 */
export const layoutsOfClassName = (
  node: Readonly<Record<string, unknown>>,
  spacing: SpacingScale
): {
  readonly base: Layout | undefined
  readonly responsive: Readonly<Record<string, Layout>> | undefined
} => {
  const responsive = (node['responsive'] ?? {}) as Readonly<Record<string, unknown>>
  const settings = [
    ...settingsOf(classNameOf(node), '', spacing),
    ...Object.entries(responsive).flatMap(([breakpoint, variant]) =>
      settingsOf(classNameOf(variant), breakpoint, spacing)
    ),
  ]
  const byBreakpoint = settings.reduce<Readonly<Record<string, MutableLayout>>>(
    (acc, [breakpoint, property, value]) => ({
      ...acc,
      [breakpoint]: { ...acc[breakpoint], [property]: value },
    }),
    {}
  )
  const { '': base, ...rest } = byBreakpoint
  return {
    base,
    responsive: Object.keys(rest).length === 0 ? undefined : rest,
  }
}

/** A spacing value as its utility step: its token's step, else its `0.25rem` multiple. */
const stepOf = (value: LayoutValue): string | undefined => {
  if (value.token?.startsWith('spacing.') === true) return value.token.slice('spacing.'.length)
  const rem = /^(\d+(?:\.\d+)?)rem$/.exec(value.value)?.[1]
  if (rem === undefined) return undefined
  const step = Number(rem) / 0.25
  return Number.isInteger(step * 2) ? String(step) : undefined
}

/** The key of a value table that maps to `value`. */
const keyOf = (table: Readonly<Record<string, string>>, value: string): string | undefined =>
  Object.entries(table).find(([, candidate]) => candidate === value)?.[0]

/** The utility classes of one layout, in a fixed property order. */
const classesOfLayout = (layout: Layout): readonly string[] => {
  const spaced = (prefix: string, value: LayoutValue | undefined): readonly string[] => {
    const step = value === undefined ? undefined : stepOf(value)
    return step === undefined ? [] : [`${prefix}-${step}`]
  }
  const keyword = (
    prefix: string,
    table: Readonly<Record<string, string>>,
    value: LayoutValue | undefined
  ): readonly string[] => {
    const key = value === undefined ? undefined : keyOf(table, value.value)
    return key === undefined ? [] : [`${prefix}-${key}`]
  }
  const direction =
    layout.direction === undefined ? undefined : keyOf(DIRECTIONS, layout.direction.value)
  const width = layout.width === undefined ? undefined : keyOf(WIDTHS, layout.width.value)
  return [
    ...(direction === undefined ? [] : [direction]),
    ...spaced('gap', layout.gap),
    ...keyword('items', ALIGNMENTS, layout.align),
    ...keyword('justify', JUSTIFICATIONS, layout.justify),
    ...spaced('p', layout.padding),
    ...(width === undefined ? spaced('w', layout.width) : [`w-${width}`]),
  ]
}

/**
 * The utility classes that read back as a layout: the base layout's classes,
 * then each breakpoint's prefixed with `<bp>:`. A value no utility spells (a
 * length off the `0.25rem` grid) writes no class.
 */
export const layoutClassNameOf = (
  base: Layout | undefined,
  responsive: Readonly<Record<string, Layout>> | undefined
): string =>
  [
    ...(base === undefined ? [] : classesOfLayout(base)),
    ...Object.entries(responsive ?? {}).flatMap(([breakpoint, layout]) =>
      classesOfLayout(layout).map((utility) => `${breakpoint}:${utility}`)
    ),
  ].join(' ')
