/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { srgbHex } from '@/domain/kernel/color/color-contrast'
import { escapeCssValue } from '@/domain/kernel/sanitize/css-value-escaping'
import { alphaHexByte, hexByteFraction, printNumber, remToPx, roundTo } from '../adapter-units'
import type { DesignSystemDocument } from '@/domain/models/api/admin/design-system/design-system'

/**
 * What every export adapter shares: its input, its output, and the value
 * conversions more than one provider needs.
 *
 * ─── A PROJECTION OF THE BUNDLE TOKENS, NEVER OF THE APP ──────────────────
 *
 * An adapter reads the two DTCG documents the bundle writes under `tokens/`
 * (one per colour mode) and nothing else. It never sees the `App`, so it
 * cannot describe a different design system than the bundle beside it: a
 * value found in an adapter file was converted from a token, not re-derived.
 */

/** One file an adapter writes, at its bundle-relative path. */
export interface AdapterFile {
  /** The path inside the bundle, `/`-separated, under `adapters/<provider>/`. */
  readonly path: string
  /** The file text, UTF-8. */
  readonly content: string
}

/** The two colour modes of the bundle tokens, as `buildDesignSystem` writes them. */
export interface DesignTokenModes {
  readonly light: DesignSystemDocument
  readonly dark: DesignSystemDocument
}

/** A DTCG colour value, as the bundle tokens carry it. */
export type DtcgColorValue = DesignSystemDocument['color'][string]['$value']

/** A DTCG dimension value, as the bundle tokens carry it. */
export type DtcgDimensionValue = DesignSystemDocument['spacing'][string]['$value']

/** A DTCG dimension in px, converting `rem` at the base the import converts back at. */
export const dimensionInPx = (dimension: DtcgDimensionValue): number =>
  dimension.unit === 'rem' ? remToPx(dimension.value) : dimension.value

/** A DTCG duration in seconds. */
export const durationInSeconds = (duration: {
  readonly value: number
  readonly unit: 'ms' | 's'
}): number => (duration.unit === 'ms' ? roundTo(duration.value / 1000, 6) : duration.value)

/** A DTCG dimension written back as a CSS length, in its own unit. */
export const dimensionAsCss = (dimension: DtcgDimensionValue): string =>
  `${dimension.value}${dimension.value === 0 ? '' : dimension.unit}`

/** The two-digit hex byte of an opacity, `''` when the colour is opaque. */
const opacityByte = (alpha: number | undefined): string =>
  alpha === undefined || alpha === 1 ? '' : alphaHexByte(alpha)

/**
 * A colour as a CSS literal with plain numeric arguments: the authored hex
 * when there is one, else the colour function of its own space. Never a
 * `var()` or a `color-mix()`: the value is a literal by construction.
 */
export const colorAsCssLiteral = (color: DtcgColorValue): string => {
  if (color.hex !== undefined) {
    return `${color.hex.toLowerCase()}${opacityByte(color.alpha)}`
  }
  const channels = color.components.map((component) => printNumber(component)).join(' ')
  const alpha = color.alpha === undefined || color.alpha === 1 ? '' : ` / ${color.alpha}`
  return color.colorSpace === 'srgb'
    ? `color(srgb ${channels}${alpha})`
    : `${color.colorSpace}(${channels}${alpha})`
}

/** The six-digit sRGB hex of a colour, or `undefined` when it has none (out of gamut). */
export const colorAsHex = (color: DtcgColorValue): string | undefined => {
  if (color.hex !== undefined) return color.hex.toLowerCase()
  if (color.colorSpace === 'srgb') {
    return `#${color.components
      .map((component) =>
        Math.round(Math.min(1, Math.max(0, component)) * 255)
          .toString(16)
          .padStart(2, '0')
      )
      .join('')}`
  }
  const channels = color.components.map((component) => printNumber(component, 6)).join(' ')
  return srgbHex(`${color.colorSpace}(${channels})`)?.toLowerCase()
}

/**
 * The sRGB hex of a colour WITH its opacity — eight digits when it is
 * translucent, six when it is opaque — or `undefined` when it has no sRGB
 * form. For a format whose colour is one string (Tokens Studio), where a
 * six-digit hex would silently paint a 10 % border fully opaque.
 */
export const colorAsHexWithAlpha = (color: DtcgColorValue): string | undefined => {
  const hex = colorAsHex(color)
  return hex === undefined ? undefined : `${hex}${opacityByte(color.alpha)}`
}

/** The three sRGB components of a six-digit hex, on a 0–1 scale. */
export const hexComponents = (hex: string): readonly [number, number, number] => {
  const [red, green, blue] = [1, 3, 5].map((offset) =>
    hexByteFraction(hex.slice(offset, offset + 2))
  )
  return [red ?? 0, green ?? 0, blue ?? 0]
}

/** The first family of a DTCG font-family value: one name, unquoted. */
export const firstFontFamily = (value: string | readonly string[]): string => {
  const first = typeof value === 'string' ? (value.split(',')[0] ?? value) : (value[0] ?? '')
  return first.trim().replace(/^["']|["']$/g, '')
}

/** The keyword families CSS reads unquoted. */
const GENERIC_FAMILIES = new Set([
  'serif',
  'sans-serif',
  'monospace',
  'cursive',
  'fantasy',
  'system-ui',
  'ui-serif',
  'ui-sans-serif',
  'ui-monospace',
  'ui-rounded',
  'emoji',
  'math',
  'fangsong',
])

/**
 * A family name inside the double quotes of a CSS string: its own quotes and
 * backslashes escaped, and nothing in it able to end the declaration.
 */
const quotedFamily = (family: string): string =>
  `"${escapeCssValue(family.replace(/["\\]/g, (character) => `\\${character}`))}"`

/**
 * A DTCG font-family value as a CSS `font-family` stack, names with spaces
 * quoted. The stack is written into a stylesheet by the tool that reads it,
 * so a name is escaped rather than trusted to be a font name.
 */
export const fontFamilyStack = (value: string | readonly string[]): string =>
  (typeof value === 'string' ? value.split(',') : value)
    .map((family) => family.trim().replace(/^["']|["']$/g, ''))
    .filter((family) => family.length > 0)
    .map((family) =>
      GENERIC_FAMILIES.has(family) || /^[A-Za-z][A-Za-z0-9-]*$/.test(family)
        ? family
        : quotedFamily(family)
    )
    .join(', ')

/** A JSON file's text: two-space indent and a final newline, so two runs are byte-equal. */
export const jsonFileContent = (value: unknown): string =>
  `${JSON.stringify(value, undefined, 2)}\n`
