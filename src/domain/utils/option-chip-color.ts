/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The platform's half of an author-declared option colour.
 *
 * [[internal ref] A7](../../../docs/architecture/decisions/024-restraint-as-the-design-default.md)
 * ruling 3: contrast is a property of a PAIR, and the app author owns only one
 * half of it. So the declared hex renders **as declared** — never clamped, never
 * rejected, never substituted — and Sovrium computes its companions: a
 * foreground meeting WCAG AA (4.5:1) against that fill, and a border derived
 * from the same hue so a pale chip stays delimited against a pale surface.
 *
 * Ruling 4 is why the hex is only ever a FILL: `theme.darkColors` is inert, so
 * one hex is the author's entire vocabulary and it must stay legible on both
 * surfaces. A hue used as TEXT is unreadable in one of the two modes; a hue used
 * as a fill with a derived foreground is self-contained in both, which is what
 * lets this module ignore the active mode entirely.
 */

/** `#RRGGBB` — the same grammar `SelectOptionSchema` validates. No alpha. */
const HEX_RGB = /^#[0-9a-fA-F]{6}$/

/**
 * Whether a string is a six-digit `#RRGGBB` colour.
 *
 * Exported so the renderers that paint an author-declared hex WITHOUT deriving
 * a companion pair — a `progress` fill, a `color` field's swatch, both of which
 * sit on their own surface and need no foreground — test the grammar through
 * the same definition {@link deriveOptionChipColors} does, rather than
 * re-declaring the regex per call site.
 */
export const isHexColor = (value: string): boolean => HEX_RGB.test(value)

type Rgb = readonly [number, number, number]

/** sRGB channel → linear-light, per WCAG 2.x. */
const LINEAR_THRESHOLD = 0.039_28

const toLinear = (channel: number): number => {
  const s = channel / 255
  return s <= LINEAR_THRESHOLD ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
}

/** WCAG 2.x relative luminance. */
const relativeLuminance = ([r, g, b]: Rgb): number =>
  0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b)

const parseHex = (hex: string): Rgb | undefined =>
  HEX_RGB.test(hex)
    ? [
        Number.parseInt(hex.slice(1, 3), 16),
        Number.parseInt(hex.slice(3, 5), 16),
        Number.parseInt(hex.slice(5, 7), 16),
      ]
    : undefined

const toHex = ([r, g, b]: Rgb): string =>
  `#${[r, g, b].map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`

/** Move `from` a fraction of the way toward `to`, per channel. */
const mix = (from: Rgb, to: Rgb, ratio: number): Rgb => [
  from[0] + (to[0] - from[0]) * ratio,
  from[1] + (to[1] - from[1]) * ratio,
  from[2] + (to[2] - from[2]) * ratio,
]

const BLACK: Rgb = [0, 0, 0]
const WHITE: Rgb = [255, 255, 255]

/**
 * How far the border is pulled from the fill toward the derived foreground.
 *
 * Reusing the foreground's direction is what makes one rule serve both
 * surfaces: a pale fill picks a black foreground, so its border darkens and the
 * chip stays delimited against a pale page; a dark fill picks white, so its
 * border lightens and the chip stays delimited against a dark one. Any ratio
 * above zero also guarantees `border !== fill`, since the foreground is by
 * construction the far extreme from the fill.
 */
const BORDER_MIX = 0.28

export interface OptionChipColors {
  /** The author's hex, verbatim. */
  readonly fill: string
  /** A foreground meeting WCAG AA (>= 4.5:1) against `fill`. */
  readonly foreground: string
  /** A delimiting edge derived from `fill`. */
  readonly border: string
}

/**
 * Derive the platform's companions for an author-declared option fill.
 *
 * The foreground is the higher-contrast of pure black and pure white. That is
 * not a shortcut — it is the only choice with a provable floor. Contrast against
 * black is `(L + 0.05) / 0.05` and against white is `1.05 / (L + 0.05)`; the two
 * cross at `L + 0.05 = sqrt(1.05 * 0.05)`, where BOTH equal ~4.58. Taking the
 * larger therefore never drops below 4.58:1 for any fill in sRGB. A softer
 * near-black (`#1A1A1A`) has no such floor: paired with white it bottoms out at
 * ~4.17:1 around `L = 0.20` and would ship chips that fail AA — measured, which
 * is why this returns the extremes and not a tasteful approximation.
 *
 * @param hex - the author's declared `#RRGGBB` fill
 * @returns the fill and its derived companions, or `undefined` when `hex` is not
 *   a six-digit hex colour. `undefined` means "render the default chip": the
 *   caller must not invent a colour for an author who declared none, and must
 *   not paint a value the schema would have rejected.
 */
export const deriveOptionChipColors = (hex: string): OptionChipColors | undefined => {
  const fill = parseHex(hex)
  if (!fill) return undefined

  const luminance = relativeLuminance(fill)
  const contrastWithBlack = (luminance + 0.05) / 0.05
  const contrastWithWhite = 1.05 / (luminance + 0.05)
  const foreground = contrastWithBlack >= contrastWithWhite ? BLACK : WHITE

  return {
    fill: hex,
    foreground: toHex(foreground),
    border: toHex(mix(fill, foreground, BORDER_MIX)),
  }
}

/**
 * The WCAG 2.x contrast ratio between two `#RRGGBB` colours, or `undefined` if
 * either is unparseable. Exported for the unit tests that pin the AA floor
 * {@link deriveOptionChipColors} claims.
 */
export const contrastRatio = (a: string, b: string): number | undefined => {
  const first = parseHex(a)
  const second = parseHex(b)
  if (!first || !second) return undefined
  const l1 = relativeLuminance(first)
  const l2 = relativeLuminance(second)
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
}
