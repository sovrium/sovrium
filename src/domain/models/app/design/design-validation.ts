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

import { PUBLIC_BUDGET_ZONE_NAMES } from './zones'

/** The projection of an app config these rules read. Deliberately not `App`. */
interface DesignValidationInput {
  readonly design?: {
    readonly colors?: Readonly<Record<string, unknown>>
    // The two VALUE fields are what rule 2 branches on and what rule 2b reads;
    // the two prose fields are carried only so a caller may pass a whole role
    // entry without the excess-property check refusing it.
    readonly colorRoles?: Readonly<
      Record<
        string,
        | {
            readonly value?: string
            readonly dark?: string
            readonly usage?: string
            readonly pairsWith?: string
          }
        | undefined
      >
    >
    readonly ramps?: Readonly<Record<string, Readonly<Record<string, string>> | undefined>>
    readonly density?: { readonly byZone?: Readonly<Record<string, string>> }
    readonly typeScale?: {
      readonly families?: Readonly<Record<string, unknown>>
      readonly steps?: Readonly<Record<string, { readonly font?: string } | undefined>>
    }
    readonly voice?: { readonly pronoun?: string }
    readonly zones?: ReadonlyArray<{
      readonly pattern: string
      readonly zone: string
      readonly accentBudget?: string
      readonly voice?: { readonly pronoun?: string }
    }>
  }
}

/**
 * Rule 1 — a `design.colorRoles` entry that only DOCUMENTS must name a declared
 * colour token.
 *
 * Guidance keyed to a token that does not exist can never render beside that
 * token, so it is invisible until somebody goes looking for it. In practice the
 * cause is almost always a typo in the token name, and a typo in a kebab-case
 * colour name (`primary-fg` vs `primary-foreground`) is exactly the mistake a
 * reader's eye skips.
 *
 * ## Why an entry carrying a `value` is exempt
 *
 * `colorRoles` now has two jobs. An entry with `usage`/`pairsWith` and nothing
 * else DOCUMENTS a token declared elsewhere — the original job, and the one
 * this rule guards. An entry with `value` (or `dark`) DEFINES the role: it says
 * what the token resolves to, so requiring it to already exist would make the
 * definition impossible to write. Sovrium's own default palette is 40 such
 * definitions and no palette entry at all.
 *
 * The distinction is decidable from the entry alone, which is what makes it
 * safe: a typo'd DOCUMENTING key is still caught, and a defining entry is never
 * asked to point at something.
 *
 * The palette is `design.colors`, which is the one position it is declared at.
 */
/** An entry that says what the role RESOLVES TO defines it, so it points at nothing. */
const rolePointsAtAToken = (
  role: { readonly value?: string; readonly dark?: string } | undefined
): boolean => role?.value === undefined && role?.dark === undefined

/** The declared palette. */
const declaredPalette = (app: DesignValidationInput): ReadonlySet<string> =>
  new Set(Object.keys(app.design?.colors ?? {}))

const validateColorRoleReferences = (app: DesignValidationInput): string | true => {
  const roles = app.design?.colorRoles
  if (!roles) return true

  const declared = declaredPalette(app)

  const unknownRole = Object.entries(roles).find(
    ([name, role]) => rolePointsAtAToken(role) && !declared.has(name)
  )?.[0]
  if (unknownRole === undefined) return true

  const available =
    declared.size > 0
      ? `Declared colours: ${[...declared].toSorted().join(', ')}`
      : 'No colours are declared in `design.colors`'
  return `\`design.colorRoles\` documents colour '${unknownRole}', which is not declared in \`design.colors\`. ${available}`
}

/**
 * Rule 1b — every ramp REFERENCE resolves to a declared ramp step.
 *
 * A reference is a string like `neutral-200`, written in a ramp step or in a
 * role's `value`/`dark`. It reaches CSS as a `var()` chain the generator
 * derives, so an unresolvable one emits a variable nothing defines: the browser
 * falls back to the initial value and the surface paints transparent or black,
 * with no error anywhere. That is the failure mode a config-time check exists
 * for, and it is the same failure shape as rule 1 one level down.
 *
 * A literal is never a reference — `ColorValueSchema` requires a `#`, `rgb(`,
 * `hsl(` or `oklch(` prefix — so the two are told apart by shape rather than
 * by position, and a config that declares no ramps at all is untouched.
 */
const RAMP_REF_PATTERN = /^([a-z][a-z0-9]*(?:-[a-z0-9]+)*)-(\d{2,3})$/

const findUnresolvedRampRef = (
  ramps: Readonly<Record<string, Readonly<Record<string, string>> | undefined>>,
  value: string | undefined,
  where: string
): string | true => {
  if (value === undefined) return true
  const match = RAMP_REF_PATTERN.exec(value)
  if (match === null) return true

  const [, rampName = '', step = ''] = match
  const ramp = ramps[rampName]
  if (ramp?.[step] !== undefined) return true

  const declared = Object.keys(ramps).toSorted()
  const available =
    declared.length > 0
      ? `Declared ramps: ${declared.join(', ')}`
      : 'No ramps are declared in `design.ramps`'
  return `${where} references '${value}', which does not resolve to a declared ramp step. A reference reaches CSS as a variable the generator derives, so an unresolved one paints nothing and says nothing. ${available}`
}

const validateRampReferences = (app: DesignValidationInput): string | true => {
  const ramps = app.design?.ramps
  const roles = app.design?.colorRoles
  if (!ramps && !roles) return true

  const declaredRamps = ramps ?? {}

  const stepMiss = Object.entries(declaredRamps)
    .flatMap(([rampName, steps]) =>
      Object.entries(steps ?? {}).map(([step, value]) =>
        findUnresolvedRampRef(declaredRamps, value, `\`design.ramps.${rampName}.${step}\``)
      )
    )
    .find((result) => result !== true)
  if (stepMiss !== undefined) return stepMiss

  const roleMiss = Object.entries(roles ?? {})
    .flatMap(([name, role]) => [
      findUnresolvedRampRef(declaredRamps, role?.value, `\`design.colorRoles.${name}.value\``),
      findUnresolvedRampRef(declaredRamps, role?.dark, `\`design.colorRoles.${name}.dark\``),
    ])
    .find((result) => result !== true)
  return roleMiss ?? true
}

/**
 * Rule 2 — every `design.density.byZone` key names a declared zone.
 *
 * Same failure shape as rule 1, against a different sibling key. A
 * `byZone` entry naming a zone that does not exist assigns a density to
 * nothing: every route keeps whatever step it had, at no error, and the author
 * sees a config that says `product: 'compact'` beside a product surface that
 * is not compact.
 *
 * The check lives here rather than in the key schema because `byZone` is a
 * `Schema.Record` and Effect v4's `Schema.Record` **silently DROPS** an entry
 * whose KEY fails the key schema. A zone-name key schema would delete the
 * entry and report the config valid — strictly worse than deferring, which is
 * why `density.ts` keys on plain `Schema.String` and defers to this rule. It
 * is also stronger: resolving against the DECLARED zones is more than a
 * pattern could ever assert.
 *
 * `zone: 'none'` is treated as any other declared name. It is a reserved word
 * meaning "belongs to no zone", so assigning it a density is pointless — but
 * it is pointless rather than WRONG, and this rule reports names that resolve
 * to nothing, not declarations that are merely inert.
 */
const validateDensityZoneReferences = (app: DesignValidationInput): string | true => {
  const byZone = app.design?.density?.byZone
  if (!byZone) return true

  const declared = new Set((app.design?.zones ?? []).map((entry) => entry.zone))

  const unknownZone = Object.keys(byZone).find((zone) => !declared.has(zone))
  if (unknownZone === undefined) return true

  const available =
    declared.size > 0
      ? `Declared zones: ${[...declared].toSorted().join(', ')}`
      : 'No zones are declared in `design.zones`'
  return `\`design.density.byZone\` assigns a density to zone '${unknownZone}', which is not declared in \`design.zones\`. ${available}`
}

/**
 * Rule 3 — every `design.typeScale.steps.*.font` names a declared font FACE.
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
 * There is no platform-inherited font CATEGORY — `design.typeScale.families` is
 * entirely the author's — so an unresolvable name here is always a mistake.
 */
/** The font categories an app declares. */
const declaredFontCategories = (app: DesignValidationInput): ReadonlySet<string> =>
  new Set(Object.keys(app.design?.typeScale?.families ?? {}))

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
  const steps = app.design?.typeScale?.steps
  if (!steps) return true

  const declared = declaredFontCategories(app)
  const offender = findUnresolvableFace(steps, declared)
  if (offender === undefined) return true

  const [stepName, face] = offender
  const available =
    declared.size > 0
      ? `Declared font categories: ${[...declared].toSorted().join(', ')}`
      : 'No font categories are declared in `design.typeScale.families`'
  return `\`design.typeScale.steps.${stepName}.font\` names font category '${face}', which is not declared. ${available}`
}

/**
 * Rule 4 — the four `design.zones[]` rules, bundled, first failure wins.
 *
 * Bundled into ONE exported rule for the same reason every other cross-key rule
 * in this file is: `validateAllDesignReferences` is itself already reached
 * through the last surviving `Schema.check` link, and the count of things that
 * chain carries is the constraint. Four more top-level entries here would be
 * four more chances for somebody to reach for `Schema.check` instead.
 *
 * ### 4a — a zone pronoun identical to the app pronoun
 *
 * Mirrors `validateThemeExclusivity`'s reasoning exactly: a second spelling of
 * the same value has no way to stay the same. When the app pronoun changes, the
 * zone that redundantly restated it silently keeps the old one, and the author
 * who changed one line sees a config where half the app did not follow. There
 * is no reading of `{ pronoun: 'tu' }` under an app that already says `tu` that
 * the author could not get by deleting the line.
 *
 * ### 4b — a zone voice with no base to override
 *
 * `zones[].voice` is a per-FIELD override of `design.voice`. With no
 * `design.voice`, there is nothing to override and the undeclared fields
 * inherit from nothing — so the author has written zone-scoped voice rules that
 * are, for every field they did not spell out, undefined. That is a config
 * whose meaning depends on a key that is not there.
 *
 * ### 4c — two entries claiming the same pattern
 *
 * Zone entries rank by SPECIFICITY, not declaration order, so two entries with
 * the same pattern are exactly equally specific and the winner is whichever the
 * ranking happens to reach first. Both are plausible, one is silently ignored,
 * and no surface anywhere says which. Refusing is the only outcome that names
 * the ambiguity.
 *
 * ### 4d — a public-budget zone name carrying a non-public budget
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

/** 4a — a zone pronoun that merely restates the app pronoun. */
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

/** 4b — a zone voice override with no `design.voice` to override. */
const findOrphanVoiceOverride = (zones: ZoneEntries, hasAppVoice: boolean): string | true => {
  if (hasAppVoice) return true
  const offender = zones.find((entry) => entry.voice !== undefined)
  if (offender === undefined) return true
  return `\`design.zones\` entry '${offender.pattern}' declares a \`voice\` override, but the app declares no \`design.voice\`. A zone voice replaces fields of the app voice per-FIELD and inherits the rest, so with no base every field it does not spell out is undefined. Declare \`design.voice\`, or move the zone's rules there.`
}

/**
 * 4c — two entries claiming the same pattern.
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

/** 4d — a conventionally-public zone name carrying a non-public budget. */
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
 * Ordered deliberately: the colour rules first, because a role that names
 * nothing is a more immediate problem than the value it points at, and
 * reporting the value first sends the author to the wrong line.
 *
 * The zone rules go LAST for the mirror-image reason: they are the only ones
 * that read `design.voice`, and a config with an unresolvable font face has a
 * more immediate problem than a redundant zone pronoun.
 *
 * @param app - The app config being decoded
 * @returns `true` when clean, or the first violation as a human-readable message
 */
export const validateAllDesignReferences = (app: DesignValidationInput): string | true => {
  const colorRoles = validateColorRoleReferences(app)
  if (colorRoles !== true) return colorRoles

  // Ramp references AFTER the role-name rule: a role that names nothing is a
  // more immediate problem than the value it points at, and reporting the
  // value first sends the author to the wrong line.
  const rampRefs = validateRampReferences(app)
  if (rampRefs !== true) return rampRefs

  const typeScale = validateTypeScaleFontReferences(app)
  if (typeScale !== true) return typeScale

  const zones = validateZoneRules(app)
  if (zones !== true) return zones

  // Density LAST: it is the only rule that resolves a name against the zone
  // map, so a zone map with
  // duplicate patterns or an illegal budget has to be reported before an
  // "unknown zone" message that would send the author to the wrong line.
  return validateDensityZoneReferences(app)
}
