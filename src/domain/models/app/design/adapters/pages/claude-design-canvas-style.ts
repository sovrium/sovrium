/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  layoutsOfClassName,
  type SpacingScale,
} from '@/domain/models/app/pages/page-layout-service'
import type { HtmlElementNode, HtmlNode } from '@/domain/kernel/sanitize/html-element-tree'
import type { PageDesignTreeNode } from '@/domain/models/api/admin/design-system/page-design-tree'
import type { DrawnConflict, DrawnPaint } from '@/domain/models/app/pages/page-drawing'

/**
 * The Claude Design page adapter, style half: what one stamped element of a
 * board says about its node's layout and paint, read from the three places a
 * board may set it.
 *
 * ─── THREE SOURCES, ONE ORDER ──────────────────────────────────────────────
 *
 * A board sets a node's layout in its inline `style` (what the canvas's
 * properties panel writes), in its `class` list (what an agent editing the
 * markup writes) and in the `data-kit-layout` the export stamped. When they
 * disagree, `style` wins over `class`, and `class` over `data-kit-layout`, and
 * every source that set the property to a different value is named as a
 * conflict, never silently dropped. An arbitrary class value (`gap-[13px]`) is
 * read as drawn, which the merge reports with its nearest step.
 *
 * ─── WHAT IT DOES NOT READ ─────────────────────────────────────────────────
 *
 * A class that is no layout utility (`italic`, `underline`) is named on its
 * node, never written; the merge sets aside every one an unedited export
 * draws too. A colour or a text size set inline is read as drawn, and the
 * merge writes it as its token's class or reports it with the nearest token.
 * An element wrapping a node's text (a `<span>`) is no kit component: it is
 * named, and a colour it paints is reported, never written.
 *
 * Pure: the same element always reads the same.
 */

/** Where a drawn layout value was read from, in the order the import trusts them. */
export type CanvasLayoutSource = DrawnConflict['kept']

/** One property a node set in more than one place, with different values. */
export type CanvasLayoutConflict = Omit<DrawnConflict, 'node'>

/** A node's paint: its background, its text colour and its text size, each as drawn. */
export type CanvasPaint = DrawnPaint

type Layout = NonNullable<PageDesignTreeNode['layout']>
type LayoutValue = NonNullable<Layout['gap']>
type Layouts = {
  readonly base: Layout | undefined
  readonly responsive: Readonly<Record<string, Layout>> | undefined
}

const DIRECTION_VALUES: Readonly<Record<string, string>> = {
  row: 'row',
  column: 'column',
  'row-reverse': 'row-reverse',
  'column-reverse': 'column-reverse',
}
const ALIGN_VALUES: Readonly<Record<string, string>> = {
  start: 'start',
  'flex-start': 'start',
  center: 'center',
  end: 'end',
  'flex-end': 'end',
  stretch: 'stretch',
  baseline: 'baseline',
}
const JUSTIFY_VALUES: Readonly<Record<string, string>> = {
  start: 'start',
  'flex-start': 'start',
  center: 'center',
  end: 'end',
  'flex-end': 'end',
  'space-between': 'space-between',
  'space-around': 'space-around',
  'space-evenly': 'space-evenly',
}

/** The keyword style properties a designer may set, the layout property each is, and its values. */
const KEYWORD_STYLES: Readonly<
  Record<string, readonly [keyof Layout, Readonly<Record<string, string>>]>
> = {
  'flex-direction': ['direction', DIRECTION_VALUES],
  'align-items': ['align', ALIGN_VALUES],
  'justify-content': ['justify', JUSTIFY_VALUES],
}

/** The length style properties a designer may set, resolved to the spacing scale. */
const LENGTH_STYLES: Readonly<Record<string, keyof Layout>> = {
  gap: 'gap',
  padding: 'padding',
  width: 'width',
}

/** The paint style properties, by the paint they set. */
const PAINT_STYLES: Readonly<Record<string, keyof CanvasPaint>> = {
  background: 'background',
  'background-color': 'background',
  color: 'color',
  'font-size': 'fontSize',
}

/** The utility prefixes an arbitrary class value (`gap-[13px]`) is read for. */
const ARBITRARY_UTILITIES: Readonly<Record<string, keyof Layout>> = {
  gap: 'gap',
  p: 'padding',
  w: 'width',
}

const WIDTH_KEYWORDS: ReadonlySet<string> = new Set(['100%', '100vw', 'auto'])

/** A CSS length in rem, `px` read at the browser's 16 px root; `undefined` for anything else. */
const remOf = (length: string): number | undefined => {
  const [, amount = '', unit = ''] = /^(\d+(?:\.\d+)?)(px|rem)$/.exec(length.trim()) ?? []
  if (amount === '') return undefined
  return unit === 'px' ? Number(amount) / 16 : Number(amount)
}

/**
 * A length on the scale: the declared step it equals (with its token), else
 * the `0.25rem` grid the utility classes are on, else nothing.
 */
const scaledLength = (length: string, spacing: SpacingScale): LayoutValue | undefined => {
  const rem = remOf(length)
  if (rem === undefined) return undefined
  const step = Object.entries(spacing).find(([, value]) => remOf(value) === rem)?.[0]
  if (step !== undefined) return { value: spacing[step] as string, token: `spacing.${step}` }
  return Number.isInteger(rem * 8) ? { value: `${rem}rem` } : undefined
}

/** A drawn length: on the scale when it is, else as drawn for the merge to report. */
const drawnLength = (length: string, spacing: SpacingScale): LayoutValue =>
  scaledLength(length, spacing) ?? { value: length.trim() }

/** One inline style declaration as a layout setting, or why it is not one. */
const styleSetting = (
  property: string,
  value: string,
  spacing: SpacingScale
): readonly [keyof Layout, LayoutValue] | string => {
  const offScale = `${property}: ${value} is off the scale`
  const keyword = KEYWORD_STYLES[property]
  if (keyword !== undefined) {
    const resolved = keyword[1][value]
    return resolved === undefined ? offScale : [keyword[0], { value: resolved }]
  }
  const length = LENGTH_STYLES[property]
  if (length === undefined) return `${property} is not a layout property the import reads`
  if (length === 'width' && WIDTH_KEYWORDS.has(value)) return ['width', { value }]
  // A length off the scale is drawn as it is: the merge reports it with its nearest step.
  if (remOf(value) === undefined) return offScale
  return [length, drawnLength(value, spacing)]
}

/** The `property: value` pairs of an inline style, lower-cased, in order. */
const declarationsOf = (style: string): readonly (readonly [string, string])[] =>
  style
    .split(';')
    .map((declaration) => declaration.split(':'))
    .filter((parts) => parts.length >= 2 && (parts[0] ?? '').trim() !== '')
    .map(
      (parts) => [(parts[0] ?? '').trim().toLowerCase(), parts.slice(1).join(':').trim()] as const
    )

/** One class token's layout setting: `[breakpoint, property, value]`, `''` the base. */
type ClassSetting = readonly [string, keyof Layout, LayoutValue]

/** An arbitrary-value layout class (`md:gap-[13px]`) as its setting, or `undefined`. */
const arbitrarySetting = (token: string, spacing: SpacingScale): ClassSetting | undefined => {
  const [, breakpoint = '', prefix = '', value = ''] =
    /^(?:([a-z0-9]+):)?([a-z]+)-\[([^\]]+)\]$/.exec(token) ?? []
  const property = ARBITRARY_UTILITIES[prefix]
  if (property === undefined || remOf(value) === undefined) return undefined
  return [breakpoint, property, drawnLength(value, spacing)]
}

/** One class token's layout settings: what the utility reader makes of it, or its arbitrary value. */
const classSettings = (token: string, spacing: SpacingScale): readonly ClassSetting[] => {
  const arbitrary = arbitrarySetting(token, spacing)
  if (arbitrary !== undefined) return [arbitrary]
  const read = layoutsOfClassName({ props: { className: token } }, spacing)
  return [
    ...Object.entries(read.base ?? {}).map(
      ([property, value]) => ['', property as keyof Layout, value as LayoutValue] as const
    ),
    ...Object.entries(read.responsive ?? {}).flatMap(([breakpoint, layout]) =>
      Object.entries(layout).map(
        ([property, value]) => [breakpoint, property as keyof Layout, value as LayoutValue] as const
      )
    ),
  ]
}

/** The layouts a class list sets, and the tokens it holds that set none. */
const classLayouts = (
  className: string,
  spacing: SpacingScale
): Layouts & { readonly unread: readonly string[] } => {
  const tokens = className.split(/\s+/).filter((token) => token !== '')
  const read = tokens.map((token) => [token, classSettings(token, spacing)] as const)
  const byBreakpoint = read
    .flatMap(([, settings]) => settings)
    .reduce<Readonly<Record<string, Layout>>>(
      (acc, [breakpoint, property, value]) => ({
        ...acc,
        [breakpoint]: { ...acc[breakpoint], [property]: value },
      }),
      {}
    )
  const { '': base, ...responsive } = byBreakpoint
  return {
    base,
    responsive: Object.keys(responsive).length === 0 ? undefined : responsive,
    // A prototype's own classes are its layer, never the page's.
    unread: read
      .filter(([token, settings]) => settings.length === 0 && !token.startsWith('proto-'))
      .map(([token]) => token),
  }
}

const LAYOUT_ORDER: readonly (keyof Layout)[] = [
  'direction',
  'gap',
  'align',
  'justify',
  'padding',
  'width',
]

/** One scope (the base, or one breakpoint) read from each source, highest precedence first. */
type Scoped = readonly (readonly [CanvasLayoutSource, Layout | undefined])[]

/** The kept layout of one scope, and every property its sources disagree on. */
const resolveScope = (
  label: string,
  sources: Scoped
): { readonly layout: Layout | undefined; readonly conflicts: readonly CanvasLayoutConflict[] } =>
  LAYOUT_ORDER.reduce<{
    readonly layout: Layout | undefined
    readonly conflicts: readonly CanvasLayoutConflict[]
  }>(
    (acc, property) => {
      const setting = sources.flatMap(([source, layout]) => {
        const value = layout?.[property]
        return value === undefined ? [] : [[source, value] as const]
      })
      const [kept] = setting
      if (kept === undefined) return acc
      const overridden = setting
        .slice(1)
        .filter(([, value]) => value.value !== kept[1].value)
        .map(([source]) => source)
      return {
        layout: { ...acc.layout, [property]: kept[1] },
        conflicts:
          overridden.length === 0
            ? acc.conflicts
            : [
                ...acc.conflicts,
                {
                  property: `${label}.${property}`,
                  kept: kept[0],
                  overridden,
                  value: kept[1].value,
                },
              ],
      }
    },
    { layout: undefined, conflicts: [] }
  )

/** A node's layout, as stamped and, on a node the export drew, as its class list and style set it. */
export interface CanvasNodeLayout extends Layouts {
  /** What is off the scale, or no layout property: one detail each. */
  readonly offScale: readonly string[]
  /** Every class token the import does not read, on a node the export drew. */
  readonly unread: readonly string[]
  readonly conflicts: readonly CanvasLayoutConflict[]
  /** The colours and text size set inline, as drawn. */
  readonly paint: CanvasPaint | undefined
}

/** The paint an inline style sets, `wrapped` when it is an element's inside the node. */
const paintOf = (style: string, wrapped: boolean): CanvasPaint =>
  Object.fromEntries(
    declarationsOf(style).flatMap(([property, value]) => {
      const paint = PAINT_STYLES[property]
      return paint === undefined
        ? []
        : [[paint, wrapped ? { value, wrapped: true as const } : { value }] as const]
    })
  )

/**
 * A node's layout: the stamped `data-kit-layout`, and — on a node the export
 * drew, whose class list is its own — the class list over it, then any inline
 * layout a designer set over both.
 *
 * @param element - the stamped element.
 * @param stamped - whether the export drew the node, so its class list is the page's.
 * @param attributes - the names of the stamped attribute and the spacing scale.
 */
export const canvasLayoutOf = (
  element: HtmlElementNode,
  stamped: boolean,
  options: { readonly layoutAttribute: string; readonly spacing: SpacingScale }
): CanvasNodeLayout => {
  const { spacing } = options
  const kit = layoutsOfClassName(
    { props: { className: element.attributes[options.layoutAttribute] ?? '' } },
    spacing
  )
  const classes = stamped
    ? classLayouts(element.attributes['class'] ?? '', spacing)
    : { base: undefined, responsive: undefined, unread: [] }
  const style = element.attributes['style'] ?? ''
  const settings = declarationsOf(style)
    .filter(([property]) => PAINT_STYLES[property] === undefined)
    .map(([property, value]) => styleSetting(property, value, spacing))
  const inline = settings
    .filter((setting): setting is readonly [keyof Layout, LayoutValue] => Array.isArray(setting))
    .reduce<Layout | undefined>(
      (layout, [property, value]) => ({ ...layout, [property]: value }),
      undefined
    )
  const base = resolveScope('layout', [
    ['style', inline],
    ['class', classes.base],
    ['data-kit-layout', kit.base],
  ])
  const breakpoints = [
    ...new Set([...Object.keys(classes.responsive ?? {}), ...Object.keys(kit.responsive ?? {})]),
  ].toSorted()
  const scopes = breakpoints.map(
    (breakpoint) =>
      [
        breakpoint,
        resolveScope(`responsive.${breakpoint}`, [
          ['class', classes.responsive?.[breakpoint]],
          ['data-kit-layout', kit.responsive?.[breakpoint]],
        ]),
      ] as const
  )
  const paint = paintOf(style, false)
  return {
    base: base.layout,
    responsive:
      scopes.length === 0
        ? undefined
        : Object.fromEntries(scopes.map(([breakpoint, scope]) => [breakpoint, scope.layout ?? {}])),
    offScale: settings.filter((setting): setting is string => typeof setting === 'string'),
    unread: classes.unread,
    conflicts: [...base.conflicts, ...scopes.flatMap(([, scope]) => scope.conflicts)],
    paint: Object.keys(paint).length === 0 ? undefined : paint,
  }
}

/** Visible text drawn directly in an element. */
const directTextOf = (element: HtmlElementNode): string =>
  element.children
    .flatMap((child) => (child.kind === 'text' ? [child.text] : []))
    .join('')
    .trim()

/** One element inside a node that wraps some of its text, and the paint it sets. */
export interface CanvasTextWrapper {
  readonly tag: string
  readonly paint: CanvasPaint
}

/**
 * The elements inside a node, kit components and their insides left out, that
 * draw text of their own: each wraps the node's text, and is no kit component.
 *
 * @param nodes - the node's children.
 * @param isKit - whether an element is a kit component, whose inside is its own.
 * @param skipped - whether an element is never content (a script) or a prototype's own.
 */
export const textWrappersOf = (
  nodes: readonly HtmlNode[],
  isKit: (element: HtmlElementNode) => boolean,
  skipped: (element: HtmlElementNode) => boolean
): readonly CanvasTextWrapper[] =>
  nodes.flatMap((node): readonly CanvasTextWrapper[] => {
    if (node.kind === 'text' || isKit(node) || skipped(node)) return []
    const inner = textWrappersOf(node.children, isKit, skipped)
    return directTextOf(node) === ''
      ? inner
      : [{ tag: node.tag, paint: paintOf(node.attributes['style'] ?? '', true) }, ...inner]
  })

/** A node's own paint, with what an element wrapping its text paints where it sets none. */
export const withWrappedPaint = (
  own: CanvasPaint | undefined,
  wrappers: readonly CanvasTextWrapper[]
): CanvasPaint | undefined => {
  const merged = wrappers.reduce<CanvasPaint>(
    (acc, wrapper) => ({ ...wrapper.paint, ...acc }),
    own ?? {}
  )
  return Object.keys(merged).length === 0 ? undefined : merged
}

/** How a browser shows an element's white space: collapsed, line breaks kept, or as written. */
type WhiteSpace = 'collapse' | 'lines' | 'preserve'

const PREFORMATTED_TAGS: ReadonlySet<string> = new Set(['pre', 'textarea', 'listing', 'plaintext'])

/** What each `white-space` value (or `white-space-collapse`, or `whitespace-*` class) keeps. */
const WHITE_SPACE_VALUES: Readonly<Record<string, WhiteSpace>> = {
  'pre-line': 'lines',
  pre: 'preserve',
  'pre-wrap': 'preserve',
  'break-spaces': 'preserve',
  preserve: 'preserve',
}

/** The white space one element sets for itself: its tag, its `whitespace-*` class, its style. */
const ownWhiteSpaceOf = (element: HtmlElementNode): WhiteSpace | undefined => {
  const declared = declarationsOf(element.attributes['style'] ?? '').findLast(
    ([property]) => property === 'white-space' || property === 'white-space-collapse'
  )?.[1]
  const value =
    declared ??
    (element.attributes['class'] ?? '')
      .split(/\s+/)
      .findLast((token) => token.startsWith('whitespace-'))
      ?.slice('whitespace-'.length)
  if (value !== undefined) return WHITE_SPACE_VALUES[value] ?? 'collapse'
  return PREFORMATTED_TAGS.has(element.tag) ? 'preserve' : undefined
}

/** The white space an element's text is shown with: its own, else the first one inside it sets. */
const whiteSpaceOf = (
  element: HtmlElementNode,
  isKit: (element: HtmlElementNode) => boolean
): WhiteSpace =>
  ownWhiteSpaceOf(element) ??
  element.children.reduce<WhiteSpace>(
    (found, child) =>
      found !== 'collapse' || child.kind === 'text' || isKit(child)
        ? found
        : whiteSpaceOf(child, isKit),
    'collapse'
  )

/**
 * Text as a browser shows it: every run of white space one space, none at
 * either end. A board re-indented or re-serialised by a tool draws the same
 * text, so it reads the same.
 *
 * @param text - the text as written.
 */
export const shownText = (text: string): string => text.replace(/\s+/g, ' ').trim()

/**
 * An element's text as a browser shows it. Inside a `<pre>`, a `<textarea>`
 * or an element whose `white-space` keeps its spaces (`pre`, `pre-wrap`,
 * `break-spaces`), every space and line break is the text's own — a code
 * block's indentation — and is read as written; under `pre-line` its line
 * breaks are kept and its other runs collapsed; anywhere else, `shownText`.
 *
 * @param element - the element whose text it is.
 * @param text - its text as written.
 * @param isKit - whether an element is a kit component, whose inside is its own.
 */
export const shownTextOf = (
  element: HtmlElementNode,
  text: string,
  isKit: (element: HtmlElementNode) => boolean
): string => {
  const mode = whiteSpaceOf(element, isKit)
  if (mode === 'preserve') return text
  if (mode === 'collapse') return shownText(text)
  return text
    .split(/\r?\n/)
    .map((line) => shownText(line))
    .join('\n')
    .trim()
}
