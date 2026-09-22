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
 * Its own module beside `design-system-facets.ts`, which holds the other four
 * reads. It is the one facet that answers a question about the CONFIG rather
 * than about the projected document — "the operator chose these" as distinct
 * from "the platform's defaults are showing" — and it is the one that has to
 * name every layer's authoring address by hand, so it carries a table the other
 * four do not.
 */

import {
  CATALOG_COMPONENT_CATEGORIES,
  catalogedTypesOf,
} from '@/domain/models/app/pages/components/component-types/catalog'
import { designTokenFacet, guidanceFacet, keysOf, sized } from './design-system-facets'
import type {
  DesignCoverageResponse,
  DesignCoverageRow,
  DesignCoverageState,
} from '@/domain/models/api/admin/design-system/facets'
import type { App } from '@/domain/models/app'

/**
 * A layer's human value, computed from the running config.
 *
 * Declared as a FUNCTION on the layer rather than a string, because the value
 * is a fact about this app and not about the layer: "21 roles, neutral ramp"
 * is true of one operator's palette and false of the next. A per-layer string
 * would be a constant pretending to be an answer.
 *
 * Omitting it is legal and means the empty string — a layer with nothing to
 * characterise beyond its count says nothing rather than padding.
 */
type LayerSummarise = (app: App) => string

/**
 * The one separator every summary joins its parts with.
 *
 * A constant rather than six literals: the rows are read as one column, so the
 * separator is a property of the COLUMN and changing it has to be one edit.
 */
const SEPARATOR = ' · '

/** Joins the non-empty parts of a summary in the one separator these rows use. */
const parts = (...values: readonly (string | false | undefined)[]): string =>
  values
    .filter((value): value is string => typeof value === 'string' && value !== '')
    .join(SEPARATOR)

/**
 * Which registers of a `kind`-prefixed guidance family were written, and how
 * many lines each carries, in the family's own declared order.
 *
 * The two guidance layers ask the identical question of the identical walk and
 * differ only in their prefix and their register vocabulary: the writing
 * charter reads `voice.*` against {@link VOICE_REGISTERS}, the component
 * library reads `component.*` against {@link COMPONENT_REGISTERS}. They were
 * written twice, down to one spelling its count `${written}` and the other
 * `${String(lines)}` for the same integer — the shape a second family would
 * have been copied from a third time.
 *
 * Counted off the SAME guidance walk that produced the layer's `count`, so the
 * parts always sum to the whole. A register nobody wrote is OMITTED rather than
 * printed as a zero: the row says which questions the documentation answers,
 * and naming the absences is the count's job beside it, not this one's.
 */
const registerTally = (app: App, prefix: string, registers: readonly string[]): string => {
  const written = guidanceFacet(app)
    .items.filter((row) => row.kind.startsWith(`${prefix}.`))
    .map((row) => row.kind.slice(prefix.length + 1))
  return parts(
    ...registers.map((register) => {
      const lines = written.filter((kind) => kind === register).length
      return lines === 0 ? '' : `${String(lines)} ${register}`
    })
  )
}

/**
 * How many tokens of a group a single token walk holds.
 *
 * Takes the walked ROWS rather than the app, so a caller needing several groups
 * pays for one {@link designTokenFacet} — which rebuilds the design document and
 * runs a colour projection per token, and is not a walk to repeat per group.
 */
const countByGroup = (tokens: readonly { readonly path: string }[], group: string): number =>
  tokens.filter((row) => row.path.startsWith(`${group}.`)).length

/**
 * The two halves of a palette, which a single count merges and cannot separate.
 *
 * `count` is every colour token the app publishes, light and dark alike, so an
 * operator reading it cannot tell a palette that answers both schemes from one
 * that answers only the light half — and the dark half is the expensive one to
 * discover missing. The two figures are read straight off the config rather
 * than off the token facet because the question is what the OPERATOR wrote:
 * a dark counterpart the platform supplies is not a decision about this app.
 *
 * Silent for an app that declared neither, which is the resting state where the
 * defaults are showing and there is nothing about this palette to characterise.
 */
const summariseColorScheme = (app: App): string => {
  const light = keysOf(app.design?.colors).length
  const dark = keysOf(app.design?.darkColors).length
  if (light === 0 && dark === 0) return ''
  if (dark === 0) return `${light} declared, light only`
  return light === 0 ? `${dark} declared, dark only` : parts(`${light} light`, `${dark} dark`)
}

/**
 * The registers a charter is written in, in the order the config declares them.
 *
 * A voice is not a flat list of sentences and the count reads as though it
 * were: fifteen rules split twelve-to-three between what to prefer and what to
 * avoid is a different charter from one split three-to-twelve, and the integer
 * is identical for both. The registers are what tell them apart.
 */
const VOICE_REGISTERS = ['personality', 'pronoun', 'prefer', 'avoid', 'tone'] as const

/**
 * The charter's shape, split by register.
 *
 * Counted off the SAME guidance walk that produced this layer's `count`, so the
 * parts always sum to the whole — a second traversal could disagree with the
 * figure sitting beside it the first time a register is added.
 */
const summariseWritingRules = (app: App): string => registerTally(app, 'voice', VOICE_REGISTERS)

/**
 * How many component types the engine publishes — the denominator, never a
 * literal.
 *
 * The same walk `GET /api/admin/schema/component-types` counts its `total`
 * with, so the ratio and the catalogue can never disagree. Written down once as
 * a number, it is wrong the day a type lands: the console reference drew
 * "0 of 89 types restyled" against a catalogue that published 87, and had been
 * wrong since it was drawn.
 */
const cataloguedTypeCount = (): number =>
  CATALOG_COMPONENT_CATEGORIES.reduce(
    (total, category) => total + catalogedTypesOf(category).length,
    0
  )

/**
 * The one layer whose figure is a ratio.
 *
 * Every other layer answers "how many of this did you declare", where the count
 * stands alone. This one answers "how much of the catalogue did you restyle",
 * and a bare count cannot: "3" is unreadable without the number it is 3 of.
 *
 * Emitted whether or not anything was restyled, because a zero numerator is a
 * real answer here — it says the engine draws itself, which is a resting state
 * an operator wants confirmed rather than left blank.
 */
const summariseTypesRestyled = (app: App): string =>
  `${keysOf(app.design?.components).length} of ${cataloguedTypeCount()} types restyled`

// ─── THE REMAINING LAYERS ──────────────────────────────────────────────────
//
// Each one below answers the question its own `count` cannot. The three above
// show the three shapes that answer is allowed to take — a SPLIT (light/dark),
// a SHAPE (which registers a charter is written in) and a RATIO (restyled of
// catalogued) — and every summary here is one of those three. None of them is
// editorial: they publish what the config says, never a reading of it.
//
// The default is that a declared layer characterises itself. `principles` is
// the sole exception and it carries no `summarise`, because "four principles"
// is the whole fact about a set of sentences the operator wrote, and saying
// more would be the console paraphrasing an operator's words back at them.

/** `N thing` / `N things`, for the many summaries that count a sub-shape. */
const plural = (n: number, singular: string, pluralForm = `${singular}s`): string =>
  `${n} ${n === 1 ? singular : pluralForm}`

/**
 * How much of a token group the operator CHOSE, against how much they inherited.
 *
 * The generic second fact for a ladder, and the one `count` is documented as
 * unable to carry: it merges declared and inherited deliberately, so that an
 * untouched ladder does not read as a decision. That merge is what makes the
 * split worth publishing — "18 steps" is the same figure for a ladder someone
 * tuned and one nobody has touched.
 */
const declaredSplit = (app: App, ...groups: readonly string[]): string => {
  const rows = designTokenFacet(app).items.filter((row) =>
    groups.some((group) => row.path.startsWith(`${group}.`))
  )
  if (rows.length === 0) return ''
  const declared = rows.filter((row) => !row.inherited).length
  if (declared === 0) return `all ${String(rows.length)} inherited`
  if (declared === rows.length) return `all ${String(declared)} declared`
  return `${String(declared)} declared · ${String(rows.length - declared)} inherited`
}

/**
 * Which rungs of the ladder an author wrote, by name.
 *
 * The twelve steps are a NAMED ladder rather than an open record, so which of
 * them a config reaches for is the fact about its typography: a scale that
 * declares `display` and `caption` is a different decision from one declaring
 * `body` alone, and both are "2 steps".
 *
 * Falls back to the declared/inherited split for a `typeScale` that declares
 * something other than steps — a base and a ratio are a declaration, and a
 * layer an operator touched must not answer with silence.
 */
const summariseTypeScale = (app: App): string => {
  const steps = keysOf(app.design?.typeScale?.steps)
  return steps.length === 0 ? declaredSplit(app, 'typography') : steps.join(', ')
}

/**
 * The families themselves, because their NAMES are the fact here.
 *
 * A count of font tokens says nothing an operator wants: whether the app is set
 * in Inter or in a serif is the whole question, and it is one word.
 */
const summariseFonts = (app: App): string => {
  const families = app.design?.typeScale?.families ?? {}
  // A plain join, NOT `parts`: `family` is a bare `Schema.String`, so an empty
  // one is legal, and `parts` would drop it where this has always rendered it.
  // Only the separator is shared here — the filtering is not wanted.
  return Object.values(families as Readonly<Record<string, { readonly family?: string }>>)
    .flatMap((entry) => (typeof entry?.family === 'string' ? [entry.family] : []))
    .join(SEPARATOR)
}

/**
 * The two halves of the motion layer, which its count adds together.
 *
 * `count` is durations PLUS easings, so it cannot distinguish an app that timed
 * its transitions from one that shaped their curves — the same merge problem
 * the palette has between its light and dark halves.
 */
const summariseMotion = (app: App): string => {
  const tokens = designTokenFacet(app).items
  const durations = countByGroup(tokens, 'duration')
  const easings = countByGroup(tokens, 'easing')
  return parts(
    durations > 0 && plural(durations, 'duration'),
    easings > 0 && plural(easings, 'easing')
  )
}

/**
 * How many documented roles name the token they are meant to sit AGAINST.
 *
 * `pairsWith` is what carries the contrast guarantee — a role documented
 * without its companion leaves the reader to re-measure the ratio themselves —
 * so how much of the register is paired is the fact behind the count.
 */
const summariseColorRoles = (app: App): string => {
  const roles = guidanceFacet(app).items.filter((row) => row.kind === 'colorRole')
  if (roles.length === 0) return ''
  const paired = roles.filter((row) => row.pairsWith !== undefined).length
  return paired === 0 ? 'none paired with a companion' : `${String(paired)} paired`
}

/** The three registers a component template is documented in, as declared. */
const COMPONENT_REGISTERS = ['usage', 'when', 'dont'] as const

/**
 * Which questions the documented components actually answer.
 *
 * The count is components, and a component documented in one register reads the
 * same as one documented in three. Which registers are written is what says
 * whether the library tells a reader when NOT to reach for something.
 */
const summariseComponentGuidance = (app: App): string =>
  registerTally(app, 'component', COMPONENT_REGISTERS)

/**
 * How the zones split across the two accent budgets, and how many rewrite voice.
 *
 * A zone's budget is the decision it exists to carry — a public zone spends
 * accent where a product zone does not — and the count merges the two. The
 * voice half is published beside it because a zone that overrides the charter
 * is a second charter, which a reader of "six zones" would never suspect.
 *
 * Falls back to the zone NAMES for a map that declares neither. Both fields are
 * optional, so a map of bare `{ pattern, zone }` entries characterised itself as
 * nothing at all — the silence this row exists to break. Which kinds of surface
 * an app has named is the fact every zone carries: a map of `marketing` and
 * `product` and one of `auth` alone are different zone maps, and the integer
 * beside them can be the same. Distinct and in declaration order, because a
 * zone governing four patterns is one kind of surface and not four.
 */
const summariseZones = (app: App): string => {
  const zones = app.design?.zones ?? []
  if (zones.length === 0) return ''
  const withBudget = (budget: string): number =>
    zones.filter((zone) => zone.accentBudget === budget).length
  const revoiced = zones.filter((zone) => zone.voice !== undefined).length
  const posture = parts(
    withBudget('public') > 0 && `${String(withBudget('public'))} public`,
    withBudget('product') > 0 && `${String(withBudget('product'))} product`,
    revoiced > 0 && `${String(revoiced)} revoiced`
  )
  return posture === ''
    ? zones
        .map((zone) => zone.zone)
        .filter((name, index, names) => names.indexOf(name) === index)
        .join(SEPARATOR)
    : posture
}

/**
 * What the mark actually ships, where its count can only ever be one.
 *
 * `logo` is declared or it is not, so the count carries nothing at all. Whether
 * there is a dark rendering is the fact an operator needs — a mark with no dark
 * counterpart disappears on half the surfaces — and whether misuse is written
 * down is the difference between a file and a usable asset.
 */
const summariseLogo = (app: App): string => {
  const logo = app.design?.logo
  if (logo === undefined) return ''
  const misuse = sized(logo.misuse)
  return parts(
    logo.srcDark === undefined ? 'light only' : 'light · dark',
    misuse > 0 && `${String(misuse)} misuse noted`
  )
}

/** The four registers imagery direction can be written in. */
const IMAGERY_REGISTERS = ['principles', 'photography', 'iconSet', 'patterns'] as const

/**
 * Which registers of the imagery direction are written.
 *
 * Like `logo`, this layer's count is one or zero and says only that the key
 * exists. An icon set and a photography direction are different decisions, and
 * which of them an operator made is what the row is for.
 */
const summariseImagery = (app: App): string => {
  const imagery = (app.design?.imagery ?? {}) as Readonly<Record<string, unknown>>
  return IMAGERY_REGISTERS.filter((register) => imagery[register] !== undefined).join(SEPARATOR)
}

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
