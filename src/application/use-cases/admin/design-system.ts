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
 * This reads `app.design.*` (equivalently the deprecated top-level `app.theme`,
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
 * ([internal ref]: `fonts.*.lineHeight` reaches nothing; `fonts.*.size` and
 *    `.weights` reach only the legacy `hero` section renderer). Each entry
 *    carries the REASON, so the author can stop maintaining it. These three are
 * now SUPERSEDED by `design.typeScale` and are still reported
 *    here, because supersession does not make a declaration take effect — the
 *    author needs to see that Sovrium received the value and did nothing with
 *    it, which is the fact that lets them stop maintaining it.
 *  - **`unmappable`** — real, shipped values with no faithful DTCG form: a
 *    multi-layer `box-shadow`, a `clamp()` spacing step, a dark-mode palette in
 *    a single-mode document. Their raw text is preserved verbatim.
 */

import { SOVRIUM_EXTENSION_KEY } from '@/domain/models/api/admin/design-system'
import { TYPE_SCALE_STEPS } from '@/domain/models/app/design/type-scale'
import {
  INHERITED_BREAKPOINT_TOKENS,
  INHERITED_COLOR_TOKENS,
  INHERITED_DURATION_TOKENS,
  INHERITED_FONT_TOKENS,
  INHERITED_RADIUS_TOKENS,
  INHERITED_SPACING_TOKENS,
} from '@/domain/services/design-system/inherited-tokens'
import {
  parseColorValue,
  parseDimensionValue,
  parseDurationValue,
} from '@/domain/services/design-system/token-values'
import type { DesignSystemDocument } from '@/domain/models/api/admin/design-system'
import type { App } from '@/domain/models/app'
import type { TypeScale } from '@/domain/models/app/design/type-scale'
import type { Theme } from '@/domain/models/app/theme'

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
  size: 'Reaches only the legacy `hero` section renderer as an inline font size. It never becomes a CSS variable, so no other surface honours it.',
  weights:
    'Only the first entry reaches the legacy `hero` section renderer. No additional font face is loaded, so the extra weights render as synthetic bolding or not at all.',
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
const collectInertFontFields = (fonts: Theme['fonts']): readonly InertEntry[] =>
  Object.entries(fonts ?? {}).flatMap(([category, font]) =>
    Object.entries(INERT_FONT_FIELDS).flatMap(([field, reason]) => {
      const declared = (font as Readonly<Record<string, unknown>>)[field]
      return declared === undefined
        ? []
        : [
            {
              path: `design.theme.fonts.${category}.${field}`,
              declared: asDeclaredText(declared),
              reason,
            },
          ]
    })
  )

/** Font fields that ship but this document cannot type. */
const collectUnmappableFontFields = (fonts: Theme['fonts']): Readonly<Record<string, string>> =>
  Object.fromEntries(
    Object.entries(fonts ?? {}).flatMap(([category, font]) =>
      UNMAPPABLE_FONT_FIELDS.flatMap((field) => {
        const declared = (font as Readonly<Record<string, unknown>>)[field]
        return declared === undefined
          ? []
          : [[`design.theme.fonts.${category}.${field}`, asDeclaredText(declared)] as const]
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
 * The `duration` sub-record of `theme.animations`, when the author used the
 * nested token form rather than the legacy flat animation names.
 */
const durationTokensOf = (theme: Theme | undefined): Readonly<Record<string, string>> => {
  const durations = theme?.animations?.['duration']
  if (typeof durations !== 'object' || durations === null || Array.isArray(durations)) return {}
  return Object.fromEntries(
    Object.entries(durations as Readonly<Record<string, unknown>>).flatMap(([name, value]) =>
      typeof value === 'string' ? [[name, value] as const] : []
    )
  )
}

/**
 * The `typography` group: one DTCG composite token per declared type-scale step.
 *
 * ─── WHY THIS GROUP EXISTS AND THE INERT FONT FIELDS STILL DO NOT ───────────
 *
 * `theme.fonts.*.size` and `.lineHeight` are reported under `inert` — declared,
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
  typeScale: TypeScale | undefined,
  fonts: Theme['fonts']
): Projection<{
  $type: string
  $value: Readonly<Record<string, unknown>>
}> => {
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

const projectFonts = (fonts: Theme['fonts']): Readonly<Record<string, FontToken>> => {
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

/** The Sovrium guidance layer, mirrored out of `design.*` with its readonly arrays copied. */
const projectGuidance = (design: App['design']): Readonly<Record<string, unknown>> => {
  const declared = design ?? {}
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
    ...optional(
      'components',
      declared.components ? structuredClone(declared.components) : undefined
    ),
    ...optional('zones', declared.zones ? projectZones(declared.zones) : undefined),
  }
}

/**
 * Project every DTCG token group the document publishes.
 *
 * Each group merges the INHERITED default over which the author's declarations
 * are laid — an app that declared nothing still gets a complete system, and one
 * that declared `primary` overrides only that.
 */
const projectTokenGroups = (
  theme: Theme | undefined,
  roles: NonNullable<App['design']>['colorRoles']
) => ({
  color: projectGroup({
    entries: { ...INHERITED_COLOR_TOKENS, ...(theme?.colors ?? {}) },
    parse: parseColorValue,
    type: 'color',
    path: 'design.theme.colors',
    describe: (name) => roles?.[name]?.usage,
  }),
  spacing: projectGroup({
    entries: { ...INHERITED_SPACING_TOKENS, ...(theme?.spacing ?? {}) },
    parse: parseDimensionValue,
    type: 'dimension',
    path: 'design.theme.spacing',
  }),
  radius: projectGroup({
    entries: { ...INHERITED_RADIUS_TOKENS, ...(theme?.borderRadius ?? {}) },
    parse: parseDimensionValue,
    type: 'dimension',
    path: 'design.theme.borderRadius',
  }),
  breakpoint: projectGroup({
    // Tailwind's default scale UNDER the author's, because `theme.breakpoints`
    // overrides one entry of it rather than replacing it: an app declaring only
    // `md` still responds at `lg`, and reporting just `md` would describe the
    // config rather than the app.
    entries: { ...INHERITED_BREAKPOINT_TOKENS, ...(theme?.breakpoints ?? {}) },
    parse: parseDimensionValue,
    type: 'dimension',
    path: 'design.theme.breakpoints',
  }),
  duration: projectGroup({
    entries: { ...INHERITED_DURATION_TOKENS, ...durationTokensOf(theme) },
    parse: parseDurationValue,
    type: 'duration',
    path: 'design.theme.animations.duration',
  }),
})

/**
 * Every declaration that ships but has no faithful DTCG form, keyed by its
 * config path so an author can find the line that produced it.
 */
const collectUnmappable = (
  groups: Readonly<ReturnType<typeof projectTokenGroups>>,
  theme: Theme | undefined,
  typography: Readonly<{ unmappable: Readonly<Record<string, string>> }>
): Readonly<Record<string, string>> => ({
  ...typography.unmappable,
  ...groups.color.unmappable,
  ...groups.spacing.unmappable,
  ...groups.radius.unmappable,
  ...groups.breakpoint.unmappable,
  ...groups.duration.unmappable,
  ...collectUnmappableFontFields(theme?.fonts),
  // DTCG `shadow` requires a decomposed `{color, offsetX, offsetY, blur,
  // spread}`. Parsing arbitrary `box-shadow` syntax back into those five parts
  // fails in exactly the cases that matter — multiple layers, `inset`, colour
  // functions — so v1 emits NO shadow group rather than a malformed one.
  ...atPath(theme?.shadows, 'design.theme.shadows'),
  // A dark palette is perfectly expressible in DTCG; a SINGLE-MODE document has
  // nowhere to put it. Kept verbatim so the author can see the engine received
  // it, rather than dropped or flattened into the light tokens.
  ...atPath(theme?.darkColors, 'design.theme.darkColors'),
})

/**
 * Build the DTCG document describing the design system this app actually ships.
 *
 * @param app - A decoded, normalized app config. `normalizeAppDesign` has
 *   already mirrored a deprecated top-level `theme` onto `design.theme`, so
 *   both authored positions arrive here as one.
 * @returns The document, ready to serve as JSON or to project into markdown.
 */
export function buildDesignSystem(app: App): Readonly<DesignSystemDocument> {
  const theme = app.design?.theme ?? app.theme
  const groups = projectTokenGroups(theme, app.design?.colorRoles)
  const typography = projectTypography(app.design?.typeScale, theme?.fonts)
  const unmappable = collectUnmappable(groups, theme, typography)
  const inert = collectInertFontFields(theme?.fonts)

  return {
    $description: `The design system of ${app.name}, as it actually ships.`,
    color: groups.color.tokens,
    spacing: groups.spacing.tokens,
    radius: groups.radius.tokens,
    breakpoint: groups.breakpoint.tokens,
    font: projectFonts(theme?.fonts),
    typography: typography.tokens,
    duration: groups.duration.tokens,
    $extensions: {
      [SOVRIUM_EXTENSION_KEY]: {
        ...projectGuidance(app.design),
        ...(Object.keys(unmappable).length > 0 ? { unmappable } : {}),
        ...(inert.length > 0 ? { inert: [...inert] } : {}),
      },
    },
  } as DesignSystemDocument
}
