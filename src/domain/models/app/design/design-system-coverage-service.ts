/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The declaration ledger: which layers of the design system the operator
 * actually authored, and how many tokens each one carries.
 *
 * Its own module beside `design-system-facets-service.ts`, which holds the other four
 * reads. It is the one facet that answers a question about the CONFIG rather
 * than about the projected document — "the operator chose these" as distinct
 * from "the platform's defaults are showing" — and it is the one that has to
 * name every layer's authoring address by hand, so it carries a table the other
 * four do not.
 */

import {
  type LayerSummarise,
  countByGroup,
  declaredSplit,
  summariseColorRoles,
  summariseColorScheme,
  summariseComponentGuidance,
  summariseFonts,
  summariseImagery,
  summariseLogo,
  summariseMotion,
  summariseTypeScale,
  summariseTypesRestyled,
  summariseWritingRules,
  summariseZones,
} from './design-system-coverage-summary-service'
import { designTokenFacet, guidanceFacet, keysOf, sized } from './design-system-facets-service'
import type {
  DesignCoverageResponse,
  DesignCoverageRow,
  DesignCoverageState,
} from '@/domain/models/api/admin/design-system/facets'
import type { App } from '@/domain/models/app'

/**
 * Every layer of the system, with the reader's name for it and the address that
 * would declare it.
 *
 * `configPath` is published for every row, declared or not: a reader who wants
 * to CHANGE a declared layer needs the same address as one who wants to add it.
 * `label` is published rather than written in the page because a bound row
 * cannot interleave literal text between its fields, and the overview prints the
 * count and its subject as one phrase.
 *
 * `platformSupplied` says whether Sovrium answers this layer for an app that
 * never mentions it. It is a property of the LAYER and is written down here, per
 * row, rather than inferred at read time — see `coverageState` for what happens
 * when it is inferred instead. It is required rather than optional so that a new
 * layer cannot be added without someone deciding which half of the system owes
 * it a value.
 *
 * `summarise` is OPTIONAL, and its absence is a statement: `principles` carries
 * none because "four principles" is the whole fact about a set of sentences the
 * operator wrote. See {@link LayerSummarise}.
 */
const COVERAGE_LAYERS: readonly (Omit<
  DesignCoverageRow,
  'declared' | 'count' | 'state' | 'summary'
> & {
  readonly declaredAt: string
  readonly platformSupplied: boolean
  readonly summarise?: LayerSummarise
})[] = [
  {
    key: 'color-scheme',
    label: 'colours',
    configPath: 'design.colors',
    declaredAt: 'colors',
    platformSupplied: true,
    summarise: summariseColorScheme,
  },
  {
    key: 'type-scale',
    label: 'type steps',
    configPath: 'design.typeScale',
    declaredAt: 'typeScale',
    platformSupplied: true,
    summarise: summariseTypeScale,
  },
  {
    key: 'fonts',
    label: 'font families',
    configPath: 'design.typeScale.families',
    declaredAt: 'typeScale.families',
    platformSupplied: true,
    summarise: summariseFonts,
  },
  {
    key: 'spacing',
    label: 'spacing steps',
    configPath: 'design.spacing',
    declaredAt: 'spacing',
    platformSupplied: true,
    summarise: (app) => declaredSplit(app, 'spacing'),
  },
  {
    key: 'radius',
    label: 'radius steps',
    configPath: 'design.radius',
    declaredAt: 'radius',
    platformSupplied: true,
    summarise: (app) => declaredSplit(app, 'radius'),
  },
  {
    key: 'breakpoints',
    label: 'breakpoints',
    configPath: 'design.breakpoints',
    declaredAt: 'breakpoints',
    platformSupplied: true,
    summarise: (app) => declaredSplit(app, 'breakpoint'),
  },
  {
    key: 'elevation',
    label: 'elevation steps',
    configPath: 'design.elevation',
    declaredAt: 'elevation',
    platformSupplied: true,
    summarise: (app) => declaredSplit(app, 'shadow'),
  },
  {
    key: 'motion',
    label: 'motion tokens',
    configPath: 'design.motion',
    declaredAt: 'motion',
    platformSupplied: true,
    summarise: summariseMotion,
  },
  {
    key: 'principles',
    label: 'principles',
    configPath: 'design.principles',
    declaredAt: 'principles',
    platformSupplied: false,
  },
  {
    key: 'writing-rules',
    label: 'writing rules',
    configPath: 'design.voice',
    declaredAt: 'voice',
    platformSupplied: false,
    summarise: summariseWritingRules,
  },
  {
    key: 'color-roles',
    label: 'documented colour roles',
    configPath: 'design.colorRoles',
    declaredAt: 'colorRoles',
    platformSupplied: false,
    summarise: summariseColorRoles,
  },
  {
    key: 'component-guidance',
    label: 'documented components',
    configPath: 'components[].guidance',
    declaredAt: 'components',
    platformSupplied: false,
    summarise: summariseComponentGuidance,
  },
  {
    key: 'zones',
    label: 'zones',
    configPath: 'design.zones',
    declaredAt: 'zones',
    platformSupplied: false,
    summarise: summariseZones,
  },
  {
    key: 'logo',
    label: 'logo',
    configPath: 'design.logo',
    declaredAt: 'logo',
    platformSupplied: false,
    summarise: summariseLogo,
  },
  {
    key: 'imagery',
    label: 'imagery direction',
    configPath: 'design.imagery',
    declaredAt: 'imagery',
    platformSupplied: false,
    summarise: summariseImagery,
  },
  // ─── THE ONE LAYER WHOSE FIGURE IS A RATIO ───────────────────────────────
  //
  // `design.components` restyles the components the ENGINE draws, keyed by
  // component type. Its count alone is unreadable: "3" tells an operator
  // nothing without the catalogue it is 3 OF, which is why this layer's
  // summary carries a denominator where no other layer's does.
  //
  // That denominator is DERIVED from the live catalogue and must never be
  // authored (D7-3). A literal is wrong the day a type lands — and it already
  // was: the console reference draws "0 of 89 types restyled" against a
  // catalogue that publishes 87.
  {
    key: 'types-restyled',
    label: 'restyled component types',
    configPath: 'design.components',
    declaredAt: 'components',
    platformSupplied: false,
    summarise: summariseTypesRestyled,
  },
]

/**
 * How many entries each layer PUBLISHES, inherited ones included.
 *
 * Deliberately not the same number as `declared`: twelve colours ship whether or
 * not anyone chose them, so a single figure would make an untouched palette read
 * as a decision. Zero for a layer with no inherited half that nobody declared.
 */
const layerCounts = (app: App): Readonly<Record<string, number>> => {
  const design = (app.design ?? {}) as Readonly<Record<string, unknown>>
  const tokens = designTokenFacet(app).items
  const inGroup = (group: string): number => countByGroup(tokens, group)

  return {
    'color-scheme': inGroup('color'),
    'type-scale': inGroup('typography'),
    fonts: inGroup('font'),
    spacing: inGroup('spacing'),
    radius: inGroup('radius'),
    breakpoints: inGroup('breakpoint'),
    elevation: inGroup('shadow'),
    motion: inGroup('duration') + inGroup('easing'),
    principles: sized(design['principles']),
    'writing-rules': guidanceFacet(app).items.filter((r) => r.kind.startsWith('voice.')).length,
    'color-roles': keysOf(design['colorRoles']).length,
    'component-guidance': (app.components ?? []).filter((c) => c.guidance !== undefined).length,
    zones: sized(design['zones']),
    logo: design['logo'] === undefined ? 0 : 1,
    imagery: design['imagery'] === undefined ? 0 : 1,
    // The TYPES the operator restyled, not the class strings they wrote: one
    // type carrying four restyled parts is one decision about one component,
    // and counting the parts would report a single careful override as four.
    'types-restyled': keysOf(design['components']).length,
  }
}

/**
 * Whether the operator authored anything in each layer.
 *
 * A key's PRESENCE answers it for the prose layers, and a non-empty record
 * answers it for the token ones — the same question `declaredNamesOf` asks per
 * token, asked one level up. This is not derivable from the exported document at
 * all: that merges inherited defaults with authored values, which is the point
 * of it, so a reader of the export cannot tell "the operator chose these" from
 * "the platform's defaults are showing".
 */
const layerDeclarations = (app: App): Readonly<Record<string, boolean>> => {
  const declared = (app.design ?? {}) as Readonly<Record<string, unknown>>
  // `declaredAt` is a dotted PATH, not a key: the font-families layer sits one
  // level down at `typeScale.families`, beside the ladder of steps it sets, and
  // reading the parent instead would report families as declared for an app
  // that only ever wrote a step.
  const wrote = (at: string): boolean => {
    const value = at
      .split('.')
      .reduce<unknown>(
        (node, segment) =>
          node === null || typeof node !== 'object'
            ? undefined
            : (node as Readonly<Record<string, unknown>>)[segment],
        declared
      )
    if (value === undefined) return false
    return Array.isArray(value)
      ? value.length > 0
      : keysOf(value).length > 0 || typeof value !== 'object'
  }

  return Object.fromEntries(
    COVERAGE_LAYERS.map((layer) => [
      layer.key,
      // A palette is declared when EITHER scheme was written: a dark-only
      // declaration is still a decision about the app's colours.
      layer.key === 'color-scheme'
        ? wrote('colors') || keysOf(app.design?.darkColors).length > 0
        : layer.key === 'component-guidance'
          ? (app.components ?? []).some((component) => component.guidance !== undefined)
          : wrote(layer.declaredAt),
    ])
  )
}

/**
 * Where a layer's content came from, as the console's closed vocabulary.
 *
 * The tri-state exists because "not declared" is two different situations for a
 * reader: a layer nobody wrote that the platform still ANSWERS is the defaults
 * showing — a legitimate resting state — while one nothing answers is genuinely
 * empty. Collapsing them tells an operator to go and add twelve colours that
 * already ship.
 *
 * Whether the platform answers a layer is a property of the LAYER, so it is read
 * off `COVERAGE_LAYERS` rather than inferred from `count`. Inferring it was the
 * earlier shape and it was wrong in the direction that matters: `count` is what
 * the token facet PUBLISHES, and that facet publishes no inherited typography or
 * spacing steps, so an app declaring neither had two layers the platform
 * genuinely supplies reported back as gaps. Widening `count` to hide that would
 * cost more than it buys — the type-scale figure is the DECLARED step count and
 * zero is a real answer there, which is the whole point of publishing it beside
 * `declared` rather than instead of it.
 */
const coverageState = (declared: boolean, platformSupplied: boolean): DesignCoverageState =>
  declared ? 'declared' : platformSupplied ? 'inherited' : 'not-declared'

/** The declaration ledger, in the order the overview reads it. */
export const coverageFacet = (app: App, key?: string): DesignCoverageResponse => {
  const counts = layerCounts(app)
  const declarations = layerDeclarations(app)
  const rows: readonly DesignCoverageRow[] = COVERAGE_LAYERS.map(
    ({ declaredAt: _, platformSupplied, summarise, ...layer }) => {
      const declared = declarations[layer.key] === true
      return {
        ...layer,
        declared,
        count: counts[layer.key] ?? 0,
        state: coverageState(declared, platformSupplied),
        // A layer that declares no `summarise` says nothing, rather than
        // padding the row with a restatement of the two fields beside it.
        summary: summarise?.(app) ?? '',
      }
    }
  )

  const items = key === undefined ? rows : rows.filter((entry) => entry.key === key)
  // The three tallies ride beside the rows because the headline binds each one
  // through a dotted path and cannot count an array: a rows envelope renders a
  // template per row and has no way to aggregate them. Counted off `items` — the
  // rows actually returned — so a filtered read tallies what it published, and
  // so a tally can never disagree with the list under it.
  const counted = (state: DesignCoverageState): number =>
    items.filter((entry) => entry.state === state).length
  return {
    items,
    total: items.length,
    declared: items.filter((entry) => entry.declared).length,
    inherited: counted('inherited'),
    notDeclared: counted('not-declared'),
  }
}
