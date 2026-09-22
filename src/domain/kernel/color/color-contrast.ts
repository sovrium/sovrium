/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * WCAG 2.x contrast, computed from the colour forms this platform actually
 * declares.
 *
 * ─── WHY THIS IS NOT `option-chip-color.ts` ─────────────────────────────────
 *
 * `contrastRatio` there is HEX-ONLY, and it is right to be: it serves the
 * option-chip derivation, whose input is an author-picked hex. The platform's
 * OWN tokens are `oklch` ([internal ref] mints the default ramp in Oklch), while an
 * app's declared brand accent is commonly hex (`apps/partner` declares
 * `signature: '#5a6b4f'`) and a `pairsWith` target may be a bare `rgb()` or a
 * CSS keyword. A design-system surface has to measure ALL of those against each
 * other, so it needs a parser that spans them — and widening the chip helper in
 * place would change the behaviour of a shipped, unrelated derivation.
 *
 * ─── EVERY PARSE RETURNS `undefined` RATHER THAN GUESSING ───────────────────
 *
 * This is the load-bearing property. A contrast badge exists to be ACTED on: an
 * operator reads "2.5:1, fails AA" and changes a colour. A ratio computed from
 * a colour the parser only half-understood is worse than no badge at all,
 * because it is indistinguishable from one that is right. So an unrecognised
 * form yields `undefined` and the caller prints nothing.
 *
 * ─── THE CONVERSION CHAIN, AND WHERE IT IS VERIFIED ─────────────────────────
 *
 * WCAG's relative luminance is defined over LINEAR sRGB. Hex and `rgb()` are
 * gamma-encoded sRGB, so they are linearised by the published transfer
 * function. Oklch is not sRGB at all: it goes Oklch → Oklab → LMS → linear
 * sRGB, at which point it meets the other two and no gamma step applies —
 * applying one there is the single likeliest way to get a plausible wrong
 * number, which is why the two paths converge on {@link luminanceOfLinear}
 * rather than on a shared "to hex" step.
 *
 * The chain is pinned in `color-contrast.test.ts` against the [internal ref] light
 * defaults, whose first three values are independently corroborated by the
 * founder-approved Foundations mockup.
 */

/** A resolved contrast measurement. */
export interface ContrastMeasurement {
  /** The ratio, 1–21, rounded to two decimals. */
  readonly ratio: number
  /** WCAG grade at normal body-text size. */
  readonly level: 'AAA' | 'AA' | 'fail'
}

/** Linear-light sRGB, each channel 0–1. */
type LinearRgb = readonly [number, number, number]

/** Six-digit hex. Three-digit shorthand is expanded before this is tested. */
const HEX_6 = /^#[0-9a-fA-F]{6}$/
/** Three-digit shorthand. */
const HEX_3 = /^#[0-9a-fA-F]{3}$/
/** `oklch(...)` / `rgb(...)` / `rgba(...)`, with the args left to the caller. */
const FUNCTIONAL = /^([a-z]+)\(([^)]*)\)$/i

/**
 * The handful of CSS keywords a `pairsWith` target realistically names.
 *
 * Deliberately NOT the full 148-name CSS table: this exists because
 * `apps/partner` declares `pairsWith: 'white'`, and a design token named
 * `rebeccapurple` is a case that has never occurred. An absent keyword returns
 * `undefined` and the badge is omitted, which is the honest outcome.
 */
const KEYWORDS: Readonly<Record<string, string>> = {
  white: '#ffffff',
  black: '#000000',
  transparent: '#ffffff',
}

/** WCAG's sRGB transfer function: gamma-encoded channel → linear-light. */
const linearise = (channel: number): number =>
  channel <= 0.040_45 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4

/** Clamp a linear channel that an out-of-gamut Oklch value can push past 0–1. */
const clamp01 = (value: number): number => Math.min(1, Math.max(0, value))

/** Parse one numeric argument, honouring a trailing `%` against a given base. */
const numberAt = (parts: readonly string[], index: number, percentBase: number): number => {
  const raw = parts[index]
  if (raw === undefined || raw === 'none') return 0
  const value = Number.parseFloat(raw)
  if (Number.isNaN(value)) return Number.NaN
  return raw.trimEnd().endsWith('%') ? (value / 100) * percentBase : value
}

/** Split a colour function's arguments on commas, spaces, and the alpha slash. */
const argumentsOf = (body: string): readonly string[] =>
  body
    .replace('/', ' ')
    .split(/[\s,]+/)
    .filter((part) => part.length > 0)

/** Gamma-encoded sRGB hex → linear-light sRGB. */
const linearFromHex = (hex: string): LinearRgb => {
  const expanded = HEX_3.test(hex)
    ? `#${[...hex.slice(1)].map((digit) => `${digit}${digit}`).join('')}`
    : hex
  const [r, g, b] = [1, 3, 5].map((offset) =>
    linearise(Number.parseInt(expanded.slice(offset, offset + 2), 16) / 255)
  )
  return [r ?? 0, g ?? 0, b ?? 0]
}

/**
 * Oklch → linear-light sRGB, via Oklab and the LMS cone space.
 *
 * The matrices are Björn Ottosson's published Oklab constants. The result is
 * ALREADY linear — there is deliberately no `linearise` call on this path.
 */
const oklchToLinear = (parts: readonly string[]): LinearRgb => {
  const lightness = numberAt(parts, 0, 1)
  const chroma = numberAt(parts, 1, 0.4)
  const hue = (numberAt(parts, 2, 360) * Math.PI) / 180
  if (Number.isNaN(lightness) || Number.isNaN(chroma) || Number.isNaN(hue)) {
    return [Number.NaN, Number.NaN, Number.NaN]
  }

  const a = chroma * Math.cos(hue)
  const b = chroma * Math.sin(hue)

  const long = (lightness + 0.396_337_777_4 * a + 0.215_803_757_3 * b) ** 3
  const medium = (lightness - 0.105_561_345_8 * a - 0.063_854_172_8 * b) ** 3
  const short = (lightness - 0.089_484_177_5 * a - 1.291_485_548 * b) ** 3

  return [
    4.076_741_662_1 * long - 3.307_711_591_3 * medium + 0.230_969_929_2 * short,
    -1.268_438_004_6 * long + 2.609_757_401_1 * medium - 0.341_319_396_5 * short,
    -0.004_196_086_3 * long - 0.703_418_614_7 * medium + 1.707_614_701 * short,
  ]
}

/**
 * The CLAMPED Oklch conversion — what a contrast measurement needs.
 *
 * Clamping is correct here and wrong one function down. A ratio against a colour
 * sRGB cannot hold is still worth approximating, because the alternative is
 * refusing to grade a palette at all; a HEX for that colour is not, because a
 * clamped hex is a different colour presented as an equivalence. The split is
 * the whole reason {@link oklchToLinear} returns raw channels.
 */
const linearFromOklch = (parts: readonly string[]): LinearRgb => {
  const [r, g, b] = oklchToLinear(parts).map(clamp01)
  return [r ?? Number.NaN, g ?? Number.NaN, b ?? Number.NaN]
}

/** `rgb(107 127 94)` / `rgba(107, 127, 94, 0.5)` → linear-light sRGB. */
const linearFromRgb = (parts: readonly string[]): LinearRgb => {
  const channels = [0, 1, 2].map((index) => numberAt(parts, index, 255) / 255)
  const [r, g, b] = channels.map((channel) =>
    Number.isNaN(channel) ? Number.NaN : linearise(clamp01(channel))
  )
  return [r ?? Number.NaN, g ?? Number.NaN, b ?? Number.NaN]
}

/**
 * Any supported CSS colour string → linear-light sRGB.
 *
 * `undefined` for anything not understood — see the module note on why that is
 * the point rather than a limitation.
 */
const COLOR_SPACES: Readonly<Record<string, (parts: readonly string[]) => LinearRgb>> = {
  oklch: linearFromOklch,
  rgb: linearFromRgb,
  rgba: linearFromRgb,
}

/** A functional colour notation, or `undefined` for a space this cannot read. */
const fromFunctional = (trimmed: string): LinearRgb | undefined => {
  const functional = FUNCTIONAL.exec(trimmed)
  if (functional === null) return undefined
  const parse = COLOR_SPACES[(functional[1] ?? '').toLowerCase()]
  return parse === undefined ? undefined : parse(argumentsOf(functional[2] ?? ''))
}

const toLinearRgb = (value: string): LinearRgb | undefined => {
  const trimmed = value.trim()
  if (trimmed.length === 0) return undefined

  const keyword = KEYWORDS[trimmed.toLowerCase()]
  if (keyword !== undefined) return linearFromHex(keyword)
  if (HEX_6.test(trimmed) || HEX_3.test(trimmed)) return linearFromHex(trimmed)

  const linear = fromFunctional(trimmed)
  if (linear === undefined) return undefined
  return linear.some((channel) => Number.isNaN(channel)) ? undefined : linear
}

/** WCAG relative luminance, over channels that are ALREADY linear-light. */
const luminanceOfLinear = ([r, g, b]: LinearRgb): number => 0.2126 * r + 0.7152 * g + 0.0722 * b

/**
 * The WCAG 2.x contrast ratio between two CSS colours, and its grade.
 *
 * The grade is stated at NORMAL body-text size (AA 4.5, AAA 7) rather than at
 * the large-text thresholds, because a design-system token is documented once
 * and used at whatever size the author reaches for — grading it at the lenient
 * threshold would certify a pair that fails wherever it is most read.
 *
 * @param foreground - the ink, in hex, `rgb()`, `oklch()`, or `white`/`black`.
 * @param background - the ground it sits on, in the same forms.
 * @returns the measurement, or `undefined` if either colour is not understood.
 */
export const measureContrast = (
  foreground: string,
  background: string
): ContrastMeasurement | undefined => {
  const ink = toLinearRgb(foreground)
  const ground = toLinearRgb(background)
  if (ink === undefined || ground === undefined) return undefined

  const [lighter, darker] = [luminanceOfLinear(ink), luminanceOfLinear(ground)].toSorted(
    (a, b) => b - a
  )
  const raw = ((lighter ?? 0) + 0.05) / ((darker ?? 0) + 0.05)
  const ratio = Math.round(raw * 100) / 100

  return { ratio, level: ratio >= 7 ? 'AAA' : ratio >= 4.5 ? 'AA' : 'fail' }
}

/** The badge text an operator reads: `19.07:1 AA`. */
export const formatContrast = (measurement: ContrastMeasurement): string =>
  `${measurement.ratio.toFixed(2)}:1 ${measurement.level === 'fail' ? 'fails AA' : measurement.level}`

/**
 * How far outside 0–1 a linear channel may sit and still be called in-gamut.
 *
 * A colour on the exact sRGB boundary lands a hair either side of it after the
 * matrix multiply, and refusing a hex for `oklch(0.985 0 0)` on a rounding
 * artefact would be worse than useless. Wide enough to absorb that and far
 * narrower than any real excursion — the out-of-gamut green this exists to
 * catch overshoots by 0.28 and 0.065 on two channels.
 */
const GAMUT_EPSILON = 0.000_001

/** Linear-light channel → the gamma-encoded byte sRGB writes it as. */
const encodeChannel = (channel: number): number => {
  const clamped = clamp01(channel)
  const encoded = clamped <= 0.003_130_8 ? clamped * 12.92 : 1.055 * clamped ** (1 / 2.4) - 0.055
  return Math.round(encoded * 255)
}

/**
 * The `#RRGGBB` a colour spells, or `undefined` when sRGB cannot hold it.
 *
 * ─── THE `undefined` IS THE FEATURE ────────────────────────────────────────
 *
 * Oklch names colours outside the sRGB gamut, and the obvious implementation —
 * clamp, then format — prints a pure green beside a declared colour that is not
 * that green. Well-formed, confident and wrong, which is the class the design
 * console exists to remove. So the gamut test runs on the UNCLAMPED channels,
 * before any encoding, and a caller that gets `undefined` is expected to say
 * there is no faithful hex rather than to show one anyway.
 *
 * ─── AND WHY IT LIVES HERE RATHER THAN IN A NEW MODULE ─────────────────────
 *
 * This file already goes Oklch → Oklab → LMS → linear sRGB on every contrast
 * measurement. What was missing is the RETURN path: one transfer function and
 * byte formatting. A second module would have carried a second copy of the
 * Ottosson matrices, which is the drift this whole surface is built to prevent.
 *
 * Upper-case, because the case is a decision rather than a detail: the approved
 * console artifact prints `#FAFAFA`, and a hex an operator copies out of the
 * console into a stylesheet beside Sovrium's own should not arrive in a third
 * spelling.
 *
 * @param value - any notation {@link measureContrast} understands.
 */
export const srgbHex = (value: string): string | undefined => {
  const trimmed = value.trim()
  const functional = FUNCTIONAL.exec(trimmed)
  const linear =
    functional !== null && (functional[1] ?? '').toLowerCase() === 'oklch'
      ? oklchToLinear(argumentsOf(functional[2] ?? ''))
      : toLinearRgb(trimmed)

  if (linear === undefined || linear.some((channel) => Number.isNaN(channel))) return undefined
  if (linear.some((channel) => channel < -GAMUT_EPSILON || channel > 1 + GAMUT_EPSILON)) {
    return undefined
  }

  return `#${linear
    .map((channel) => encodeChannel(channel).toString(16).padStart(2, '0'))
    .join('')}`.toUpperCase()
}
