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
import { stringifyTokenValue } from './design-system-schema'
import type { FlatTokenRow } from '@/domain/models/api/admin/design-system/component-types'
import type { DiscardedDeclaration } from '@/domain/models/api/admin/design-system/facets'

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
 * `[internal ref]` exists to pin.
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
}

/**
 * The LIGHT half: what the row paints by default, and how it grades there.
 *
 * Split from its dark twin because the two are one shape over two operands, and
 * a single function doing both crossed the complexity cap — which was the
 * honest signal that they are two measurements rather than one with a flag.
 */
const lightHalf = (row: FlatTokenRow, ground: string | undefined): Partial<ColourProjection> => {
  const hex = srgbHex(row.value)
  // A colour that RESOLVES but that sRGB cannot hold answers `wide`; one that
  // does not resolve at all answers neither, so an absent `hex` beside a
  // `gamut` means "out of gamut" and an absent `hex` with no `gamut` means "not
  // a colour we could read". Those are different facts.
  const resolvable = measureContrast(row.value, row.value) !== undefined
  const gamut = hex !== undefined ? 'srgb' : resolvable ? 'wide' : undefined
  const measured =
    ground === undefined || row.path === 'color.background'
      ? undefined
      : measureContrast(row.value, ground)

  return {
    ...(hex === undefined ? {} : { hex }),
    ...(gamut === undefined ? {} : { gamut }),
    ...(measured === undefined
      ? {}
      : {
          contrastAgainst: 'background',
          contrastRatio: measured.ratio,
          contrastLevel: measured.level,
        }),
  }
}

/**
 * The DARK half: the same shape over `row.dark` and the dark ground.
 *
 * Always answers a `darkContrastLevel`, which is the one asymmetry with the
 * light half and the reason this is not that function with a parameter — see
 * the module header.
 */
const darkHalf = (
  row: FlatTokenRow,
  darkGround: string | undefined
): Pick<ColourProjection, 'darkContrastLevel'> & Partial<ColourProjection> => {
  const { dark } = row
  // Nothing to project: the app declared no dark counterpart for this token,
  // which is the common case and answers `unmeasured` rather than an absence —
  // see the module header for why that field is required.
  if (dark === undefined) return { darkContrastLevel: 'unmeasured' }

  const darkHex = srgbHex(dark)
  const resolvable = measureContrast(dark, dark) !== undefined
  const darkGamut = darkHex !== undefined ? 'srgb' : resolvable ? 'wide' : undefined
  const measured =
    darkGround === undefined || row.path === 'color.background'
      ? undefined
      : measureContrast(dark, darkGround)

  return {
    ...(darkHex === undefined ? {} : { darkHex }),
    ...(darkGamut === undefined ? {} : { darkGamut }),
    ...(measured === undefined
      ? { darkContrastLevel: 'unmeasured' as const }
      : {
          darkContrastAgainst: 'background',
          darkContrastRatio: measured.ratio,
          darkContrastLevel: measured.level,
        }),
  }
}

export const colourProjection = (
  row: FlatTokenRow,
  ground: string | undefined,
  darkGround?: string
): ColourProjection => {
  // `darkContrastLevel` is REQUIRED on every row, including the non-colour ones
  // that leave here immediately: it is a GATE, and a gate absent from half the
  // rows is one `visibility.record` cannot use — there is no presence operator
  // to test the absence with. `unmeasured` is the honest answer for a spacing
  // token, and it is an answer rather than a silence.
  if (!row.path.startsWith('color.')) return { darkContrastLevel: 'unmeasured' }
  return { ...lightHalf(row, ground), ...darkHalf(row, darkGround) }
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
