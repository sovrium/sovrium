/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The three halves of a token read that are neither a token nor a count.
 *
 * Its own module rather than a section of `design-system-facets.ts` because that
 * file crossed its 400-line cap the moment the first two arrived — and the split
 * is not bookkeeping. Everything left there PROJECTS the DTCG document; these do
 * something else with it. `colourProjection` computes values that are not in the
 * document at any level (an Oklab conversion, a luminance ratio);
 * `typographyProjection` LIFTS two members out of a composite the document
 * carries only as a bundle; and `discardedDeclarations` reads the one member of
 * it that is explicitly NOT a token: what the operator declared that became
 * nothing.
 *
 * All three exist for one reason: a config page has no arithmetic and no string
 * operations, `$record.<field>` admits no dots, and the `unmappable` bucket is a
 * keyed OBJECT that no `rowsKey` can bind. Each returns a PATCH the row is
 * spread with, so a projection that answered nothing leaves the row unchanged
 * rather than blanking it.
 *
 * @see src/domain/models/api/admin/design-system/facets.ts
 */

import { measureContrast, srgbHex } from '@/domain/kernel/color/color-contrast'
import { SOVRIUM_EXTENSION_KEY } from '@/domain/models/api/admin/design-system'
import { stringifyTokenValue } from './design-system-token-rows'
import type { FlatTokenRow } from '@/domain/models/api/admin/design-system/component-types'
import type { DiscardedDeclaration } from '@/domain/models/api/admin/design-system/facets'
import type { DarkPaint, DarkPaintSource } from '@/domain/models/app/design/dark-palette-service'

/**
 * The colour-only half of a token row: its hex, its gamut, and its contrast with
 * the ground it sits on.
 *
 * Returns an EMPTY patch for a non-colour row, and for a colour that resolves to
 * nothing — a spacing token has no hex, and a hex invented for one would print
 * where a reader expects a measurement.
 *
 * The BACKGROUND row is excluded from the contrast triple: a colour measured
 * against itself is 1:1 and documents nothing, and publishing that would put a
 * meaningless `fail` badge on the one colour every other row is graded against.
 *
 * ─── AND EVERY ROW CARRIES A DARK GRADE, MEASURED OR NOT ──────────────────
 *
 * The dark half repeats the light one against `row.dark` and the DARK ground,
 * with one asymmetry that is deliberate: `darkContrastLevel` is REQUIRED and
 * answers `unmeasured` where the light half would simply omit its level.
 *
 * A page reads it as a GATE, and `visibility.record` has nine value comparisons
 * and no presence operator — so an omitted level is a state the page cannot
 * detect, and a dark badge would go on printing a light measurement with
 * nothing saying so. That is the exact failure of disclosure
 * an admin design system spec exists to pin.
 */
/**
 * The colour patch, typed so the ONE required member survives the spread.
 *
 * `Record<string, unknown>` would have been enough for the optional half, and
 * is not enough here: a caller spreading a loosely-typed patch onto a row loses
 * every guarantee about it, and `darkContrastLevel` being required is the whole
 * reason that field exists. Typed narrowly, a projection that forgot to answer
 * on some path fails at the call site rather than at the response encode.
 */
interface ColourProjection {
  readonly darkContrastLevel: 'AAA' | 'AA' | 'fail' | 'unmeasured'
  readonly hex?: string
  readonly gamut?: 'srgb' | 'wide'
  readonly contrastAgainst?: string
  readonly contrastRatio?: number
  readonly contrastLevel?: 'AAA' | 'AA' | 'fail'
  readonly darkHex?: string
  readonly darkGamut?: 'srgb' | 'wide'
  readonly darkContrastAgainst?: string
  readonly darkContrastRatio?: number
  readonly ink?: string
  readonly darkInk?: string
}

/**
 * The ground a colour is measured on: its leaf name and its value in one scheme.
 *
 * Each `*-foreground` sits on its own surface (`primary-foreground` on
 * `primary`), every other colour on `background` — see `colorGroundOf`.
 * Measuring every ink against `background` graded `primary-foreground` white on
 * white, "1:1 fails AA", on a palette whose button text is perfectly legible.
 */
export interface ContrastGround {
  readonly name: string
  readonly value: string
}

/** A colour function with an alpha below one: `oklch(1 0 0 / 10%)`, `rgb(0 0 0 / 0.4)`. */
const TRANSLUCENT = /\/\s*(?:0?\.\d+|\d{1,2}(?:\.\d+)?%)\s*\)$/

/** The gamut verdict of one value, on `hex`'s terms. */
const gamutOf = (value: string, hex: string | undefined): 'srgb' | 'wide' | undefined => {
  // A colour that RESOLVES but that sRGB cannot hold answers `wide`; one that
  // does not resolve at all answers neither, so an absent `hex` beside a
  // `gamut` means "out of gamut" and an absent `hex` with no `gamut` means "not
  // a colour we could read". Those are different facts.
  const resolvable = measureContrast(value, value) !== undefined
  return hex !== undefined ? 'srgb' : resolvable ? 'wide' : undefined
}

/**
 * The measurement of a colour on its ground, or nothing when the ground is the
 * colour itself (a colour measured against itself is 1:1 and documents
 * nothing) or either side does not resolve.
 */
const measureOn = (
  row: FlatTokenRow,
  value: string,
  ground: ContrastGround | undefined
):
  | { readonly against: string; readonly ratio: number; readonly level: 'AAA' | 'AA' | 'fail' }
  | undefined => {
  if (ground === undefined || row.path === `color.${ground.name}`) return undefined
  // A translucent colour has no contrast of its own: what shows is a blend with
  // whatever is under it, and measuring the opaque colour would print a ratio
  // for a pair that is never on screen (shadcn's dark `border` is 10 % white).
  if (TRANSLUCENT.test(value)) return undefined
  const measured = measureContrast(value, ground.value)
  return measured === undefined ? undefined : { against: ground.name, ...measured }
}

/** The alpha a translucent colour function declares: `/ 10%` → 0.1, `/ 0.4` → 0.4. */
const alphaOf = (value: string): number => {
  const match = /\/\s*([\d.]+)(%?)\s*\)$/.exec(value)
  const figure = Number(match?.[1] ?? '1')
  return match?.[2] === '%' ? figure / 100 : figure
}

/** The byte a `#RRGGBB` spells at offset `at` (1, 3 or 5). */
const byteAt = (hex: string, at: number): number => parseInt(hex.slice(at, at + 2), 16)

/** The printed hex: `#RRGGBB`, plus the alpha byte (`#RRGGBBAA`) when the colour is translucent. */
const printedHex = (value: string): string | undefined => {
  const hex = srgbHex(value)
  if (hex === undefined || !TRANSLUCENT.test(value)) return hex
  const alpha = Math.round(alphaOf(value) * 255)
  return `${hex}${alpha.toString(16).padStart(2, '0').toUpperCase()}`
}

/**
 * What a colour LOOKS like on its ground: a translucent colour laid over the
 * ground's colour, channel by channel in sRGB as a browser composites it, and
 * an opaque one (or one whose sides do not resolve) as itself. White at 10 %
 * over a near-black background shows near-black, and is inked for that.
 */
const compositeOver = (value: string, ground: ContrastGround | undefined): string => {
  if (ground === undefined || !TRANSLUCENT.test(value)) return value
  const [top, under] = [srgbHex(value), srgbHex(ground.value)]
  if (top === undefined || under === undefined) return value
  const alpha = alphaOf(value)
  return `#${[1, 3, 5]
    .map((at) => Math.round(byteAt(top, at) * alpha + byteAt(under, at) * (1 - alpha)))
    .map((channel) => channel.toString(16).padStart(2, '0'))
    .join('')}`
}

/** The two inks a label drawn ON a swatch can take. */
const INKS = ['#0A0A0A', '#FFFFFF'] as const

/**
 * The ink a label is legible in when it is drawn on `value` itself — near-black
 * or white, whichever contrasts more with the colour as it shows on `ground`. A swatch carries its name and values on
 * its own colour, so the ink follows the colour rather than the page.
 */
const inkOn = (value: string, ground: ContrastGround | undefined): string | undefined => {
  const shown = compositeOver(value, ground)
  const [dark, light] = INKS.map((ink) => measureContrast(ink, shown)?.ratio)
  if (dark === undefined || light === undefined) return undefined
  return dark >= light ? INKS[0] : INKS[1]
}

/**
 * The LIGHT half: what the row paints by default, and how it grades there.
 *
 * Split from its dark twin because the two are one shape over two operands, and
 * a single function doing both crossed the complexity cap — which was the
 * honest signal that they are two measurements rather than one with a flag.
 */
const lightHalf = (
  row: FlatTokenRow,
  ground: ContrastGround | undefined
): Partial<ColourProjection> => {
  const hex = printedHex(row.value)
  const gamut = gamutOf(row.value, hex)
  const measured = measureOn(row, row.value, ground)

  const ink = inkOn(row.value, ground)
  return {
    ...(hex === undefined ? {} : { hex }),
    ...(gamut === undefined ? {} : { gamut }),
    ...(ink === undefined ? {} : { ink }),
    ...(measured === undefined
      ? {}
      : {
          contrastAgainst: measured.against,
          contrastRatio: measured.ratio,
          contrastLevel: measured.level,
        }),
  }
}

/**
 * The DARK half: the same shape over what the row paints in dark and the dark
 * ground.
 *
 * Always answers a `darkContrastLevel`, which is the one asymmetry with the
 * light half and the reason this is not that function with a parameter — see
 * the module header.
 */
const darkHalf = (
  row: FlatTokenRow,
  darkValue: string | undefined,
  darkGround: ContrastGround | undefined
): Pick<ColourProjection, 'darkContrastLevel'> & Partial<ColourProjection> => {
  // Nothing to project: no dark value is known for this token, which answers
  // `unmeasured` rather than an absence — see the module header for why that
  // field is required.
  if (darkValue === undefined) return { darkContrastLevel: 'unmeasured' }

  const darkHex = printedHex(darkValue)
  const darkGamut = gamutOf(darkValue, darkHex)
  const measured = measureOn(row, darkValue, darkGround)

  const darkInk = inkOn(darkValue, darkGround)
  return {
    ...(darkHex === undefined ? {} : { darkHex }),
    ...(darkGamut === undefined ? {} : { darkGamut }),
    ...(darkInk === undefined ? {} : { darkInk }),
    ...(measured === undefined
      ? { darkContrastLevel: 'unmeasured' as const }
      : {
          darkContrastAgainst: measured.against,
          darkContrastRatio: measured.ratio,
          darkContrastLevel: measured.level,
        }),
  }
}

/**
 * @param row - the token row.
 * @param grounds - what this row is measured on, in each scheme.
 * @param darkValue - what the row paints in dark: the declared counterpart, the
 *   light value of a light-only declaration, or the platform dark default.
 */
export const colourProjection = (
  row: FlatTokenRow,
  grounds: { readonly light?: ContrastGround; readonly dark?: ContrastGround },
  darkValue?: string
): ColourProjection => {
  // `darkContrastLevel` is REQUIRED on every row, including the non-colour ones
  // that leave here immediately: it is a GATE, and a gate absent from half the
  // rows is one `visibility.record` cannot use — there is no presence operator
  // to test the absence with. `unmeasured` is the honest answer for a spacing
  // token, and it is an answer rather than a silence.
  if (!row.path.startsWith('color.')) return { darkContrastLevel: 'unmeasured' }
  return { ...lightHalf(row, grounds.light), ...darkHalf(row, darkValue, grounds.dark) }
}

/**
 * The typography-only half of a token row: the two members of the composite a
 * Foundations ladder addresses on their own.
 *
 * Returns an EMPTY patch for every row that is not a `typography.*` token, on
 * {@link colourProjection}'s terms exactly — a spacing token has no leading, and
 * a `lineHeight: 0` invented for one would print a number where a reader
 * expects silence.
 *
 * ─── WHY THE ROW CANNOT DO THIS ITSELF ─────────────────────────────────────
 *
 * A typography token's `$value` is a composite — family, size, weight, tracking,
 * leading — and `value` renders it with the generic `key: value; …` fallback,
 * because unlike a colour or a dimension the bundle has no single CSS spelling.
 * A config page has no string operations to cut that apart, and
 * `$record.<field>` admits no dots, so `$record.value.fontSize` resolves
 * `$record.value` and ships `.fontSize` as literal text.
 *
 * ─── AND WHY IT READS THE DOCUMENT RATHER THAN THE CONFIG ──────────────────
 *
 * The row IS a projection of the DTCG document, so the document is what its
 * members must agree with. Reading `app.design.typeScale[step].size` instead
 * would publish the authored string beside a `value` that had been through
 * `parseDimensionValue`, and the two would disagree on any spelling that
 * normalises — `2.750rem` becomes `2.75rem`, a bare `0` becomes `0px`. One
 * source, spelled by one serialiser.
 */
export const typographyProjection = (
  row: FlatTokenRow,
  document: Readonly<Record<string, unknown>>
): { readonly fontSize?: string; readonly lineHeight?: number } => {
  if (!row.path.startsWith('typography.')) return {}

  const group = document['typography'] as Readonly<Record<string, unknown>> | undefined
  const token = group?.[row.path.slice('typography.'.length)] as
    Readonly<{ $value?: unknown }> | undefined
  const composite = token?.$value
  if (typeof composite !== 'object' || composite === null) return {}

  const { fontSize, lineHeight } = composite as Readonly<Record<string, unknown>>
  return {
    // Spelled by the SAME serialiser `value` spends — see its docstring. A
    // second formatter here would be a second opinion on one member.
    ...(fontSize === undefined ? {} : { fontSize: stringifyTokenValue(fontSize) }),
    // A step may declare a size and no leading, which is a real state and not a
    // gap: the leading then comes from the cascade, and a fabricated ratio would
    // document a declaration the author never made.
    ...(typeof lineHeight === 'number' ? { lineHeight } : {}),
  }
}

/**
 * Everything this app declared that did not become a token, as ROWS.
 *
 * The document publishes `inert` as an array of `{ path, declared, reason }` and
 * `unmappable` as a keyed OBJECT, and a keyed object is not a row set at all: a
 * page binding it would be handed ONE record whose fields are config paths. Both
 * are flattened here into one row shape carrying its own `kind`, so a panel can
 * bind them once and split them with a per-row gate.
 *
 * `unmappable` carries no `reason` because its `kind` is the whole explanation
 * and it is NOT a defect — the value is shipped and working; it simply has no
 * faithful DTCG form.
 */
export const discardedDeclarations = (
  document: Readonly<Record<string, unknown>>
): readonly DiscardedDeclaration[] => {
  const extension = (document['$extensions'] as Readonly<Record<string, unknown>> | undefined)?.[
    SOVRIUM_EXTENSION_KEY
  ] as Readonly<Record<string, unknown>> | undefined

  const inert = Array.isArray(extension?.['inert'])
    ? (extension['inert'] as readonly unknown[])
    : []
  const unmappable = (extension?.['unmappable'] ?? {}) as Readonly<Record<string, unknown>>

  return [
    ...inert.flatMap((entry): readonly DiscardedDeclaration[] => {
      const row = entry as { path?: unknown; declared?: unknown; reason?: unknown }
      return typeof row.path === 'string' && typeof row.declared === 'string'
        ? [
            {
              kind: 'inert' as const,
              path: row.path,
              declared: row.declared,
              ...(typeof row.reason === 'string' ? { reason: row.reason } : {}),
            },
          ]
        : []
    }),
    ...Object.entries(unmappable).flatMap(([path, declared]): readonly DiscardedDeclaration[] =>
      typeof declared === 'string' ? [{ kind: 'unmappable' as const, path, declared }] : []
    ),
  ]
}

/** A token row's own name, without its group. */
export const leafOf = (row: FlatTokenRow): string => row.path.split('.').at(-1) ?? row.path

/**
 * What a colour row paints in the DARK scheme, and who chose it — read off the
 * shared dark cascade (`resolveDarkPaints`), the rule the stylesheet's dark
 * block and the exported dark document are written from, so the console never
 * prints a dark value the app does not paint.
 *
 * - `declared` — the operator wrote a `design.darkColors` counterpart;
 * - `light` — the operator declared a BRAND colour for light only (or an
 *   extension colour nothing re-points), and it keeps that value in dark. A
 *   light-only NEUTRAL — `background`, `card`, `foreground` — is not kept: the
 *   stylesheet sends it to the platform's dark default, and so does this;
 * - `platform` — the platform supplies it: shadcn's dark default for the token,
 *   or the light text of a kept brand surface.
 *
 * A page printing "Platform value — not measured here" under every swatch of an
 * app with no dark palette left the reader with no value at all; the fallback
 * is a known literal, so it is printed and measured like any other.
 *
 * @param paints - the app's dark cascade, keyed by token leaf.
 */
export const darkPaintOf = (
  row: FlatTokenRow,
  paints: Readonly<Record<string, DarkPaint>>
): { readonly darkValue: string; readonly darkSource: DarkPaintSource } | undefined => {
  if (!row.path.startsWith('color.')) return undefined
  const paint = paints[leafOf(row)]
  return paint === undefined ? undefined : { darkValue: paint.value, darkSource: paint.source }
}
