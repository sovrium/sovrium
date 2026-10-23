/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The page merge, one node's PAINT: the background, the text colour and the
 * text size a drawing sets on it, compared with an unedited export's.
 *
 * A paint is never approximated into the config. A value an element inside
 * the node sets (a `<span>` wrapping its text) is reported with the token
 * nearest it; so is a value no token of the app holds. A colour is matched to
 * a token by its variable (`var(--primary)`) or by its value in the light
 * theme the boards are drawn in, and the nearest token is the one closest to
 * it in Oklab, where a distance is what the eye sees.
 *
 * Pure: no I/O, the same inputs always give the same findings.
 */

import { oklchOf } from '@/domain/kernel/color/color-contrast'
import type { DrawnPaint, DrawnPaintEntry } from './page-drawing'
import type { PageImportReport } from '@/domain/models/api/admin/design-system/page-import-report'

type Page = PageImportReport['pages'][number]

/** The tokens a drawn paint is read against, as the canvas draws them. */
export interface PaintTokens {
  /** Each colour token's value in the light theme, by token name. */
  readonly colors: Readonly<Record<string, string>>
  /** Each type step's font size, by step name. */
  readonly typeSizes: Readonly<Record<string, string>>
}

/** What one node's paint came to, and how to write it. */
export interface PaintFindings {
  readonly changes: Page['changes']
  readonly offScale: Page['offScale']
  readonly apply: (node: Readonly<Record<string, unknown>>) => Readonly<Record<string, unknown>>
}

type Node = Readonly<Record<string, unknown>>

type PaintProperty = keyof DrawnPaint

/**
 * Each paint, the report property it is named by, the token family it is read
 * against, and the utility prefix its token's class is written with.
 */
const PAINTS: readonly (readonly [PaintProperty, string, 'colors' | 'typeSizes', string])[] = [
  ['background', 'style.background', 'colors', 'bg'],
  ['color', 'style.color', 'colors', 'text'],
  ['fontSize', 'style.typography', 'typeSizes', 'text'],
]

/** A colour in Oklab, `undefined` when it is no colour this platform reads. */
const oklabOf = (value: string): readonly [number, number, number] | undefined => {
  const colour = oklchOf(value)
  if (colour === undefined) return undefined
  const hue = (colour.h * Math.PI) / 180
  return [colour.l, colour.c * Math.cos(hue), colour.c * Math.sin(hue)]
}

/** The distance between two colours in Oklab; `undefined` when either is not read. */
const colourDistance = (a: string, b: string): number | undefined => {
  const left = oklabOf(a)
  const right = oklabOf(b)
  if (left === undefined || right === undefined) return undefined
  return Math.hypot(left[0] - right[0], left[1] - right[1], left[2] - right[2])
}

/** A CSS length in rem, `px` read at 16 px a rem; `undefined` for anything else. */
const remOf = (length: string): number | undefined => {
  const [, amount = '', unit = ''] = /^(\d+(?:\.\d+)?)(px|rem)$/.exec(length.trim()) ?? []
  if (amount === '') return undefined
  return unit === 'px' ? Number(amount) / 16 : Number(amount)
}

/** How far a drawn value is from a token's, in its family's terms. */
const distanceOf = (family: 'colors' | 'typeSizes', drawn: string, token: string) => {
  if (family === 'colors') return colourDistance(drawn, token)
  const [left, right] = [remOf(drawn), remOf(token)]
  return left === undefined || right === undefined ? undefined : Math.abs(left - right)
}

/** The token a `var(--name)` or `var(--color-name)` names, when the family holds it. */
const variableToken = (
  value: string,
  tokens: Readonly<Record<string, string>>
): string | undefined => {
  const [, name = ''] = /^var\(\s*--(?:color-)?([A-Za-z0-9_-]+)\s*\)$/.exec(value.trim()) ?? []
  return name !== '' && tokens[name] !== undefined ? name : undefined
}

/** The token a drawn value is, and else the token nearest it. */
export const tokenOfPaint = (
  family: 'colors' | 'typeSizes',
  value: string,
  tokens: Readonly<Record<string, string>>
): { readonly exact?: string | undefined; readonly nearest?: string | undefined } => {
  const named = variableToken(value, tokens)
  if (named !== undefined) return { exact: named }
  const ranked = Object.entries(tokens)
    .flatMap(([name, token]) => {
      const distance = distanceOf(family, value, token)
      return distance === undefined ? [] : [[name, distance] as const]
    })
    .toSorted((a, b) => a[1] - b[1])
  const [best] = ranked
  if (best === undefined) return {}
  return best[1] < 0.0005 ? { exact: best[0] } : { nearest: best[0] }
}

/** The name a token family's nearest token is reported under. */
const tokenLabel = (family: 'colors' | 'typeSizes', name: string): string =>
  family === 'colors' ? `color.${name}` : `type.${name}`

const sameEntry = (a: DrawnPaintEntry | undefined, b: DrawnPaintEntry | undefined): boolean =>
  a?.value === b?.value && a?.wrapped === b?.wrapped

/** The class list of a node's `props`, as tokens. */
const classesOf = (node: Node): readonly string[] => {
  const props = node['props'] as { readonly className?: unknown } | undefined
  return typeof props?.className === 'string'
    ? props.className.split(/\s+/).filter((token) => token !== '')
    : []
}

/** The class of one paint a node's class list already holds: `<prefix>-<a token of the family>`. */
const paintClassOf = (
  classes: readonly string[],
  prefix: string,
  tokens: Readonly<Record<string, string>>
): string | undefined =>
  classes.find(
    (token) =>
      token.startsWith(`${prefix}-`) && tokens[token.slice(prefix.length + 1)] !== undefined
  )

/** A node with one paint's class set: the family's class it held replaced, else appended. */
const withPaintClass = (
  node: Node,
  utility: string,
  family: { readonly prefix: string; readonly tokens: Readonly<Record<string, string>> }
): Node => {
  const classes = classesOf(node)
  const held = paintClassOf(classes, family.prefix, family.tokens)
  const next =
    held === undefined
      ? [...classes, utility]
      : classes.map((token) => (token === held ? utility : token))
  const props = (node['props'] ?? {}) as Node
  return { ...node, props: { ...props, className: next.join(' ') } }
}

/** What one drawn paint comes to: its token's class, or a report with the nearest token. */
type PaintOutcome =
  | { readonly kind: 'written'; readonly change: Page['changes'][number]; readonly utility: string }
  | { readonly kind: 'kept'; readonly entry: Page['offScale'][number] }

const outcomeOf = (
  node: string,
  config: Node,
  paint: { readonly drawn: DrawnPaintEntry; readonly property: string },
  family: {
    readonly name: 'colors' | 'typeSizes'
    readonly prefix: string
    readonly tokens: Readonly<Record<string, string>>
  }
): PaintOutcome => {
  const read = tokenOfPaint(family.name, paint.drawn.value, family.tokens)
  if (read.exact !== undefined && paint.drawn.wrapped !== true) {
    const utility = `${family.prefix}-${read.exact}`
    const before = paintClassOf(classesOf(config), family.prefix, family.tokens)
    return {
      kind: 'written',
      utility,
      change: {
        node,
        property: paint.property,
        ...(before === undefined ? {} : { before }),
        after: utility,
      },
    }
  }
  const nearest = read.exact ?? read.nearest
  return {
    kind: 'kept',
    entry: {
      node,
      property: paint.property,
      value: paint.drawn.value,
      ...(nearest === undefined ? {} : { nearestToken: tokenLabel(family.name, nearest) }),
    },
  }
}

/**
 * Every paint one node was drawn with that an unedited export does not draw:
 * a token's value or variable is written as the token's class
 * (`bg-muted`, `text-primary`, `text-lead`); any other value, and any value an
 * element inside the node painted, is reported with the token nearest it.
 *
 * @param subject - the node's path id, its config entry, and its paint as drawn and unedited.
 * @param tokens - the app's colour and type tokens, as the canvas draws them.
 */
export const paintFindings = (
  subject: {
    readonly node: string
    readonly config: Node
    readonly drawn: DrawnPaint | undefined
    readonly baseline: DrawnPaint | undefined
  },
  tokens: PaintTokens | undefined
): PaintFindings => {
  const outcomes = PAINTS.flatMap(([paint, property, name, prefix]) => {
    const drawn = subject.drawn?.[paint]
    if (drawn === undefined || sameEntry(drawn, subject.baseline?.[paint])) return []
    const family = { name, prefix, tokens: tokens?.[name] ?? {} }
    const outcome = outcomeOf(subject.node, subject.config, { drawn, property }, family)
    // A class the node already holds is no change.
    return outcome.kind === 'written' && outcome.change.before === outcome.utility
      ? []
      : [[outcome, family] as const]
  })
  return {
    changes: outcomes.flatMap(([outcome]) => (outcome.kind === 'written' ? [outcome.change] : [])),
    offScale: outcomes.flatMap(([outcome]) => (outcome.kind === 'kept' ? [outcome.entry] : [])),
    apply: (node) =>
      outcomes.reduce<Node>(
        (acc, [outcome, family]) =>
          outcome.kind === 'written' ? withPaintClass(acc, outcome.utility, family) : acc,
        node
      ),
  }
}
