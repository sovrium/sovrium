/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The flat projection of the design-token document: the DTCG tree the export
 * serves, as one row per token with whether the operator declared it.
 */

import type { FlatTokenRow } from '@/domain/models/api/admin/design-system/component-types'
import type { App } from '@/domain/models/app'

/**
 * The keys of a record-shaped value, and the empty set for anything else.
 *
 * Defensive on purpose, and for the reason `animationTokensOf` is: the LEGACY
 * flat form of `design.motion?.animations` puts arbitrary animation names beside
 * `duration` / `easing`, so the value at one of those keys may be a scalar —
 * and `Object.keys('ease')` would then report four positional "declared token
 * names" that no author ever wrote.
 */
export const keysOf = (record: unknown): ReadonlySet<string> =>
  typeof record === 'object' && record !== null && !Array.isArray(record)
    ? new Set(Object.keys(record as Readonly<Record<string, unknown>>))
    : new Set<string>()

/**
 * The token groups the DTCG document publishes, paired with the config record
 * that DECLARES them.
 *
 * The pairing is what makes `inherited` / `overridden` answerable at all: each
 * group is `{ ...platform defaults, ...what the author wrote }`, so a token is
 * the operator's exactly when its name is a key of the declaring record. This
 * is `projectShadows`' `provenance` field generalised — the same question, asked
 * of every group rather than only of the shadow ramp.
 *
 * `typography` has no inherited half at all (only declared steps are emitted),
 * which needs no special case: every emitted step is a declared key, so every
 * row comes out `overridden`, which is exactly true.
 */
const declaredNamesOf = (app: App): Readonly<Record<string, ReadonlySet<string>>> => {
  const { design } = app
  // Destructured rather than read through eight optional chains: each `?.` is a
  // branch, and one `?? {}` says the same thing once.
  const { colors, spacing, radius, breakpoints, typeScale, motion } = design ?? {}

  return {
    color: keysOf(colors),
    spacing: keysOf(spacing),
    radius: keysOf(radius),
    breakpoint: keysOf(breakpoints),
    font: keysOf(typeScale?.families),
    typography: keysOf(typeScale?.steps),
    duration: keysOf(motion?.durations),
    easing: keysOf(motion?.easings),
  }
}

/**
 * Which config path AUTHORS each published group.
 *
 * Read as the `locked` rule rather than as documentation: a group with no
 * authoring position is one config cannot change, so it is locked by
 * construction rather than by a hand-kept list that would go stale the moment a
 * group gained or lost a position. Every group has one today, so every row
 * comes out unlocked — a measured fact about this document, not a stub. The one
 * genuinely non-overridable layer of the design system is the component
 * accessibility FLOOR, and a floor is a class list rather than a token, so it
 * has no row here; it is reported by the provenance read, where `locked` is live.
 */
const AUTHORING_PATH: Readonly<Record<string, string>> = {
  color: 'design.colors',
  spacing: 'design.spacing',
  radius: 'design.radius',
  breakpoint: 'design.breakpoints',
  font: 'design.typeScale.families',
  typography: 'design.typeScale',
  duration: 'design.motion.durations',
  easing: 'design.motion.easings',
}

/**
 * A DTCG COLOUR composite, as CSS spells it.
 *
 * `hex` is carried verbatim whenever the authored value was hexadecimal, so it
 * is both the shortest true spelling and the one the author wrote. Anything else
 * is a pass-through space (`oklch`, `hsl`, …) whose components DTCG stores
 * unwrapped, and the function form is what a renderer applies.
 */
const stringifyColorValue = (value: Readonly<Record<string, unknown>>): string | undefined => {
  const { colorSpace, components, hex, alpha } = value
  if (typeof colorSpace !== 'string' || !Array.isArray(components)) return undefined
  if (typeof hex === 'string' && alpha === undefined) return hex
  const channels = components.join(' ')
  const opacity = typeof alpha === 'number' ? ` / ${alpha}` : ''
  return `${colorSpace === 'srgb' ? 'rgb' : colorSpace}(${channels}${opacity})`
}

/** A DTCG DIMENSION or DURATION composite — `{ value, unit }` — as CSS spells it. */
const stringifyMeasureValue = (value: Readonly<Record<string, unknown>>): string | undefined => {
  const { value: magnitude, unit } = value
  return typeof magnitude === 'number' && typeof unit === 'string'
    ? `${magnitude}${unit}`
    : undefined
}

/**
 * A token's `$value` as the table prints it.
 *
 * A DTCG value is a string for most groups, an ARRAY for a font stack and a
 * cubic-bezier, and an OBJECT for a colour, a dimension, a duration or a
 * typography composite. The table renders one cell, so each shape gets the
 * compact spelling a reader would write it in rather than a JSON dump with
 * quotes and braces they then have to strip.
 *
 * ─── THE TWO NAMED COMPOSITES ARE NOT DECORATION ───────────────────────────
 *
 * A colour and a dimension both have ONE canonical CSS spelling, and the generic
 * `key: value; …` fallback produces something no reader can use and no swatch
 * can paint: `colorSpace: srgb; components: 0.42, 0.5, 0.37; hex: #6b7f5e` for a
 * colour the author simply wrote as `#6b7f5e`, and `value: 0; unit: px` for
 * `0px`. The console's facet specs pin the colour half against the declared
 * constant, which is what makes the difference visible.
 *
 * The typography composite genuinely has no single CSS spelling — it is a
 * bundle of four properties — so it keeps the generic form, which is why that
 * branch stays rather than being replaced.
 *
 * ─── EXPORTED FOR ONE CALLER, AND THAT IS THE POINT ────────────────────────
 *
 * `typographyProjection` lifts `fontSize` out of that composite so a config
 * page can address it, and spends THIS function to spell it rather than a
 * second formatter of its own. Two formatters over one value is the drift the
 * flat halves exist to avoid: the row's `value` and its `fontSize` are read off
 * the same member, so they must be spelled by the same code or they can come to
 * disagree with nothing noticing.
 */
export const stringifyTokenValue = (value: unknown): string => {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return value.map((entry) => stringifyTokenValue(entry)).join(', ')
  if (typeof value === 'object' && value !== null) {
    const record = value as Readonly<Record<string, unknown>>
    return (
      stringifyColorValue(record) ??
      stringifyMeasureValue(record) ??
      Object.entries(record)
        .map(([key, entry]) => `${key}: ${stringifyTokenValue(entry)}`)
        .join('; ')
    )
  }
  return ''
}

/** A DTCG token, as far as the flattener reads it. */
type TokenNode = Readonly<{ $value?: unknown }>

/** Whether a document member is a token rather than a group of them. */
const isToken = (value: unknown): value is TokenNode =>
  typeof value === 'object' && value !== null && '$value' in value

/**
 * Every token of the document, flattened to rows addressed by dotted path.
 *
 * A PROJECTION, never a replacement: `GET /api/admin/design-system.json` serves
 * a DTCG document, whose nested shape is what a conformant consumer reads, and
 * this is emitted only behind `?flat=1`. A table cannot render a tree, and the
 * console's "Votre design" page IS a table — N inherited, M overridden.
 *
 * `$description`, `$extensions` and every other `$`-prefixed member are skipped:
 * they are document METADATA rather than tokens, and a row for `$description`
 * would put the document's own sentence in the palette table.
 *
 * @param document - The DTCG document `buildDesignSystem(app)` produced.
 * @param app - The same app, read for which names the operator declared.
 * @returns One row per token, in document order.
 */
export const flattenDesignTokens = (
  document: Readonly<Record<string, unknown>>,
  app: App
): readonly FlatTokenRow[] => {
  const declared = declaredNamesOf(app)

  return Object.entries(document).flatMap(([group, members]) => {
    if (group.startsWith('$') || typeof members !== 'object' || members === null) return []
    const declaredHere = declared[group] ?? new Set<string>()
    const locked = !(group in AUTHORING_PATH)

    return Object.entries(members as Record<string, unknown>).flatMap(([name, token]) => {
      if (!isToken(token)) return []
      const overridden = declaredHere.has(name)
      return [
        {
          path: `${group}.${name}`,
          value: stringifyTokenValue(token.$value),
          inherited: !overridden,
          overridden,
          locked,
        },
      ]
    })
  })
}
