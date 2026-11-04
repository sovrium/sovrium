/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The code-only half of a token row: which colour token paints a syntax role,
 * and how that colour reads where a role is drawn — on the code block.
 *
 * A `code.*` row's `value` is the DTCG alias the document carries
 * (`{color.clay}`), which a config page can neither resolve nor cut. So the row
 * publishes the colour token it names as that token's own `path`, carries the
 * colour group's hex for it in each scheme (one projection, so the two groups
 * cannot disagree), and grades it on the code block rather than the page: the
 * design's `muted` in light and the fixed block chrome in dark, the grounds the
 * config rule measures when it refuses an illegible role.
 */

import {
  readCodeBlockContrast,
  type CodeBlockReading,
  type CodeTokenDesignInput,
} from './code-token-validation'
import type { FlatTokenRow } from '@/domain/models/api/admin/design-system/component-types'

/** The colour half of the colour token a role names, as the colour group projects it. */
export interface PaintedColour {
  readonly hex?: string
  readonly gamut?: 'srgb' | 'wide'
  readonly ink?: string
  readonly darkHex?: string
  readonly darkGamut?: 'srgb' | 'wide'
  readonly darkInk?: string
}

/** The patch a `code.*` row is spread with. */
export interface CodeRoleProjection extends PaintedColour {
  readonly token: string
  readonly contrastAgainst?: string
  readonly contrastRatio?: number
  readonly contrastLevel?: 'AAA' | 'AA' | 'fail'
  readonly darkContrastAgainst?: string
  readonly darkContrastRatio?: number
  readonly darkContrastLevel: 'AAA' | 'AA' | 'fail' | 'unmeasured'
}

/** The fields of a colour projection a code row carries: the colour, never its page grade. */
const PAINTED_FIELDS = ['hex', 'gamut', 'ink', 'darkHex', 'darkGamut', 'darkInk'] as const

/** Only the painted half of a colour projection. */
const paintedOnly = (colour: PaintedColour | undefined): PaintedColour =>
  Object.fromEntries(
    PAINTED_FIELDS.flatMap((field) =>
      colour?.[field] === undefined ? [] : [[field, colour[field]] as const]
    )
  )

/** The alias a code role's `$value` carries: `{color.<name>}`. */
const COLOR_ALIAS = /^\{color\.([^{}]+)\}$/

/** The WCAG grade of a ratio at normal text size, on `measureContrast`'s thresholds. */
const levelOf = (ratio: number): 'AAA' | 'AA' | 'fail' =>
  ratio >= 7 ? 'AAA' : ratio >= 4.5 ? 'AA' : 'fail'

/** One scheme's contrast fields, or none when the reading did not resolve. */
const graded = (reading: CodeBlockReading) =>
  reading.ratio === undefined
    ? undefined
    : { against: reading.ground, ratio: reading.ratio, level: levelOf(reading.ratio) }

/**
 * @param row - the token row; anything but a `code.*` row aliasing a colour answers `undefined`.
 * @param design - the app's design, whose `muted` is the light code block.
 * @param colourOf - the colour group's projection of a colour token, by its name.
 */
export const codeRoleProjection = (
  row: FlatTokenRow,
  design: CodeTokenDesignInput,
  colourOf: (name: string) => PaintedColour | undefined
): CodeRoleProjection | undefined => {
  if (!row.path.startsWith('code.')) return undefined
  const name = COLOR_ALIAS.exec(row.value)?.[1]
  if (name === undefined) return undefined
  // Measured under the name the author wrote, which keys `design.colors`; the
  // alias carries its canonical spelling.
  const declared = design.code?.tokens?.[row.path.slice('code.'.length)] ?? name
  const reading = readCodeBlockContrast(design, declared)
  const light = graded(reading.light)
  const dark = graded(reading.dark)
  return {
    token: `color.${name}`,
    ...paintedOnly(colourOf(name)),
    ...(light === undefined
      ? {}
      : { contrastAgainst: light.against, contrastRatio: light.ratio, contrastLevel: light.level }),
    ...(dark === undefined
      ? { darkContrastLevel: 'unmeasured' as const }
      : {
          darkContrastAgainst: dark.against,
          darkContrastRatio: dark.ratio,
          darkContrastLevel: dark.level,
        }),
  }
}
