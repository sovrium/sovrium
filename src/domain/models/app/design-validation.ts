/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The cross-key rules the `design` key cannot express on its own.
 *
 * ## Why they live in a module and not in the `AppSchema.pipe()` chain
 *
 * `src/domain/models/app/index.ts` already carries ~17 chained
 * `Schema.check(Schema.makeFilter(...))` calls, and its own comments record why
 * the last one bundles six unrelated checks: *"each additional filter in the
 * chain pushes TypeScript's deep-instantiation depth over the limit and
 * collapses the derived `App` type to `never`."* Adding three more filters
 * would be the fastest way to turn `App` into `never` — a failure that does not
 * surface as a type error at the definition site, only as every downstream
 * consumer silently accepting anything.
 *
 * So they are ALL bundled into the LAST existing filter, next to
 * `validateAllSystemSourceReferences` and `validateAllTablePermissionGroups`,
 * exactly as `redirects-validation.ts` and `role-validation.ts` are.
 *
 * ## Why the input type is local and loose
 *
 * The same reason the sibling `*-validation.ts` modules use one: importing
 * `App` here would make this module part of the very type graph whose depth is
 * the problem, and it would create an import cycle with `index.ts`. The shapes
 * below are the narrowest projection each rule actually reads.
 */

import { PUBLIC_BUDGET_ZONE_NAMES } from './design/zones'

/** The projection of an app config these rules read. Deliberately not `App`. */
interface DesignValidationInput {
  readonly theme?: unknown
  readonly design?: {
    readonly theme?: {
      readonly colors?: Readonly<Record<string, unknown>>
      readonly fonts?: Readonly<Record<string, unknown>>
    }
    readonly colorRoles?: Readonly<Record<string, unknown>>
    readonly components?: Readonly<Record<string, unknown>>
    readonly typeScale?: Readonly<Record<string, { readonly font?: string } | undefined>>
    readonly voice?: { readonly pronoun?: string }
    readonly zones?: ReadonlyArray<{
      readonly pattern: string
      readonly zone: string
      readonly accentBudget?: string
      readonly voice?: { readonly pronoun?: string }
    }>
  }
  readonly components?: ReadonlyArray<{ readonly name: string }>
}

/**
 * Rule 1 — `theme` and `design.theme` are mutually exclusive.
 *
 * The alternative is a silent merge, and a merge has to pick a winner. Whatever
 * it picks, the author who wrote the loser sees a config they authored having
 * no effect, with nothing anywhere saying so. Refusing is the only outcome that
 * tells the truth, and the fix is one line in either direction.
 *
 * Note this fires only when BOTH keys are present. `theme` alone stays valid
 * forever-until-the-next-major, which is the whole point of the alias.
 */
const validateThemeExclusivity = (app: DesignValidationInput): string | true => {
  if (app.theme === undefined || app.design?.theme === undefined) return true
  return 'Both `theme` and `design.theme` are declared. They are the same tokens in two positions, so only one may be present: move the top-level `theme` block into `design.theme` and delete it (`design.theme` is canonical; top-level `theme` is a deprecated alias removed at the next major).'
}

/**
 * Rule 2 — every `design.colorRoles` key names a declared colour token.
 *
 * Guidance keyed to a token that does not exist can never render beside that
 * token, so it is invisible until somebody goes looking for it. In practice the
 * cause is almost always a typo in the token name, and a typo in a kebab-case
 * colour name (`primary-fg` vs `primary-foreground`) is exactly the mistake a
 * reader's eye skips.
 *
 * The palette is read from `design.theme.colors` OR top-level `theme.colors` —
 * both, because this rule runs at decode time, before the normalization that
 * mirrors one position into the other. Reading only the canonical position
 * would refuse every legitimate config that still uses the alias.
 */
const validateColorRoleReferences = (app: DesignValidationInput): string | true => {
  const roles = app.design?.colorRoles
  if (!roles) return true

  const legacyTheme = app.theme as
    { readonly colors?: Readonly<Record<string, unknown>> } | undefined
  const colors = app.design?.theme?.colors ?? legacyTheme?.colors
  const declared = new Set(Object.keys(colors ?? {}))

  const unknownRole = Object.keys(roles).find((name) => !declared.has(name))
  if (unknownRole === undefined) return true

  const available =
    declared.size > 0
      ? `Declared colours: ${[...declared].toSorted().join(', ')}`
      : 'No colours are declared in `design.theme.colors`'
  return `\`design.colorRoles\` documents colour '${unknownRole}', which is not declared in the theme palette. ${available}`
}

/**
 * Rule 3 — every `design.components` key names a declared component template.
 *
 * Same failure shape as rule 2, one level up: guidance attached to a component
 * that does not exist renders nowhere, and the cause is a rename that updated
 * `components[].name` and not its guidance entry.
 */
const validateComponentGuidanceReferences = (app: DesignValidationInput): string | true => {
  const guidance = app.design?.components
  if (!guidance) return true

  const declared = new Set((app.components ?? []).map((component) => component.name))

  const unknownComponent = Object.keys(guidance).find((name) => !declared.has(name))
  if (unknownComponent === undefined) return true

  const available =
    declared.size > 0
      ? `Declared components: ${[...declared].toSorted().join(', ')}`
      : 'No component templates are declared in `components[]`'
  return `\`design.components\` documents component '${unknownComponent}', which is not declared in \`components[]\`. ${available}`
}

/**
 * Rule 4 — every `design.typeScale.*.font` names a declared font FACE.
 *
 * A step reading `font: 'titel'` is not a cosmetic mistake: the CSS generator
 * emits `--text-h1--font-family: var(--font-titel)`, which resolves to nothing
 * and silently falls back to the inherited family. The step renders — at the
 * right size, in the wrong face — so nothing looks broken enough to
 * investigate. That is the failure mode this rule exists to convert into a
 * decode error naming the typo.
 *
 * Strict here, unlike `colorRoles.pairsWith`, which is deliberately open. The
 * difference is real rather than an inconsistency: `pairsWith` legitimately
 * names PLATFORM role tokens an app never redeclared (`foreground`,
 * `background`), so requiring resolution there would refuse correct configs.
 * There is no platform-inherited font CATEGORY — `theme.fonts` is entirely the
 * author's — so an unresolvable name here is always a mistake.
 *
 * Reads both theme positions, for the same reason rule 2 does: this runs before
 * the alias mirror.
 */
/** The font categories an app declares, from whichever theme position it used. */
const declaredFontCategories = (app: DesignValidationInput): ReadonlySet<string> => {
  const legacyTheme = app.theme as
    { readonly fonts?: Readonly<Record<string, unknown>> } | undefined
  return new Set(Object.keys(app.design?.theme?.fonts ?? legacyTheme?.fonts ?? {}))
}

/** The first `[step, face]` pair whose face resolves against nothing. */
const findUnresolvableFace = (
  steps: Readonly<Record<string, { readonly font?: string } | undefined>>,
  declared: ReadonlySet<string>
): readonly [string, string] | undefined =>
  Object.entries(steps)
    .flatMap(([stepName, step]) => {
      const face = step?.font
      return face !== undefined && !declared.has(face)
        ? [[stepName, face] as readonly [string, string]]
        : []
    })
    .at(0)

const validateTypeScaleFontReferences = (app: DesignValidationInput): string | true => {
  const steps = app.design?.typeScale
  if (!steps) return true

  const declared = declaredFontCategories(app)
  const offender = findUnresolvableFace(steps, declared)
  if (offender === undefined) return true

  const [stepName, face] = offender
  const available =
    declared.size > 0
      ? `Declared font categories: ${[...declared].toSorted().join(', ')}`
      : 'No font categories are declared in `design.theme.fonts`'
  return `\`design.typeScale.${stepName}.font\` names font category '${face}', which is not declared in the theme. ${available}`
}

/**
 * Rule 5 — the four `design.zones[]` rules, bundled, first failure wins.
 *
 * Bundled into ONE exported rule for the same reason every other cross-key rule
 * in this file is: `validateAllDesignReferences` is itself already reached
 * through the last surviving `Schema.check` link, and the count of things that
 * chain carries is the constraint. Four more top-level entries here would be
 * four more chances for somebody to reach for `Schema.check` instead.
 *
 * ### 5a — a zone pronoun identical to the app pronoun
 *
 * Mirrors `validateThemeExclusivity`'s reasoning exactly: a second spelling of
 * the same value has no way to stay the same. When the app pronoun changes, the
 * zone that redundantly restated it silently keeps the old one, and the author
 * who changed one line sees a config where half the app did not follow. There
 * is no reading of `{ pronoun: 'tu' }` under an app that already says `tu` that
 * the author could not get by deleting the line.
 *
 * ### 5b — a zone voice with no base to override
 *
 * `zones[].voice` is a per-FIELD override of `design.voice`. With no
 * `design.voice`, there is nothing to override and the undeclared fields
 * inherit from nothing — so the author has written zone-scoped voice rules that
 * are, for every field they did not spell out, undefined. That is a config
 * whose meaning depends on a key that is not there.
 *
 * ### 5c — two entries claiming the same pattern
 *
 * Zone entries rank by SPECIFICITY, not declaration order, so two entries with
 * the same pattern are exactly equally specific and the winner is whichever the
 * ranking happens to reach first. Both are plausible, one is silently ignored,
 * and no surface anywhere says which. Refusing is the only outcome that names
 * the ambiguity.
 *
 * ### 5d — a public-budget zone name carrying a non-public budget
 *
 * `accentBudget` is authoritative for the budget lock — the zone NAME no longer
 * decides it. But `PUBLIC_BUDGET_ZONE_NAMES` still holds the convention, and a
 * config declaring `{ zone: 'marketing', accentBudget: 'product' }` makes the
 * name and the budget disagree. Whichever a future reader trusts, the other is
 * a lie. This is the rule that lets `accentBudget` become authoritative without
 * the zone name quietly becoming meaningless.
 */
/** The zone entries a config declares, or `undefined` when it declares none. */
type ZoneEntries = NonNullable<NonNullable<DesignValidationInput['design']>['zones']>

/** 5a — a zone pronoun that merely restates the app pronoun. */
const findRedundantPronounOverride = (
  zones: ZoneEntries,
  appPronoun: string | undefined
): string | true => {
  const offender = zones.find(
    (entry) => entry.voice?.pronoun !== undefined && entry.voice.pronoun === appPronoun
  )
  if (offender === undefined) return true
  return `\`design.zones\` entry '${offender.pattern}' overrides the voice pronoun with '${offender.voice?.pronoun ?? ''}', which is already \`design.voice.pronoun\`. A second spelling of the same value drifts the moment one of them changes: delete the zone override, or make it say something different.`
}

/** 5b — a zone voice override with no `design.voice` to override. */
const findOrphanVoiceOverride = (zones: ZoneEntries, hasAppVoice: boolean): string | true => {
  if (hasAppVoice) return true
  const offender = zones.find((entry) => entry.voice !== undefined)
  if (offender === undefined) return true
  return `\`design.zones\` entry '${offender.pattern}' declares a \`voice\` override, but the app declares no \`design.voice\`. A zone voice replaces fields of the app voice per-FIELD and inherits the rest, so with no base every field it does not spell out is undefined. Declare \`design.voice\`, or move the zone's rules there.`
}

/**
 * 5c — two entries claiming the same pattern.
 *
 * Quadratic rather than set-based, and deliberately: a zone map is a handful of
 * entries, and the alternative is a mutable accumulator this layer forbids.
 */
const findDuplicatePattern = (zones: ZoneEntries): string | true => {
  const offender = zones.find(
    (entry, index) => zones.findIndex((other) => other.pattern === entry.pattern) !== index
  )
  if (offender === undefined) return true
  return `\`design.zones\` declares the pattern '${offender.pattern}' twice. Entries rank by specificity, not declaration order, so two entries with the same pattern are equally specific and the winner is arbitrary — one zone would govern the route and the other would silently never apply.`
}

/** 5d — a conventionally-public zone name carrying a non-public budget. */
const findContradictoryBudget = (zones: ZoneEntries): string | true => {
  const offender = zones.find(
    (entry) =>
      PUBLIC_BUDGET_ZONE_NAMES.includes(entry.zone) &&
      entry.accentBudget !== undefined &&
      entry.accentBudget !== 'public'
  )
  if (offender === undefined) return true
  return `\`design.zones\` entry '${offender.pattern}' names zone '${offender.zone}', which carries the PUBLIC accent budget by convention, but declares \`accentBudget: '${offender.accentBudget ?? ''}'\`. The name and the budget contradict each other and a reader cannot tell which is meant: either declare \`accentBudget: 'public'\`, or rename the zone. Conventionally-public zone names: ${PUBLIC_BUDGET_ZONE_NAMES.join(', ')}`
}

const validateZoneRules = (app: DesignValidationInput): string | true => {
  const zones = app.design?.zones
  if (!zones) return true

  const redundant = findRedundantPronounOverride(zones, app.design?.voice?.pronoun)
  if (redundant !== true) return redundant

  const orphan = findOrphanVoiceOverride(zones, app.design?.voice !== undefined)
  if (orphan !== true) return orphan

  const duplicate = findDuplicatePattern(zones)
  if (duplicate !== true) return duplicate

  return findContradictoryBudget(zones)
}

/**
 * Run all five `design` cross-key rules, first failure wins.
 *
 * Ordered deliberately: exclusivity first, because when both theme positions
 * are declared the palette a colour-role rule would read is itself ambiguous,
 * and reporting a downstream "unknown colour" while the real problem is two
 * competing palettes sends the author to the wrong line.
 *
 * The zone rules go LAST for the mirror-image reason: they are the only ones
 * that read `design.voice`, and a config with a broken theme or an unresolvable
 * font face has a more immediate problem than a redundant zone pronoun.
 *
 * @param app - The app config being decoded
 * @returns `true` when clean, or the first violation as a human-readable message
 */
export const validateAllDesignReferences = (app: DesignValidationInput): string | true => {
  const exclusivity = validateThemeExclusivity(app)
  if (exclusivity !== true) return exclusivity

  const colorRoles = validateColorRoleReferences(app)
  if (colorRoles !== true) return colorRoles

  const components = validateComponentGuidanceReferences(app)
  if (components !== true) return components

  const typeScale = validateTypeScaleFontReferences(app)
  if (typeScale !== true) return typeScale

  return validateZoneRules(app)
}
