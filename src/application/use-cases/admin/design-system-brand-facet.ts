/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Everything the Brand page reads, and nothing else.
 *
 * Its own module rather than a section of `design-system-facets.ts` because
 * that file crossed the 400-line cap the moment the mark arrived — but the
 * split is not arbitrary bookkeeping. These three projections answer ONE
 * question ("what is this app's identity, and where is it declared?") and they
 * split the answer along a line worth stating once:
 *
 *  - The mark's GEOMETRY and its renderings are FACTS a sentence cannot carry.
 *    "Leave the height of the mark around it" is obeyed differently by everyone
 *    who reads it, and the number of panels depends on which files exist. Those
 *    go on the brand facet, as rows.
 *  - The misuse rules and the imagery rules ARE sentences, so they go to the
 *    GUIDANCE facet beside every other declared sentence — one page filter
 *    reaches all of them, and the instruction/reason split and the ordinal come
 *    for free.
 *
 * @see src/domain/models/api/admin/design-system/facets.ts
 */

import { ZONE_OVERRIDABLE_VOICE_FIELDS } from '@/domain/models/app/design/zones'
import type {
  BrandFacetResponse,
  BrandMarkFact,
  BrandMarkRendering,
  DesignZoneRow,
  DesignZonesResponse,
  GuidanceKind,
} from '@/domain/models/api/admin/design-system/facets'
import type { App } from '@/domain/models/app'

/** One declared sentence, before the instruction/reason split. */
interface DeclaredLine {
  readonly kind: GuidanceKind
  readonly path: string
  readonly label: string
  readonly line: string
  readonly verdict?: 'prefer' | 'never'
}

/**
 * Whether a declared imagery line REFUSES something.
 *
 * Read off the OPENING of the line rather than by searching it for a negation
 * anywhere: `apps/website`'s own "Show the product working, never a metaphor
 * for it." is a PREFERENCE that happens to contain the word, and classifying it
 * as a refusal would file the app's most-quoted rule under the wrong heading.
 *
 * The vocabulary is `prefer` / `never` because a page stamps the value VERBATIM
 * into `data-design-imagery-verdict`, which is what the shipped attribute
 * already carries (`[internal ref]` asserts both literals).
 *
 * It was DUPLICATED, knowingly, from an identical `isRefusal` in the Brand page
 * BUILDER, which this projection could not import from. That builder is gone —
 * the Brand page is a row template over this endpoint now — so the duplicate
 * collapsed onto this one and there is no second copy to keep in step.
 */
const REFUSAL_OPENERS = ['no ', 'never ', 'avoid ', "don't ", 'do not ', 'not ']

const verdictOf = (line: string): 'prefer' | 'never' => {
  const opening = line.trimStart().toLowerCase()
  return REFUSAL_OPENERS.some((opener) => opening.startsWith(opener)) ? 'never' : 'prefer'
}

/**
 * What images are for here, and which ones this app refuses.
 *
 * FLATTENED across the four source keys, each keeping its own kind, because
 * `design.imagery` groups by WHERE a rule was declared while a reader wants
 * them by what they are about. The Brand page shows them as one list and can
 * still filter to `imagery.photography` alone.
 *
 * `iconSet` is a single string rather than an array, and is addressed WITHOUT
 * an index for that reason: `design.imagery.iconSet[0]` would name a position
 * that does not exist, and the ordinal derivation would then disagree with the
 * address it is supposed to agree with.
 */
export const imageryLines = (
  design: Readonly<Record<string, unknown>>
): readonly DeclaredLine[] => {
  const imagery = design['imagery'] as Readonly<Record<string, unknown>> | undefined
  if (imagery === undefined) return []

  const list = (key: 'principles' | 'photography' | 'patterns'): readonly DeclaredLine[] =>
    (Array.isArray(imagery[key]) ? (imagery[key] as readonly unknown[]) : []).flatMap(
      (entry, index) =>
        typeof entry === 'string'
          ? [
              {
                kind: `imagery.${key}` as GuidanceKind,
                path: `design.imagery.${key}[${index}]`,
                label: '',
                line: entry,
                verdict: verdictOf(entry),
              },
            ]
          : []
    )

  const { iconSet } = imagery
  return [
    ...(typeof iconSet === 'string'
      ? [
          {
            kind: 'imagery.iconSet' as GuidanceKind,
            path: 'design.imagery.iconSet',
            label: '',
            line: iconSet,
            verdict: verdictOf(iconSet),
          },
        ]
      : []),
    ...list('principles'),
    ...list('photography'),
    ...list('patterns'),
  ]
}

/**
 * What must never be done to the mark.
 *
 * These are SENTENCES, so they belong beside every other declared sentence
 * rather than on the brand facet — one page filter reaches all of them, and the
 * instruction/reason split and the ordinal come for free. The mark's GEOMETRY
 * goes the other way, onto the brand facet: "leave the height of the mark
 * around it" is obeyed differently by everyone who reads it.
 */
export const markMisuseLines = (
  design: Readonly<Record<string, unknown>>
): readonly DeclaredLine[] => {
  const logo = design['logo'] as Readonly<Record<string, unknown>> | undefined
  const misuse = logo?.['misuse']
  return (Array.isArray(misuse) ? (misuse as readonly unknown[]) : []).flatMap((entry, index) =>
    typeof entry === 'string'
      ? [
          {
            kind: 'logo.misuse' as GuidanceKind,
            path: `design.logo.misuse[${index}]`,
            label: '',
            line: entry,
          },
        ]
      : []
  )
}

// ---------------------------------------------------------------------------
// The mark, as rows a page can draw
// ---------------------------------------------------------------------------

/** The address that declares the mark — published declared or not. */
const LOGO_CONFIG_PATH = 'design.logo'

/**
 * The three facts a mark declaration carries, in `design.logo` declaration
 * order.
 *
 * Order is taken from the schema rather than chosen, so a reader comparing the
 * panel against their own config finds the rows where they wrote them — and
 * nobody has to defend a hand-picked reading order that the next fact would
 * reopen.
 */
const MARK_FACT_KEYS = ['alt', 'clearSpace', 'minWidth'] as const

/**
 * The declared mark: its renderings as rows, its geometry beside them.
 *
 * ─── ROWS, BECAUSE THE COUNT IS NOT FIXED ──────────────────────────────────
 *
 * The page draws the light-ink file on the app's own ground and the dark-ink
 * one on the inverse, and the second exists only when `srcDark` is declared. A
 * fixed two-panel layout would draw an empty frame for the common case; a row
 * template cannot count. So the renderings are enumerated here and an app that
 * declares only `src` gets exactly one row.
 *
 * ─── AND NEVER A 404 ───────────────────────────────────────────────────────
 *
 * An app with no `design.logo` gets zero rows, `declared: false` and the worked
 * example state — the same shape every sibling facet answers an empty question
 * with. `facts.configPath` is published in that case too, because "declare
 * `design.logo`" is the actionable half of the empty state and the page has
 * nowhere else to read the address from.
 *
 * Order is light before dark, matching the panels the console already draws:
 * the light file is the mark, and the dark one is its counterpart.
 */
export const brandFacet = (app: App): BrandFacetResponse => {
  const design = (app.design ?? {}) as Readonly<Record<string, unknown>>
  const logo = design['logo'] as Readonly<Record<string, unknown>> | undefined
  const stringAt = (key: string): string | undefined =>
    typeof logo?.[key] === 'string' ? (logo[key] as string) : undefined

  const src = stringAt('src')
  const srcDark = stringAt('srcDark')
  // The accessible name rides on EVERY rendering as well as on its own `facts`
  // row: an `img` needs its own `alt`, a row template binds one rows source, and
  // nothing in config joins two arrays of one body.
  //
  // `LogoSchema.alt` is REQUIRED, so a declared mark has necessarily been named
  // and this is a string on every row a mark produces. The `?? ''` is the
  // unreachable arm of a `Readonly<Record<string, unknown>>` read, not a default
  // anyone can hit: reaching it would need a `design.logo` with a `src` and no
  // `alt`, which the config schema refuses at boot.
  const alt = stringAt('alt') ?? ''
  const items: readonly BrandMarkRendering[] = [
    ...(src === undefined
      ? []
      : [
          {
            variant: 'light' as const,
            src,
            configPath: `${LOGO_CONFIG_PATH}.src`,
            ground: 'background' as const,
            alt,
          },
        ]),
    ...(srcDark === undefined
      ? []
      : [
          {
            variant: 'dark' as const,
            src: srcDark,
            configPath: `${LOGO_CONFIG_PATH}.srcDark`,
            ground: 'foreground' as const,
            alt,
          },
        ]),
  ]

  const declared = items.length > 0

  // In `design.logo` declaration order, ALWAYS all three. A row whose fact is
  // not declared carries no `value` and `declared: false` — filtering it out
  // would make the panel's row count depend on what happens to be declared, and
  // would leave "not declared" indistinguishable from "this fact does not
  // exist".
  const facts: readonly BrandMarkFact[] = MARK_FACT_KEYS.map((key) => {
    const value = stringAt(key)
    return {
      key,
      ...(value === undefined ? {} : { value }),
      configPath: `${LOGO_CONFIG_PATH}.${key}`,
      declared: value !== undefined,
    }
  })

  return {
    items,
    total: items.length,
    declared,
    state: declared ? 'config' : 'example',
    facts,
  }
}

/**
 * The declared zones, as rows.
 *
 * The last Brand block with no read. `design.zones[]` is an array of objects
 * with a `voice` override nested one level below, so a page binding it could
 * reach the pattern and the zone name but not say which budget the zone carries
 * — `accentBudget` is OPTIONAL in config, and applying its fallback is an `if`.
 *
 * So the budget is published RESOLVED, with the fail-closed default `Brand Zone
 * Drift` already enforces: a zone declaring none is `product`. Publishing the
 * declared value instead would hand the page the same problem it came with.
 *
 * The voice override is a BOOLEAN, not the override itself. Those sentences are
 * already rows on the guidance facet under `zone.voice.*`, and publishing them
 * twice would let the two drift — the same reason the mark's misuse rules are
 * there and not on the brand facet.
 */
export const zonesFacet = (app: App): DesignZonesResponse => {
  const design = (app.design ?? {}) as Readonly<Record<string, unknown>>
  const declared = Array.isArray(design['zones']) ? (design['zones'] as readonly unknown[]) : []
  // The app voice is read ONCE, outside the walk: the inherited set is the same
  // join for every zone, and re-deriving it per row would let two rows of one
  // response disagree about what the app declares.
  const appVoiceFields = declaredVoiceFields(design['voice'])

  const items: readonly DesignZoneRow[] = declared.flatMap((entry) => {
    if (typeof entry !== 'object' || entry === null) return []
    const zone = entry as {
      readonly pattern?: unknown
      readonly zone?: unknown
      readonly accentBudget?: unknown
      readonly voice?: unknown
    }
    if (typeof zone.pattern !== 'string' || typeof zone.zone !== 'string') return []
    const overridden = declaredVoiceFields(zone.voice)
    // Declared by the APP and not named by this ZONE. See the contract for why
    // it is the intersection rather than the complement, and why `personality`
    // is not a candidate at all.
    const inherited = appVoiceFields
      .filter((name) => !overridden.includes(name))
      .map((name) => ({ name }))
    return [
      {
        pattern: zone.pattern,
        zone: zone.zone,
        accentBudget: zone.accentBudget === 'public' ? ('public' as const) : ('product' as const),
        hasVoiceOverride: typeof zone.voice === 'object' && zone.voice !== null,
        inherited,
        inheritedCount: inherited.length,
      },
    ]
  })

  return { items, total: items.length }
}

/**
 * The overridable voice fields a `voice` object actually declares.
 *
 * Read against {@link ZONE_OVERRIDABLE_VOICE_FIELDS} rather than against the
 * object's own keys, in that order, so the result is the SCHEMA's declaration
 * order for both sides of the join — an app and a zone that happened to be
 * authored with their keys in different orders must not produce two different
 * readings of the same inheritance.
 *
 * A key present but `undefined` counts as UNDECLARED: that is what an optional
 * field decodes to when omitted, and a zone cannot inherit a field the app
 * carries no value for.
 */
const declaredVoiceFields = (voice: unknown): readonly string[] => {
  if (typeof voice !== 'object' || voice === null) return []
  const record = voice as Readonly<Record<string, unknown>>
  return ZONE_OVERRIDABLE_VOICE_FIELDS.filter((name) => record[name] !== undefined)
}
