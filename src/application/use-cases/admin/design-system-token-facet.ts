/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The token reads of the design-system facets: every resolved token by group,
 * with its colour and typography projections, and the platform type ladder.
 * Split from `design-system-facets.ts`, which re-exports both.
 */

import { SOVRIUM_EXTENSION_KEY } from '@/domain/models/api/admin/design-system'
import { resolveDarkPaints } from '@/domain/models/app/design/dark-palette-service'
import {
  INHERITED_COLOR_TOKENS,
  PLATFORM_TYPE_LADDER,
  canonicalColorName,
  colorGroundOf,
} from '@/domain/models/app/design/inherited-tokens'
import { buildDesignSystem } from './design-system'
import {
  colourProjection,
  darkPaintOf,
  leafOf,
  type ContrastGround,
  discardedDeclarations,
  typographyProjection,
} from './design-system-token-projection'
import { flattenDesignTokens } from './design-system-token-rows'
import type { FlatTokenRow } from '@/domain/models/api/admin/design-system/component-types'
import type {
  DesignTokenFacetResponse,
  TypeLadderResponse,
} from '@/domain/models/api/admin/design-system/facets'
import type { App } from '@/domain/models/app'
import type { Design } from '@/domain/models/app/design'

// ---------------------------------------------------------------------------
// The resolved tokens, by group, with counts
// ---------------------------------------------------------------------------

/**
 * The elevation ramp, as token rows.
 *
 * The one place the facet read's row SET differs from `?flat=1`'s, and it is
 * deliberate: the ramp is published under `$extensions.shadows` rather than as a
 * DTCG group, and the flat projection skips every `$`-prefixed member so that
 * `$description` does not land in the palette table. Foundations draws elevation
 * beside spacing and radius, so a token table omitting it would under-report the
 * system the page documents.
 *
 * No second derivation is needed to fill `inherited` / `overridden`: the ramp
 * already carries a per-step `provenance`, which is the same question under
 * another name, and it is the only group whose provenance the document itself
 * publishes.
 */
const shadowRows = (document: Readonly<Record<string, unknown>>): readonly FlatTokenRow[] => {
  const extensions = document['$extensions'] as
    Readonly<Record<string, Readonly<Record<string, unknown>>>> | undefined
  const shadows = extensions?.[SOVRIUM_EXTENSION_KEY]?.['shadows']
  if (typeof shadows !== 'object' || shadows === null) return []

  return Object.entries(shadows as Readonly<Record<string, unknown>>).flatMap(([name, step]) => {
    if (typeof step !== 'object' || step === null) return []
    const { value, provenance } = step as {
      readonly value?: unknown
      readonly provenance?: unknown
    }
    const overridden = provenance === 'declared'
    return typeof value === 'string'
      ? [
          {
            path: `shadow.${name}`,
            value,
            inherited: !overridden,
            overridden,
            // `design.elevation` is a real authoring position, so the ramp
            // is no more locked than the palette is.
            locked: false,
          },
        ]
      : []
  })
}

/**
 * A token's dark counterpart, when the operator declared one.
 *
 * ABSENT — never a copy of `value` — when they declared none. Foundations prints
 * the value a swatch PAINTS, and under `?scheme=dark` that value is
 * `design.darkColors`, which the light document does not carry; so a
 * swatch reading only the document paints one colour and prints another. Echoing
 * the light value instead would be indistinguishable from "the operator chose
 * the same colour twice", and the console's dark disclosure turns on exactly
 * that difference.
 */
const withDarkCounterpart = (
  rows: readonly FlatTokenRow[],
  design: Design | undefined
): readonly FlatTokenRow[] => {
  const dark = Object.fromEntries(
    Object.entries((design?.darkColors ?? {}) as Readonly<Record<string, unknown>>).map(
      ([key, value]) => [canonicalColorName(key), value] as const
    )
  )
  return rows.map((row) => {
    const name = row.path.startsWith('color.') ? row.path.slice('color.'.length) : undefined
    const counterpart = name === undefined ? undefined : dark[name]
    return typeof counterpart === 'string' ? { ...row, dark: counterpart } : row
  })
}

/**
 * What every colour paints in dark, and who chose it — the shared cascade the
 * stylesheet's dark block and the exported dark document are written from.
 */
const darkPaintsOf = (design: Design | undefined) =>
  resolveDarkPaints(Object.keys(INHERITED_COLOR_TOKENS), design?.colors, design?.darkColors)

/**
 * The resolved tokens, filtered by group, with the counts the headline prints.
 *
 * `summary` describes the rows THIS response carries, filter included: a summary
 * that silently counted the unfiltered document would print the whole system's
 * totals beside six colour rows, and no reader could tell which number they were
 * looking at.
 *
 * An UNKNOWN group returns zero rows rather than a 404 — "no tokens in that
 * group" is the truthful answer, and a 404 would let a caller enumerate which
 * groups exist by probing.
 */
/**
 * The platform type ladder — what Tailwind's own `text-*` utilities resolve to.
 *
 * Takes no `app`, and that is the contract rather than an omission: the ladder
 * belongs to the engine's stylesheet, so two instances on one build answer
 * identically. It is what makes the rows safe to publish beside a disclosure
 * saying the operator declared no `design.typeScale` — they cannot be mistaken
 * for a declaration, because they do not depend on one.
 *
 * `PLATFORM_TYPE_LADDER` is a generated table of `[utility, sizePx, leadingPx]`
 * triples, and the projection splits the utility into the addressable `step` a
 * page stamps: a config page cannot split a string, so `text-2xl` and `2xl` are
 * two published facts rather than one field and a substring operation.
 */
export const typeLadderFacet = (): TypeLadderResponse => {
  const items = PLATFORM_TYPE_LADDER.map(([utility, sizePx, leadingPx]) => ({
    step: utility.startsWith('text-') ? utility.slice('text-'.length) : utility,
    utility,
    sizePx,
    leadingPx,
  }))
  return { items, total: items.length }
}

export const designTokenFacet = (app: App, group?: string): DesignTokenFacetResponse => {
  const document = buildDesignSystem(app) as Readonly<Record<string, unknown>>
  const { design } = app
  const every = [
    ...withDarkCounterpart(flattenDesignTokens(document, app), design),
    ...shadowRows(document),
  ]
  const filtered = group === undefined ? every : every.filter((r) => r.path.startsWith(`${group}.`))
  // The token's own name, without its group. A page cannot split a string, so a
  // per-token testid or anchor needs the leaf published rather than derivable.
  //
  // The colour projection rides on the same pass: a hex conversion is an Oklab
  // matrix multiply and a contrast ratio is a luminance computation, neither of
  // which a config page has any arithmetic for. Each colour is measured on its
  // own GROUND (`colorGroundOf`: a `*-foreground` on its surface, the rest on
  // `background`), resolved from the UNFILTERED set so `?group=color` measures
  // against the same colours the unfiltered read does, in both schemes.
  const paints = darkPaintsOf(design)
  const painted = new Map(
    every.flatMap((row) => {
      const paint = darkPaintOf(row, paints)
      return row.path.startsWith('color.') ? [[leafOf(row), { row, paint }] as const] : []
    })
  )
  const groundIn = (name: string, scheme: 'light' | 'dark'): ContrastGround | undefined => {
    const entry = painted.get(name)
    const value = scheme === 'light' ? entry?.row.value : entry?.paint?.darkValue
    return value === undefined ? undefined : { name, value }
  }
  const items = filtered.map((row) => {
    const leaf = leafOf(row)
    const paint = darkPaintOf(row, paints)
    const ground = colorGroundOf(leaf)
    return {
      ...row,
      leaf,
      ...(paint ?? {}),
      ...colourProjection(
        row,
        { light: groundIn(ground, 'light'), dark: groundIn(ground, 'dark') },
        paint?.darkValue
      ),
      // The typography half rides on the same pass, for the reason the colour one
      // does: a `typography.*` token's `$value` is a composite, `value` renders it
      // as `key: value; …`, and a config page can neither cut that string nor walk
      // into it — `$record.<field>` admits no dots. Reads the DOCUMENT rather than
      // the config so the lifted members and `value` are spelled by one serialiser.
      ...typographyProjection(row, document),
    }
  })

  return {
    items,
    total: items.length,
    summary: {
      total: items.length,
      inherited: items.filter((row) => row.inherited).length,
      overridden: items.filter((row) => row.overridden).length,
      locked: items.filter((row) => row.locked).length,
      // The app-level fact no row can carry: a row's own `dark` is absent both
      // when no dark palette was declared and when one was declared that skips
      // this token, and those are different facts.
      darkDeclared: Object.keys(design?.darkColors ?? {}).length > 0,
    },
    // Never narrowed by `group` — a discarded declaration has no token group to
    // belong to, which is what being discarded means.
    discarded: discardedDeclarations(document),
  }
}
