/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The ONE mapper from canonical DTCG tokens to the app's `design` key.
 *
 * Every import adapter (`adapters/import/`) turns its provider's export into
 * canonical tokens; this module alone decides where a token goes. Five
 * providers therefore share one set of placement rules:
 *
 *  - a `color` token goes to `design.colors` under its path, a leading
 *    `color`/`colors` group dropped, joined with `-` and lower-cased; its dark
 *    value goes to `design.darkColors` whenever it differs from what the app
 *    paints in dark, even when it equals the light one;
 *  - a dimension under a `radius`/`borderRadius`, `spacing`/`space` or
 *    `breakpoint`/`breakpoints`/`screen` group goes to that key, radius and
 *    spacing in `rem` at a 16px base (in `px` from 1000px up, where a pill is
 *    written), breakpoints in `px`;
 *  - a `fontFamily` under a `font`/`fontFamily` group goes to
 *    `design.typeScale.families`, the first name its `family`, the rest its
 *    `fallback`;
 *  - a text style named for a type-scale rung goes to that rung;
 *  - everything else is reported, never guessed into a key.
 *
 * ─── A CHANGE IS A REAL CHANGE ──────────────────────────────────────────────
 *
 * A token is compared with what the app ALREADY paints, declared or inherited,
 * and by value: lengths at a 16px base, colours as sRGB hex. That is what lets
 * a px-only tool hand back a rem config with an empty diff. The import adds and
 * changes leaves; it never removes one.
 *
 * ─── A DARK VALUE IS WHAT THE SOURCE STATES ─────────────────────────────────
 *
 * Each adapter emits, for the dark mode, only what the source states there: a
 * layered source (a DTCG dark file or resolver context, a Tokens Studio dark
 * theme, a `.dark` block) its own layer, a full-mode source (Claude Design,
 * Figma mode files) every token. So a stated dark value equal to its light one
 * is a decision — an app that stays light — and is written when the app would
 * otherwise paint something else in dark.
 */

import { Schema } from 'effect'
import { srgbHex } from '@/domain/kernel/color/color-contrast'
import { alphaHexByte, printNumber, pxToRem } from './adapters/adapter-units'
import {
  kebabSegment,
  lengthPx,
  ownValue,
  parseColor,
  parseLength,
  quoteFontName,
  splitFontStack,
  type CanonicalImport,
  type CanonicalToken,
  type ImportUnmapped,
} from './adapters/import/canonical-tokens-service'
import { ColorValueSchema } from './colors'
import { darkVariableOf, resolveDarkPalette } from './dark-palette-service'
import { DEFAULT_SHADCN_LIGHT_VALUES } from './default-design.generated'
import {
  INHERITED_BREAKPOINT_TOKENS,
  INHERITED_FONT_TOKENS,
  INHERITED_RADIUS_TOKENS,
  INHERITED_SPACING_TOKENS,
  SHADCN_COLOR_ROLES,
} from './inherited-tokens'

type JsonObject = Readonly<Record<string, unknown>>

/** One leaf of `design` the import adds or changes. */
export interface DesignImportChange {
  /** The leaf's path inside `design`. */
  readonly path: readonly string[]
  /** The declared value before, absent for an addition. */
  readonly before: string | undefined
  /** The value as written, in its config type. */
  readonly value: string | number
}

/** What an import would do to `design`. */
export interface DesignImportPlan {
  readonly changes: readonly DesignImportChange[]
  readonly unmapped: readonly ImportUnmapped[]
  /** The whole resulting `design`: the declared one with every change applied. */
  readonly design: JsonObject
}

/** One proposed leaf, before it is compared with what the app paints. */
interface Proposal {
  readonly path: readonly string[]
  readonly value: string | number
  readonly compare: 'color' | 'length' | 'exact'
}

type Placement = { readonly placed: readonly Proposal[] } | { readonly unmapped: ImportUnmapped }

const isObject = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * A leaf's value, read through own keys only: a token named `constructor` must
 * find nothing rather than `Object`, or it would compare against a function.
 */
const getIn = (root: unknown, path: readonly string[]): unknown =>
  path.reduce<unknown>((node, key) => (isObject(node) ? ownValue(node, key) : undefined), root)

/** A string-keyed table read by a name the source chose, own keys only. */
const lookup = <T>(table: Readonly<Record<string, T>>, key: string): T | undefined =>
  Object.hasOwn(table, key) ? table[key] : undefined

const setIn = (root: JsonObject, path: readonly string[], value: unknown): JsonObject => {
  const [head, ...rest] = path
  if (head === undefined) return root
  const child = ownValue(root, head)
  return {
    ...root,
    [head]: rest.length === 0 ? value : setIn(isObject(child) ? child : {}, rest, value),
  }
}

const COLOR_GROUPS = new Set(['color', 'colors'])
const RADIUS_GROUPS = new Set(['radius', 'borderradius', 'border-radius'])
const SPACING_GROUPS = new Set(['spacing', 'space'])
const BREAKPOINT_GROUPS = new Set(['breakpoint', 'breakpoints', 'screen', 'screens'])
const FONT_GROUPS = new Set(['font', 'fontfamily', 'font-family', 'fonts', 'fontfamilies'])

const COLOR_NAME = /^[a-z]+[a-z0-9]*(-[a-z0-9]+)*$/
const LENGTH_KEY = /^[a-z0-9]+(-[a-z0-9]+)*$/
const BREAKPOINT_KEY = /^[a-z0-9]+$/
const FAMILY_KEY = /^[a-zA-Z]+$/

/** The type-scale ladder a text style may name. */
const TYPE_SCALE_RUNGS = [
  'display',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'lead',
  'body',
  'bodySmall',
  'caption',
  'overline',
] as const

const FONT_WEIGHTS = new Set([100, 200, 300, 400, 500, 600, 700, 800, 900])

/**
 * From this length up, a radius or spacing is written in `px`: `9999px` is how
 * a pill is written, and `624.9375rem` paints the same and reads as noise. A
 * round number above any real corner or gap and below every pill idiom.
 */
const PX_LENGTH_FLOOR = 1000

const tokenName = (token: CanonicalToken): string => token.path.join('.')

const unmapped = (
  token: CanonicalToken,
  kind: ImportUnmapped['kind'],
  reason: string
): Placement => ({ unmapped: { token: tokenName(token), kind, reason } })

/** The joined, kebab-cased name of a path with its leading group dropped. */
const restName = (path: readonly string[]): string =>
  path.slice(1).map(kebabSegment).filter(Boolean).join('-')

const groupOf = (token: CanonicalToken): string => kebabSegment(token.path[0] ?? '')

/** Whether a colour is one `design.colors` accepts: the config's own schema decides. */
const isConfigColor = Schema.is(ColorValueSchema)

/** The colour function or DTCG colour space a value is written in, for a refusal. */
const colorSpaceOf = (value: unknown): string | undefined => {
  if (typeof value === 'string') return /^\s*([a-z-]+)\(/i.exec(value)?.[1]?.toLowerCase()
  return isObject(value) && typeof value['colorSpace'] === 'string'
    ? value['colorSpace']
    : undefined
}

/** The colour functions and DTCG spaces `design.colors` holds. */
const CONFIG_COLOR_SPACES = new Set(['rgb', 'rgba', 'hsl', 'hsla', 'oklch', 'srgb'])

const unsupportedSpace = (token: CanonicalToken): Placement => {
  const space = colorSpaceOf(token.value)
  return unmapped(
    token,
    'token-type',
    space === undefined || CONFIG_COLOR_SPACES.has(space)
      ? 'Its colour value is not one `design.colors` accepts.'
      : `Its colour space \`${space}\` is not one \`design.colors\` holds; ` +
          'convert it to hex, rgb(), hsl() or oklch().'
  )
}

const placeColor = (token: CanonicalToken): Placement => {
  const value = parseColor(token.value)
  if (value === undefined || !isConfigColor(value)) return unsupportedSpace(token)
  const segments =
    COLOR_GROUPS.has(groupOf(token)) && token.path.length > 1 ? token.path.slice(1) : token.path
  const name = segments.map(kebabSegment).filter(Boolean).join('-')
  return COLOR_NAME.test(name)
    ? { placed: [{ path: ['colors', name], value, compare: 'color' }] }
    : unmapped(token, 'group', `"${name}" is not a colour name \`design.colors\` accepts.`)
}

const placeLength = (
  token: CanonicalToken,
  key: 'radius' | 'spacing' | 'breakpoints'
): Placement => {
  const name = restName(token.path)
  const px = lengthPx(parseLength(token.value))
  if (px === undefined) return unmapped(token, 'token-type', 'Its length is not in px or rem.')
  const pattern = key === 'breakpoints' ? BREAKPOINT_KEY : LENGTH_KEY
  if (!pattern.test(name)) {
    return unmapped(token, 'group', `"${name}" is not a key \`design.${key}\` accepts.`)
  }
  if (key === 'breakpoints' && !Number.isInteger(px)) {
    return unmapped(token, 'token-type', 'A breakpoint is a whole number of px.')
  }
  const value =
    key === 'breakpoints' || px >= PX_LENGTH_FLOOR
      ? `${printNumber(px)}px`
      : `${printNumber(pxToRem(px))}rem`
  return { placed: [{ path: [key, name], value, compare: 'length' }] }
}

const placeDimension = (token: CanonicalToken): Placement => {
  const group = groupOf(token)
  if (token.path.length > 1 && RADIUS_GROUPS.has(group)) return placeLength(token, 'radius')
  if (token.path.length > 1 && SPACING_GROUPS.has(group)) return placeLength(token, 'spacing')
  if (token.path.length > 1 && BREAKPOINT_GROUPS.has(group)) {
    return placeLength(token, 'breakpoints')
  }
  return unmapped(
    token,
    'group',
    'A length outside a radius, spacing or breakpoint group names no `design` key.'
  )
}

const camelKey = (segments: readonly string[]): string =>
  segments
    .map(kebabSegment)
    .join('-')
    .replace(/-([a-z0-9])/g, (_match, next: string) => next.toUpperCase())

const placeFamily = (token: CanonicalToken): Placement => {
  if (token.path.length < 2 || !FONT_GROUPS.has(groupOf(token))) {
    return unmapped(token, 'group', 'A font family outside a `font` group names no family key.')
  }
  const key = camelKey(token.path.slice(1))
  const names = splitFontStack(token.value)
  if (!FAMILY_KEY.test(key) || names === undefined || names[0] === undefined) {
    return unmapped(token, 'group', `"${key}" is not a family key \`design.typeScale\` accepts.`)
  }
  const [family, ...fallback] = names
  const base = ['typeScale', 'families', key]
  return {
    placed: [
      { path: [...base, 'family'], value: family, compare: 'exact' },
      ...(fallback.length === 0
        ? []
        : [
            {
              path: [...base, 'fallback'],
              value: fallback.map(quoteFontName).join(', '),
              compare: 'exact' as const,
            },
          ]),
    ],
  }
}

const rungOf = (token: CanonicalToken): string | undefined => {
  const last = camelKey([token.path.at(-1) ?? ''])
  return TYPE_SCALE_RUNGS.find((rung) => rung === last)
}

/** The leaves of one type-scale step a text style states. */
const stepLeaves = (value: JsonObject): readonly (readonly [string, string | number])[] => {
  const sizePx = lengthPx(parseLength(value['fontSize']))
  const { lineHeight } = value
  const weight = Number(value['fontWeight'])
  const tracking = parseLength(value['letterSpacing'])
  return [
    ...(sizePx === undefined ? [] : [['size', `${printNumber(pxToRem(sizePx))}rem`] as const]),
    ...(typeof lineHeight === 'number' && lineHeight > 0
      ? [['lineHeight', lineHeight] as const]
      : []),
    ...(FONT_WEIGHTS.has(weight) ? [['weight', weight] as const] : []),
    ...(tracking !== undefined && ['px', 'rem', 'em'].includes(tracking.unit)
      ? [['letterSpacing', `${printNumber(tracking.value)}${tracking.unit}`] as const]
      : []),
  ]
}

const placeTextStyle = (token: CanonicalToken): Placement => {
  const rung = rungOf(token)
  if (rung === undefined) {
    return unmapped(token, 'text-style', 'It names no rung of the type-scale ladder.')
  }
  const leaves = isObject(token.value) ? stepLeaves(token.value) : []
  if (!leaves.some(([leaf]) => leaf === 'size')) {
    return unmapped(token, 'text-style', 'It states no font size in px or rem.')
  }
  return {
    placed: leaves.map(([leaf, value]) => ({
      path: ['typeScale', 'steps', rung, leaf],
      value,
      compare: leaf === 'size' ? 'length' : 'exact',
    })),
  }
}

/** Where one canonical token goes in `design`, or why it goes nowhere. */
const placeToken = (token: CanonicalToken): Placement => {
  switch (token.type) {
    case 'color':
      return placeColor(token)
    case 'dimension':
      return placeDimension(token)
    case 'fontFamily':
      return placeFamily(token)
    case 'typography':
      return placeTextStyle(token)
    case undefined:
    default:
      return unmapped(
        token,
        'token-type',
        `A \`${token.type ?? 'untyped'}\` token has no \`design\` key.`
      )
  }
}

/**
 * A colour's identity for comparison: its sRGB hex, plus its alpha byte when it
 * is translucent, so `oklch(1 0 0 / 10%)` and `#ffffff1a` compare equal while an
 * opaque white does not. A colour sRGB cannot hold compares as written.
 */
const colorKey = (value: string): string => {
  const trimmed = value.trim().toLowerCase()
  const hex8 = /^#([0-9a-f]{6})([0-9a-f]{2})$/.exec(trimmed)
  if (hex8 !== null) return hex8[2] === 'ff' ? `#${hex8[1] ?? ''}` : trimmed
  const base = srgbHex(trimmed)?.toLowerCase()
  if (base === undefined) return trimmed
  const alpha = alphaOfFunctional(trimmed)
  return alpha === undefined || alpha >= 1 ? base : `${base}${alphaHexByte(alpha)}`
}

/** The alpha of a colour function (`/ 10%`, or the fourth `rgba()` argument). */
const alphaOfFunctional = (value: string): number | undefined => {
  const slash = /\/\s*([\d.]+%?)\s*\)$/.exec(value)
  const comma = /^rgba?\([^,]+,[^,]+,[^,]+,\s*([\d.]+%?)\s*\)$/.exec(value)
  const raw = slash?.[1] ?? comma?.[1]
  if (raw === undefined) return undefined
  return raw.endsWith('%') ? Number(raw.slice(0, -1)) / 100 : Number(raw)
}

const sameValue = (proposal: Proposal, current: unknown): boolean => {
  if (current === undefined) return false
  if (proposal.compare === 'color' && typeof current === 'string') {
    return colorKey(current) === colorKey(String(proposal.value))
  }
  if (proposal.compare === 'length') {
    const a = lengthPx(parseLength(current))
    const b = lengthPx(parseLength(proposal.value))
    if (a !== undefined && b !== undefined) return Math.abs(a - b) < 0.0001
  }
  return String(current) === String(proposal.value)
}

const INHERITED_LENGTHS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  radius: INHERITED_RADIUS_TOKENS,
  spacing: INHERITED_SPACING_TOKENS,
  breakpoints: INHERITED_BREAKPOINT_TOKENS,
}

/** The colour a name paints when `design.colors` does not declare it under that name. */
const inheritedColor = (name: string, design: JsonObject): unknown => {
  const variable = darkVariableOf(name)
  const colors = ownValue(design, 'colors')
  const declared = Object.entries(isObject(colors) ? colors : {}).find(
    ([other]) => darkVariableOf(other) === variable
  )
  return declared?.[1] ?? lookup(DEFAULT_SHADCN_LIGHT_VALUES, variable)
}

/** The family or fallback an inherited face paints. */
const inheritedFamily = (key: string, leaf: string | undefined): string | undefined => {
  const stack = lookup(INHERITED_FONT_TOKENS, key)
  if (stack === undefined) return undefined
  return leaf === 'family' ? stack[0] : stack.slice(1).map(quoteFontName).join(', ')
}

/** The value a leaf inherits when `design` does not declare it. */
const inheritedAt = (path: readonly string[], design: JsonObject): unknown => {
  const [key = '', name = '', leaf] = path
  if (key === 'colors') return inheritedColor(name, design)
  if (key === 'typeScale')
    return name === 'families' ? inheritedFamily(leaf ?? '', path[3]) : undefined
  const table = lookup(INHERITED_LENGTHS, key)
  return leaf === undefined && table !== undefined ? lookup(table, name) : undefined
}

const declaredString = (design: JsonObject, path: readonly string[]): string | undefined => {
  const value = getIn(design, path)
  return typeof value === 'string' || typeof value === 'number' ? String(value) : undefined
}

/** The proposals that differ from what `design` paints, as changes. */
const diffProposals = (
  proposals: readonly Proposal[],
  design: JsonObject
): readonly DesignImportChange[] =>
  proposals
    .filter((proposal) => {
      const current = getIn(design, proposal.path) ?? inheritedAt(proposal.path, design)
      return !sameValue(proposal, current)
    })
    .map((proposal) => ({
      path: proposal.path,
      before: declaredString(design, proposal.path),
      value: proposal.value,
    }))

/** The last proposal for each path: a later token of the same name wins. */
const lastByPath = (proposals: readonly Proposal[]): readonly Proposal[] => [
  ...new Map(proposals.map((proposal) => [proposal.path.join('\u0000'), proposal])).values(),
]

const placeAll = (
  tokens: readonly CanonicalToken[]
): { readonly proposals: readonly Proposal[]; readonly unmapped: readonly ImportUnmapped[] } => {
  const placements = tokens.map(placeToken)
  return {
    proposals: lastByPath(
      placements.flatMap((placement) => ('placed' in placement ? placement.placed : []))
    ),
    unmapped: placements.flatMap((placement) =>
      'unmapped' in placement ? [placement.unmapped] : []
    ),
  }
}

const applyChanges = (design: JsonObject, changes: readonly DesignImportChange[]): JsonObject =>
  changes.reduce((next, change) => setIn(next, change.path, change.value), design)

const colorsOf = (design: JsonObject, key: string): Readonly<Record<string, string>> => {
  const value = ownValue(design, key)
  return isObject(value)
    ? Object.fromEntries(
        Object.entries(value).filter(
          (entry): entry is [string, string] => typeof entry[1] === 'string'
        )
      )
    : {}
}

/**
 * The dark colours that differ from what the app already paints in dark, once
 * the light changes are applied. Never compared with the light value: a stated
 * dark equal to its light one is still a dark decision.
 */
const diffDark = (
  darkProposals: readonly Proposal[],
  design: JsonObject
): readonly DesignImportChange[] => {
  const light = colorsOf(design, 'colors')
  const declaredDark = colorsOf(design, 'darkColors')
  const painted = resolveDarkPalette(SHADCN_COLOR_ROLES, light, declaredDark)
  return darkProposals
    .filter((proposal) => proposal.path[0] === 'colors')
    .flatMap((proposal) => {
      const name = proposal.path[1] ?? ''
      const lightValue = lookup(light, name)
      const declaredValue = lookup(declaredDark, name)
      const current = declaredValue ?? lookup(painted, darkVariableOf(name)) ?? lightValue
      if (sameValue(proposal, current)) return []
      return [{ path: ['darkColors', name], before: declaredValue, value: proposal.value }]
    })
}

/** The unmapped entries once each, in the order they were met. */
const uniqueUnmapped = (entries: readonly ImportUnmapped[]): readonly ImportUnmapped[] => [
  ...new Map(entries.map((entry) => [`${entry.kind}\u0000${entry.token}`, entry])).values(),
]

const pathOrder = (a: DesignImportChange, b: DesignImportChange): number => {
  const left = a.path.join('.')
  const right = b.path.join('.')
  if (left === right) return 0
  return left < right ? -1 : 1
}

/**
 * Plan an import: what it changes in `design`, what it leaves out, and the
 * whole resulting `design`.
 *
 * @param source - the canonical tokens an adapter produced.
 * @param declared - the config's own `design`, as written (`undefined` when it has none).
 */
export const planDesignImport = (source: CanonicalImport, declared: unknown): DesignImportPlan => {
  const design: JsonObject = isObject(declared) ? declared : {}
  const light = placeAll(source.light)
  const lightChanges = diffProposals(light.proposals, design)
  const afterLight = applyChanges(design, lightChanges)
  const dark = placeAll(source.dark ?? [])
  const darkChanges = diffDark(dark.proposals, afterLight)
  const changes = [...lightChanges, ...darkChanges].toSorted(pathOrder)
  return {
    changes,
    unmapped: uniqueUnmapped([...source.unmapped, ...light.unmapped, ...dark.unmapped]),
    design: applyChanges(afterLight, darkChanges),
  }
}
