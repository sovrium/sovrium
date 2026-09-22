/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `buildDesignSystem(app)` — the SOLE source behind all three design-system
 * projections: `GET /api/admin/design-system.json`, `GET /api/admin/design-system.md`,
 * and `sovrium design-system`.
 *
 * One generator is the entire point. Three surfaces reading three code paths
 * would eventually disagree about what an app's design system IS, and the one
 * that an agent happened to read would win. Here the markdown is a projection
 * OF the document this function returns, so disagreement is not expressible.
 *
 * ─── THE CONFIDENTIALITY BOUND ──────────────────────────────────────────────
 *
 * This reads `app.design.*` (equivalently the deprecated top-level `app.design`,
 * which `normalizeAppDesign` mirrors at the decode boundary) and NOTHING ELSE.
 * It never resolves an `app.env[]` value — `app.env[]` declares NAMES, and
 * resolving one here would re-implement `/_admin/env` without [internal ref] A1's
 * redaction condition, which A1 itself defines as an unauthorised surface. It
 * carries no table data either: a design system describes how an app looks, not
 * what is in it. That bound is what makes the output safe to paste into an
 * agent's context window.
 *
 * ─── WHAT NEVER BECOMES A TOKEN ─────────────────────────────────────────────
 *
 * An agent handed this document will OBEY it, so a value that does not ship
 * must never appear in the token tree — and a value the author wrote must never
 * vanish without trace either. Two buckets carry the difference:
 *
 *  - **`inert`** — declared, validated, and then discarded by the renderer
 * ([internal ref]: all three of `fonts.*.lineHeight`, `.size` and `.weights`
 *    reach nothing at all). Each entry
 *    carries the REASON, so the author can stop maintaining it. These three are
 * now SUPERSEDED by `design.typeScale` and are still reported
 *    here, because supersession does not make a declaration take effect — the
 *    author needs to see that Sovrium received the value and did nothing with
 *    it, which is the fact that lets them stop maintaining it.
 *  - **`unmappable`** — real, shipped values with no faithful DTCG form: a
 *    multi-layer `box-shadow`, a `clamp()` spacing step, a dark-mode palette in
 *    a single-mode document. Their raw text is preserved verbatim.
 */

import { projectCatalogue } from '@/application/use-cases/admin/design-system-catalogue-export'
import { SOVRIUM_EXTENSION_KEY } from '@/domain/models/api/admin/design-system'
import {
  INHERITED_BREAKPOINT_TOKENS,
  INHERITED_COLOR_TOKENS,
  INHERITED_DURATION_TOKENS,
  INHERITED_FONT_TOKENS,
  INHERITED_EASING_TOKENS,
  INHERITED_RADIUS_TOKENS,
  INHERITED_SHADOW_TOKENS,
  INHERITED_SPACING_TOKENS,
} from '@/domain/models/app/design/inherited-tokens'
import {
  parseColorValue,
  parseCubicBezierValue,
  parseDimensionValue,
  parseDurationValue,
} from '@/domain/models/app/design/token-value-dtcg-service'
import { TYPE_SCALE_STEPS } from '@/domain/models/app/design/type-scale'
import type { DesignSystemDocument } from '@/domain/models/api/admin/design-system'
import type { App } from '@/domain/models/app'
import type { Design } from '@/domain/models/app/design'
import type { TypeScale, TypeScaleSteps } from '@/domain/models/app/design/type-scale'

/** One declared value the renderer discards, with the reason it does. */
interface InertEntry {
  readonly path: string
  readonly declared: string
  readonly reason: string
}

/** A token group plus the declarations that could not enter it. */
interface Projection<T> {
  readonly tokens: Readonly<Record<string, T>>
  readonly unmappable: Readonly<Record<string, string>>
}

/** Inputs for {@link projectGroup}, bundled to stay inside the parameter cap. */
interface ProjectGroupInput<V> {
  readonly entries: Readonly<Record<string, string>>
  readonly parse: (raw: string) => V | undefined
  readonly type: string
  readonly path: string
  readonly describe?: (name: string) => string | undefined
}

/**
 * Turn a record of authored CSS strings into a DTCG token group, routing every
 * value the parser refuses into `unmappable` instead of approximating it.
 */
function projectGroup<V>(input: ProjectGroupInput<V>): Projection<{
  $type: string
  $value: V
  $description?: string
}> {
  const parsed = Object.entries(input.entries).map(([name, raw]) => ({
    name,
    raw,
    value: input.parse(raw),
  }))
  const described = (name: string): Readonly<{ $description?: string }> => {
    const description = input.describe?.(name)
    return description === undefined ? {} : { $description: description }
  }
  return {
    tokens: Object.fromEntries(
      parsed
        .filter((entry) => entry.value !== undefined)
        .map((entry) => [
          entry.name,
          { $type: input.type, $value: entry.value as V, ...described(entry.name) },
        ])
    ),
    unmappable: Object.fromEntries(
      parsed
        .filter((entry) => entry.value === undefined)
        .map((entry) => [`${input.path}.${entry.name}`, entry.raw])
    ),
  }
}

/**
 * The font fields that are declared, validated, and then reach nothing an agent
 * could observe — recorded so the author can stop maintaining them.
 */
const INERT_FONT_FIELDS: Readonly<Record<string, string>> = {
  lineHeight:
    'Declared and validated, but no renderer reads it — `generateThemeFonts` emits no line-height variable and nothing else in the engine consumes the value.',
  size: 'Declared and validated, but no renderer reads it — its one consumer was the withdrawn `hero` section renderer, and it never became a CSS variable.',
  weights:
    'Declared and validated, but no renderer reads it — only the first entry was ever read, by the withdrawn `hero` section renderer. No additional font face is loaded, so extra weights render as synthetic bolding or not at all.',
}

/**
 * Font fields that DO ship but have no home in this document: the contract
 * publishes `fontFamily` and no `fontWeight` / `typography` group, so a real
 * value like `letterSpacing` would have to be invented into a token type DTCG
 * has not defined. Kept verbatim instead.
 */
const UNMAPPABLE_FONT_FIELDS: readonly string[] = ['style', 'transform', 'letterSpacing', 'url']

/** Read a font field as a printable string, whatever its declared type. */
const asDeclaredText = (value: unknown): string =>
  Array.isArray(value) ? value.join(', ') : String(value)

/** The DTCG `fontFamily` value for one declared category: the family, then its fallbacks. */
const fontStack = (font: {
  readonly family: string
  readonly fallback?: string
}): readonly string[] =>
  font.fallback === undefined
    ? [font.family]
    : [
        font.family,
        ...font.fallback
          .split(',')
          .map((part) => part.trim())
          .filter(Boolean),
      ]

/** Every inert declaration across the app's declared font categories. */
const collectInertFontFields = (fonts: TypeScale['families']): readonly InertEntry[] =>
  Object.entries(fonts ?? {}).flatMap(([category, font]) =>
    Object.entries(INERT_FONT_FIELDS).flatMap(([field, reason]) => {
      const declared = (font as Readonly<Record<string, unknown>>)[field]
      return declared === undefined
        ? []
        : [
            {
              path: `design.typeScale.families.${category}.${field}`,
              declared: asDeclaredText(declared),
              reason,
            },
          ]
    })
  )

/** Font fields that ship but this document cannot type. */
const collectUnmappableFontFields = (
  fonts: TypeScale['families']
): Readonly<Record<string, string>> =>
  Object.fromEntries(
    Object.entries(fonts ?? {}).flatMap(([category, font]) =>
      UNMAPPABLE_FONT_FIELDS.flatMap((field) => {
        const declared = (font as Readonly<Record<string, unknown>>)[field]
        return declared === undefined
          ? []
          : [[`design.typeScale.families.${category}.${field}`, asDeclaredText(declared)] as const]
      })
    )
  )

/** Prefix every key of a raw-declaration record with its config path. */
const atPath = (
  values: Readonly<Record<string, string>> | undefined,
  path: string
): Readonly<Record<string, string>> =>
  Object.fromEntries(Object.entries(values ?? {}).map(([name, raw]) => [`${path}.${name}`, raw]))

/**
 * One string-valued LADDER of `design.motion`.
 *
 * These used to be reserved keys INSIDE the animation map, read as
 * `animations.duration` / `animations.easing`. They are siblings of
 * `animations` now, so reading the old path returns nothing at all — the
 * export would have reported an app with a full duration ladder as having
 * none, and said so in a document whose whole purpose is to be believed.
 *
 * The defensiveness stays. This runs over a decoded config, but the document
 * is also built for configs read through looser paths, and a value of the
 * wrong shape must yield `{}` rather than throw: a design-system export that
 *500s is worse than one that reports an empty group.
 */
const motionLadderOf = (
  design: Design | undefined,
  key: 'durations' | 'easings'
): Readonly<Record<string, string>> => {
  const tokens = design?.motion?.[key]
  if (typeof tokens !== 'object' || tokens === null || Array.isArray(tokens)) return {}
  return Object.fromEntries(
    Object.entries(tokens as Readonly<Record<string, unknown>>).flatMap(([name, value]) =>
      typeof value === 'string' ? [[name, value] as const] : []
    )
  )
}

/**
 * `design.motion.durations` — the ladder that DOES have a DTCG home, projected
 * into the `duration` token group.
 */
const durationTokensOf = (design: Design | undefined): Readonly<Record<string, string>> =>
  motionLadderOf(design, 'durations')

/**
 * `design.motion.easings` — the ladder that does NOT, and is therefore reported
 * under `unmappable` rather than emitted as a token.
 */
const easingTokensOf = (design: Design | undefined): Readonly<Record<string, string>> =>
  motionLadderOf(design, 'easings')

/** Where a declared easing lives in the config, and how `unmappable` names it. */
const EASING_PATH = 'design.motion.easings'

/**
 * The `typography` group: one DTCG composite token per declared type-scale step.
 *
 * ─── WHY THIS GROUP EXISTS AND THE INERT FONT FIELDS STILL DO NOT ───────────
 *
 * `design.typeScale?.families.*.size` and `.lineHeight` are reported under `inert` — declared,
 * validated, discarded. `design.typeScale` is their replacement and appears
 * HERE, in the live token tree, because it genuinely ships: every step emits
 * `--text-{step}` plus its Tailwind modifiers, and a working `text-{step}`
 * utility. That difference is the entire justification for superseding them, so
 * it had better be visible in the document an agent reads.
 *
 * ─── LADDER ORDER, NOT AUTHORING ORDER ──────────────────────────────────────
 *
 * Iterates `TYPE_SCALE_STEPS` rather than `Object.entries`, so `display` comes
 * before `caption` no matter which order the author wrote the keys in. A type
 * scale read out of order is not a scale.
 *
 * ─── WHAT CANNOT ENTER THE COMPOSITE ────────────────────────────────────────
 *
 * A tracking value declared in `em` — the idiomatic unit, accepted by the
 * schema and emitted to CSS verbatim. DTCG's `letterSpacing` must be a
 * dimension (`px`/`rem` only), so the member is omitted from the token and the
 * raw text is reported at its exact config path under `unmappable`. The step
 * still publishes; only that one member is withheld, which is strictly better
 * than dropping the step or inventing a `px` conversion the author never wrote.
 */
/**
 * A tracking value as a DTCG dimension, or `undefined` when the author used a
 * unit DTCG cannot carry (`em`) — which routes it to `unmappable` instead.
 */
const trackingOf = (raw: string | undefined) =>
  raw === undefined ? undefined : parseDimensionValue(raw)

const projectTypography = (
  typeScale: TypeScaleSteps | undefined,
  fonts: TypeScale['families']
): Projection<DesignSystemDocument['typography'][string]> => {
  const declaredSteps = TYPE_SCALE_STEPS.flatMap((step) => {
    const declared = typeScale?.[step]
    return declared === undefined ? [] : [[step, declared] as const]
  })

  return {
    tokens: Object.fromEntries(
      declaredSteps.flatMap(([step, declared]) => {
        const size = parseDimensionValue(declared.size)
        // Unreachable past decode — the schema restricts `size` to px/rem — but
        // emitting a composite with no `fontSize` would be a malformed token,
        // and a conformant consumer would act on it. Skip rather than guess.
        if (size === undefined) return []

        const face = declared.font === undefined ? undefined : fonts?.[declared.font]
        const tracking = trackingOf(declared.letterSpacing)

        return [
          [
            step,
            {
              $type: 'typography',
              $value: {
                ...(face === undefined ? {} : { fontFamily: fontStack(face) }),
                fontSize: size,
                ...(declared.weight === undefined ? {} : { fontWeight: declared.weight }),
                ...(tracking === undefined ? {} : { letterSpacing: tracking }),
                ...(declared.lineHeight === undefined ? {} : { lineHeight: declared.lineHeight }),
              },
            },
          ] as const,
        ]
      })
    ),
    unmappable: Object.fromEntries(
      declaredSteps.flatMap(([step, declared]) =>
        declared.letterSpacing !== undefined && trackingOf(declared.letterSpacing) === undefined
          ? [[`design.typeScale.${step}.letterSpacing`, declared.letterSpacing] as const]
          : []
      )
    ),
  }
}

/** The font group: the inherited stacks, plus whatever the app declared. */
type FontToken = Readonly<{ $type: string; $value: readonly string[] }>

const projectFonts = (fonts: TypeScale['families']): Readonly<Record<string, FontToken>> => {
  const inherited: readonly (readonly [string, FontToken])[] = Object.entries(
    INHERITED_FONT_TOKENS
  ).map(([name, stack]) => [name, { $type: 'fontFamily', $value: [...stack] }])
  const declared: readonly (readonly [string, FontToken])[] = Object.entries(fonts ?? {}).map(
    ([name, font]) => [name, { $type: 'fontFamily', $value: fontStack(font) }]
  )
  return Object.fromEntries([...inherited, ...declared])
}

/**
 * Spread one key only when its value is present.
 *
 * The guidance layer is entirely optional, and an explicit `undefined` is NOT
 * the same as an absent key here: the contract is `.strict()`, so a key present
 * with no value would serialise as `null` and tell a consumer the author
 * declared something empty rather than declared nothing.
 */
const optional = <T>(key: string, value: T | undefined): Readonly<Record<string, T>> =>
  value === undefined ? {} : { [key]: value }

/** Voice, with its readonly arrays copied into the mutable shape the contract types. */
const projectVoice = (
  voice: NonNullable<NonNullable<App['design']>['voice']>
): Readonly<Record<string, unknown>> => ({
  ...optional('personality', voice.personality ? [...voice.personality] : undefined),
  ...optional('pronoun', voice.pronoun),
  ...optional('prefer', voice.prefer ? [...voice.prefer] : undefined),
  ...optional('avoid', voice.avoid ? [...voice.avoid] : undefined),
  ...optional('tone', voice.tone ? { ...voice.tone } : undefined),
})

/**
 * The zone map, each entry's override projected through {@link projectVoice}.
 *
 * Reusing `projectVoice` rather than writing a second projection is what keeps
 * an override the SAME SHAPE as the base it departs from: a consumer that can
 * read `voice.avoid` reads `zones[].voice.avoid` with no second code path, and
 * a field later added to `design.voice` cannot reach the base while silently
 * missing from the overrides. It type-checks because the override schema is the
 * base minus `personality`, which is optional here.
 *
 * `pattern` and `zone` are required by `DesignZoneSchema` and spread
 * unconditionally; `accentBudget` and `voice` go through {@link optional} for
 * the reason stated there.
 */
const projectZones = (
  zones: NonNullable<NonNullable<App['design']>['zones']>
): readonly Readonly<Record<string, unknown>>[] =>
  zones.map((entry) => ({
    pattern: entry.pattern,
    zone: entry.zone,
    ...optional('accentBudget', entry.accentBudget),
    ...optional('voice', entry.voice ? projectVoice(entry.voice) : undefined),
  }))

/**
 * Component guidance, gathered off the TEMPLATES and re-keyed by name.
 *
 * The published `$extensions.components` shape is unchanged — a record of
 * component name → guidance — because that is the shape every consumer of the
 * document reads (the markdown projection, the console's Components page, an
 * agent). What moved is the SOURCE: guidance now lives on the template it
 * describes (`components[].guidance`) rather than in a parallel
 * `design.components` record keyed by name.
 *
 * Templates without guidance are omitted rather than emitted empty, so the
 * document distinguishes "documented and says nothing" from "not documented" —
 * and so an app that documents none produces no key at all, which is what the
 * console's emptiness registry reads.
 */
const projectComponentGuidance = (
  components: App['components']
): Readonly<Record<string, unknown>> | undefined => {
  const documented = (components ?? []).flatMap((component) =>
    component.guidance ? [[component.name, structuredClone(component.guidance)] as const] : []
  )
  return documented.length === 0 ? undefined : Object.fromEntries(documented)
}

/** The Sovrium guidance layer, mirrored out of `design.*` with its readonly arrays copied. */
const projectGuidance = (app: App): Readonly<Record<string, unknown>> => {
  const declared = app.design ?? {}
  return {
    ...optional('principles', declared.principles ? [...declared.principles] : undefined),
    // Structural clones: the contract types mutable arrays, and these carry
    // readonly ones. `structuredClone` also guarantees the document holds no
    // live reference back into the decoded config.
    ...optional('logo', declared.logo ? structuredClone(declared.logo) : undefined),
    ...optional('imagery', declared.imagery ? structuredClone(declared.imagery) : undefined),
    ...optional('voice', declared.voice ? projectVoice(declared.voice) : undefined),
    ...optional(
      'colorRoles',
      declared.colorRoles ? structuredClone(declared.colorRoles) : undefined
    ),
    ...optional('components', projectComponentGuidance(app.components)),
    ...optional('zones', declared.zones ? projectZones(declared.zones) : undefined),
  }
}

/**
 * The easing group — the curves the app SHIPS, as DTCG `cubicBezier` tokens.
 *
 * ─── A PROMOTION, NOT A WIDENING ───────────────────────────────────────────
 *
 * A `cubic-bezier(x1, y1, x2, y2)` maps exactly onto DTCG's four-number
 * `cubicBezier` value, so filing one under `unmappable` reported it as
 * inexpressible when it is not. A CSS KEYWORD is a different case: `ease-in-out`
 * has no four-number form, and translating it into the bezier the spec says it
 * equals would be an interpretation. So the parser decides, and only what parses
 * is promoted.
 *
 * ─── AND WHY THE UNMAPPABLE HALF IS FILTERED ───────────────────────────────
 *
 * {@link projectGroup} reports every refused entry at `path.name`, which is a
 * CONFIG path. The inherited curves were never written in a config, so an
 * inherited value that failed to parse would be reported at a line its reader
 * never wrote — a platform defect dressed as an authoring mistake. Only the
 * author's own declarations are reported. All four inherited curves parse
 * today, so this filter changes nothing now and is what keeps it honest if one
 * ever stops.
 */
const projectEasing = (design: Design | undefined) => {
  const declared = easingTokensOf(design)
  const group = projectGroup({
    entries: { ...INHERITED_EASING_TOKENS, ...declared },
    parse: parseCubicBezierValue,
    type: 'cubicBezier',
    path: EASING_PATH,
  })
  return {
    tokens: group.tokens,
    unmappable: Object.fromEntries(
      Object.keys(declared)
        .map((name) => [`${EASING_PATH}.${name}`, group.unmappable[`${EASING_PATH}.${name}`]])
        .filter((entry): entry is [string, string] => entry[1] !== undefined)
    ),
  }
}

/**
 * The elevation ramp the app SHIPS, each step saying who chose it.
 *
 * ─── THE MERGE, AND WHY IT NEEDS PROVENANCE TO BE HONEST ───────────────────
 *
 * Foundations draws `{ ...INHERITED, ...declared }`, and an export reporting
 * only the subset the config names would document a different system than the
 * console does — the failure `[internal ref]` already argues for
 * breakpoints, where inheritance is precisely what an author cannot learn from
 * their own config.
 *
 * But a BARE merge is worse than either half for the reader this export is for.
 * An agent handed five shadows cannot tell the one that was decided from the
 * four the platform supplied, so it preserves defaults as though they were
 * intentional. `provenance` is the whole difference.
 *
 * ─── THIS DOES NOT PUT A SHADOW IN THE TOKEN TREE ──────────────────────────
 *
 * A DTCG `shadow` needs a decomposed `{color, offsetX, offsetY, blur, spread}`
 * and three of the five inherited steps are two-layer, so the tree still emits
 * no `shadow` group and a declared value still reaches `unmappable` verbatim.
 * The extension is the reverse-domain escape hatch, not a DTCG mapping, so a
 * structured ramp here says nothing about the tree — `-015` asserts both halves
 * and both hold.
 */
const projectShadows = (
  design: Design | undefined
): Readonly<Record<string, { readonly value: string; readonly provenance: string }>> => {
  const declared = design?.elevation ?? {}
  return Object.fromEntries(
    Object.entries({ ...INHERITED_SHADOW_TOKENS, ...declared }).map(([name, value]) => [
      name,
      { value, provenance: name in declared ? 'declared' : 'inherited' },
    ])
  )
}

/**
 * Project every DTCG token group the document publishes.
 *
 * Each group merges the INHERITED default over which the author's declarations
 * are laid — an app that declared nothing still gets a complete system, and one
 * that declared `primary` overrides only that.
 */
const projectTokenGroups = (
  design: Design | undefined,
  roles: NonNullable<App['design']>['colorRoles']
) => ({
  color: projectGroup({
    entries: { ...INHERITED_COLOR_TOKENS, ...(design?.colors ?? {}) },
    parse: parseColorValue,
    type: 'color',
    path: 'design.colors',
    describe: (name) => roles?.[name]?.usage,
  }),
  spacing: projectGroup({
    entries: { ...INHERITED_SPACING_TOKENS, ...(design?.spacing ?? {}) },
    parse: parseDimensionValue,
    type: 'dimension',
    path: 'design.spacing',
  }),
  radius: projectGroup({
    entries: { ...INHERITED_RADIUS_TOKENS, ...(design?.radius ?? {}) },
    parse: parseDimensionValue,
    type: 'dimension',
    path: 'design.radius',
  }),
  breakpoint: projectGroup({
    // Tailwind's default scale UNDER the author's, because `design.breakpoints`
    // overrides one entry of it rather than replacing it: an app declaring only
    // `md` still responds at `lg`, and reporting just `md` would describe the
    // config rather than the app.
    entries: { ...INHERITED_BREAKPOINT_TOKENS, ...(design?.breakpoints ?? {}) },
    parse: parseDimensionValue,
    type: 'dimension',
    path: 'design.breakpoints',
  }),
  duration: projectGroup({
    entries: { ...INHERITED_DURATION_TOKENS, ...durationTokensOf(design) },
    parse: parseDurationValue,
    type: 'duration',
    path: 'design.motion.durations',
  }),
  easing: projectEasing(design),
})

/**
 * Every declaration that ships but has no faithful DTCG form, keyed by its
 * config path so an author can find the line that produced it.
 */
const collectUnmappable = (
  groups: Readonly<ReturnType<typeof projectTokenGroups>>,
  design: Design | undefined,
  typography: Readonly<{ unmappable: Readonly<Record<string, string>> }>
): Readonly<Record<string, string>> => ({
  ...typography.unmappable,
  ...groups.color.unmappable,
  ...groups.spacing.unmappable,
  ...groups.radius.unmappable,
  ...groups.breakpoint.unmappable,
  ...groups.duration.unmappable,
  ...collectUnmappableFontFields(design?.typeScale?.families),
  // DTCG `shadow` requires a decomposed `{color, offsetX, offsetY, blur,
  // spread}`. Parsing arbitrary `box-shadow` syntax back into those five parts
  // fails in exactly the cases that matter — multiple layers, `inset`, colour
  // functions — so v1 emits NO shadow group rather than a malformed one.
  ...atPath(design?.elevation, 'design.elevation'),
  // A dark palette is perfectly expressible in DTCG; a SINGLE-MODE document has
  // nowhere to put it. Kept verbatim so the author can see the engine received
  // it, rather than dropped or flattened into the light tokens.
  ...atPath(design?.darkColors, 'design.darkColors'),
  // The OTHER half of `design.motion?.animations`, and only the part of it that has no
  // DTCG form. Its `duration` sibling has always been a real token group; the
  // easing half is one now too — a `cubic-bezier(...)` maps exactly onto DTCG's
  // four-number `cubicBezier`, so the promotion `projectEasing` performs was
  // owed rather than optional.
  //
  // What reaches here is what still cannot be carried: a CSS keyword such as
  // `ease-in-out`, which a four-number array has no room for. It is reported
  // rather than left out because SILENCE is the one outcome the honesty
  // contract forbids — an author told nothing cannot tell "Sovrium applied it"
  // from "Sovrium threw it away", and goes on maintaining a dead line.
  //
  // A promoted curve is NOT also reported here. Leaving it in both places would
  // let a reader believe it is still inexpressible; the move is the point.
  ...groups.easing.unmappable,
})

/**
 * Build the DTCG document describing the design system this app actually ships.
 *
 * @param app - A decoded app config. There is one position for the design
 *   system, so nothing is mirrored on the way in.
 * @returns The document, ready to serve as JSON or to project into markdown.
 */
/**
 * Everything under the Sovrium extension key: the guidance prose, the shadows
 * that have no DTCG home, the platform catalogue, and the two report sections
 * that are omitted rather than emitted empty.
 *
 * Its own function so `buildDesignSystem` stays a flat projection. The two
 * omissions are the only branches in this document, and they are here.
 */
const sovriumExtension = (
  app: App,
  design: Design | undefined,
  unmappable: Readonly<Record<string, string>>,
  inert: readonly InertEntry[]
): Readonly<Record<string, unknown>> => ({
  ...projectGuidance(app),
  shadows: projectShadows(design),
  // The catalogue is the PLATFORM's, not the operator's: it is the same for
  // every app on a given build, and it is here because it is the one thing an
  // agent building from this document cannot derive from the tokens — which
  // types exist, and which of them will render nothing.
  catalogue: [...projectCatalogue()],
  ...(Object.keys(unmappable).length > 0 ? { unmappable } : {}),
  ...(inert.length > 0 ? { inert: [...inert] } : {}),
})

export function buildDesignSystem(app: App): Readonly<DesignSystemDocument> {
  const { design } = app
  const typeScale = design?.typeScale
  const families = typeScale?.families
  const groups = projectTokenGroups(design, design?.colorRoles)
  const typography = projectTypography(typeScale?.steps, families)

  return {
    $description: `The design system of ${app.name}, as it actually ships.`,
    color: groups.color.tokens,
    spacing: groups.spacing.tokens,
    radius: groups.radius.tokens,
    breakpoint: groups.breakpoint.tokens,
    font: projectFonts(families),
    typography: typography.tokens,
    duration: groups.duration.tokens,
    easing: groups.easing.tokens,
    $extensions: {
      [SOVRIUM_EXTENSION_KEY]: sovriumExtension(
        app,
        design,
        collectUnmappable(groups, design, typography),
        collectInertFontFields(families)
      ),
    },
  } as DesignSystemDocument
}
