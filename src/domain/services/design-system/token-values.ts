/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Authored CSS value → **W3C DTCG 2025.10** structured value.
 *
 * DTCG does not accept the strings an author writes. A colour `$value` is an
 * OBJECT (`{colorSpace, components, alpha?, hex?}`), and `dimension` /
 * `duration` are `{value, unit}` over CLOSED unit sets (`px|rem`, `ms|s`).
 * Emitting the raw `'#6b7f5e'` or `'4rem'` produces a document that looks like
 * DTCG and fails every conformant consumer.
 *
 * ─── EVERY PARSER RETURNS `undefined` RATHER THAN GUESSING ──────────────────
 *
 * This is the load-bearing property of the module, not a convenience. DTCG's
 * structured types cannot represent an arbitrary CSS string, and bending one to
 * fit is worse than omitting it: a malformed `dimension` is a lie a conformant
 * tool will act on. `clamp(1rem, 2vw, 3rem)` has no DTCG dimension form, so it
 * gets `undefined` here and the caller records it as UNMAPPABLE — the author's
 * declaration is neither emitted as a phantom token nor silently dropped.
 *
 * @see https://www.designtokens.org/tr/drafts/format/
 */

/** A DTCG colour value. `hex` is populated only when the author wrote hex. */
export interface DtcgColorValue {
  readonly colorSpace: string
  readonly components: readonly number[]
  readonly alpha?: number
  readonly hex?: string
}

/** A DTCG dimension value. DTCG permits exactly these two units. */
export interface DtcgDimensionValue {
  readonly value: number
  readonly unit: 'px' | 'rem'
}

/** A DTCG duration value. DTCG permits exactly these two units. */
export interface DtcgDurationValue {
  readonly value: number
  readonly unit: 'ms' | 's'
}

/** Six-digit hex — the one form that round-trips VERBATIM into `hex`. */
const HEX_6 = /^#[0-9a-fA-F]{6}$/
/** Three-digit shorthand, expanded before use. */
const HEX_3 = /^#[0-9a-fA-F]{3}$/
/** Eight-digit hex — six digits of colour plus an alpha byte. */
const HEX_8 = /^#[0-9a-fA-F]{8}$/

/** `oklch(0.985 0 0)` / `rgb(107, 127, 94)` / `hsl(90 20% 43% / 0.5)`. */
const FUNCTIONAL_COLOR = /^([a-z]+)\(([^)]*)\)$/i

/**
 * Colour-function names whose components DTCG carries as-authored.
 *
 * `srgb` is deliberately absent: `rgb()` channels are 0–255 in CSS and 0–1 in
 * DTCG, so it needs the rescale below rather than a pass-through.
 */
const PASS_THROUGH_COLOR_SPACES: ReadonlySet<string> = new Set([
  'oklch',
  'oklab',
  'lab',
  'lch',
  'hsl',
  'hwb',
])

/** Round to six decimals — enough for 8-bit fidelity, short enough to read. */
const round6 = (value: number): number => Math.round(value * 1e6) / 1e6

/** Parse one numeric token, honouring a trailing `%` as a percentage. */
const parseComponent = (raw: string, percentBase: number): number | undefined => {
  const trimmed = raw.trim()
  if (trimmed === 'none') return 0
  const percent = trimmed.endsWith('%')
  const numeric = Number(percent ? trimmed.slice(0, -1) : trimmed)
  if (!Number.isFinite(numeric)) return undefined
  return round6(percent ? (numeric / 100) * percentBase : numeric)
}

/** Split a colour function's argument list on commas, spaces and the `/` alpha separator. */
const splitColorArguments = (
  args: string
): { readonly channels: readonly string[]; readonly alpha?: string } => {
  const [colorPart, alphaPart] = args.split('/')
  const channels = (colorPart ?? '')
    .split(/[\s,]+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
  // `rgba(r, g, b, a)` / `hsla(h, s, l, a)` carry alpha as a fourth comma
  // channel rather than after a slash. Both spellings are in the wild.
  if (alphaPart === undefined && channels.length === 4) {
    return { channels: channels.slice(0, 3), alpha: channels[3] }
  }
  return { channels, alpha: alphaPart?.trim() }
}

/** Expand `#abc` to `#aabbcc`. */
const expandShorthandHex = (hex: string): string =>
  `#${[...hex.slice(1)].map((digit) => `${digit}${digit}`).join('')}`

/** `#rrggbb` → the three 0–1 sRGB components DTCG expects. */
const hexToComponents = (hex: string): readonly number[] => [
  round6(Number.parseInt(hex.slice(1, 3), 16) / 255),
  round6(Number.parseInt(hex.slice(3, 5), 16) / 255),
  round6(Number.parseInt(hex.slice(5, 7), 16) / 255),
]

/** 0–1 sRGB components → the `#rrggbb` serialization hint. */
const componentsToHex = (components: readonly number[]): string =>
  `#${components
    .map((channel) =>
      Math.max(0, Math.min(255, Math.round(channel * 255)))
        .toString(16)
        .padStart(2, '0')
    )
    .join('')}`

/** Attach `alpha` only when the author actually declared one. */
const withAlpha = (value: DtcgColorValue, alpha: number | undefined): DtcgColorValue =>
  alpha === undefined ? value : { ...value, alpha }

/** Hexadecimal in any of its three lengths. */
const parseHexColor = (raw: string): DtcgColorValue | undefined => {
  if (HEX_6.test(raw)) {
    // The authored spelling is preserved BYTE FOR BYTE. This is what makes
    // round-trip fidelity assertable: an operator's `#6b7f5e` comes back as
    // `#6b7f5e`, not as a re-serialized `#6B7F5E`.
    return { colorSpace: 'srgb', components: hexToComponents(raw), hex: raw }
  }
  if (HEX_3.test(raw)) {
    const expanded = expandShorthandHex(raw)
    return { colorSpace: 'srgb', components: hexToComponents(expanded), hex: expanded }
  }
  if (HEX_8.test(raw)) {
    const rgb = raw.slice(0, 7)
    const alpha = round6(Number.parseInt(raw.slice(7, 9), 16) / 255)
    return { colorSpace: 'srgb', components: hexToComponents(rgb), alpha, hex: rgb }
  }
  return undefined
}

/** `rgb()` / `rgba()` — channels rescaled from CSS's 0–255 to DTCG's 0–1. */
const parseRgbColor = (
  channels: readonly string[],
  alpha: number | undefined
): DtcgColorValue | undefined => {
  const components = channels.map((channel) => {
    const parsed = parseComponent(channel, 255)
    return parsed === undefined ? undefined : round6(parsed / 255)
  })
  if (components.length !== 3 || components.some((channel) => channel === undefined)) {
    return undefined
  }
  const rgb = components as readonly number[]
  return withAlpha({ colorSpace: 'srgb', components: rgb, hex: componentsToHex(rgb) }, alpha)
}

/**
 * A colour space DTCG carries through as-authored: `oklch()`, `hsl()`, and
 * their siblings.
 */
const parsePassThroughColor = (
  space: string,
  channels: readonly string[],
  alpha: number | undefined
): DtcgColorValue | undefined => {
  if (!PASS_THROUGH_COLOR_SPACES.has(space)) return undefined

  // `oklch(50% 0.1 250)` — the lightness percentage is relative to 1, every
  // other percentage channel to 100 (`hsl(90 20% 43%)` stays 20 and 43).
  const components = channels.map((channel, index) =>
    parseComponent(channel, space.startsWith('ok') && index === 0 ? 1 : 100)
  )
  if (components.length < 3 || components.some((channel) => channel === undefined)) {
    return undefined
  }
  return withAlpha({ colorSpace: space, components: components as readonly number[] }, alpha)
}

/**
 * Parse an authored colour into its DTCG value.
 *
 * @param raw - The value as written in `theme.colors.*`.
 * @returns The DTCG value, or `undefined` when the form has no faithful DTCG
 *   representation (a named colour, `color-mix()`, a `var()` reference, …) —
 *   which the caller must record as unmappable rather than approximate.
 */
export const parseColorValue = (raw: string): DtcgColorValue | undefined => {
  const trimmed = raw.trim()

  const hex = parseHexColor(trimmed)
  if (hex) return hex

  const functional = FUNCTIONAL_COLOR.exec(trimmed)
  if (!functional) return undefined

  const name = (functional[1] ?? '').toLowerCase()
  const { channels, alpha: rawAlpha } = splitColorArguments(functional[2] ?? '')
  const alpha = rawAlpha === undefined ? undefined : parseComponent(rawAlpha, 1)

  return name === 'rgb' || name === 'rgba'
    ? parseRgbColor(channels, alpha)
    : parsePassThroughColor(name === 'hsla' ? 'hsl' : name, channels, alpha)
}

/** `4rem`, `16px`, and the unitless `0` CSS allows. */
const DIMENSION = /^(-?\d*\.?\d+)(px|rem)$/

/**
 * Parse an authored length into its DTCG dimension.
 *
 * @param raw - The value as written in `theme.spacing.*` / `theme.borderRadius.*`.
 * @returns The DTCG dimension, or `undefined` for anything DTCG's two units
 *   cannot express — `clamp()`, `%`, `em`, `vw`, `calc()`.
 */
export const parseDimensionValue = (raw: string): DtcgDimensionValue | undefined => {
  const trimmed = raw.trim()
  // A unitless zero is legal CSS and unambiguous; every other unitless number
  // is not, and guessing a unit for it is the exact lie this module refuses.
  if (/^-?0(\.0+)?$/.test(trimmed)) return { value: 0, unit: 'px' }

  const match = DIMENSION.exec(trimmed)
  if (!match) return undefined
  const value = Number(match[1])
  if (!Number.isFinite(value)) return undefined
  return { value, unit: match[2] as 'px' | 'rem' }
}

/** `200ms`, `0.3s`. */
const DURATION = /^(-?\d*\.?\d+)(ms|s)$/

/**
 * Parse an authored duration into its DTCG duration.
 *
 * @param raw - The value as written in `theme.animations.duration.*`.
 * @returns The DTCG duration, or `undefined` when the unit is not `ms` or `s`.
 */
export const parseDurationValue = (raw: string): DtcgDurationValue | undefined => {
  const match = DURATION.exec(raw.trim())
  if (!match) return undefined
  const value = Number(match[1])
  if (!Number.isFinite(value)) return undefined
  return { value, unit: match[2] as 'ms' | 's' }
}

/**
 * Render a DTCG colour back to the shortest honest human-readable form.
 *
 * The markdown projection prints values for a READER, and `#6b7f5e` is what an
 * operator recognises from their own config; the components array is not. Falls
 * back to the functional form when the value was never hexadecimal, so an
 * inherited `oklch(0.985 0 0)` prints as itself rather than as an invented hex.
 *
 * @param value - A parsed DTCG colour value.
 */
export const formatColorValue = (value: DtcgColorValue): string => {
  if (value.hex !== undefined) return value.hex
  const components = value.components.join(' ')
  return value.alpha === undefined
    ? `${value.colorSpace}(${components})`
    : `${value.colorSpace}(${components} / ${value.alpha})`
}
