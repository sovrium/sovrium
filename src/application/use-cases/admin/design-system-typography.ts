/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The font and type-scale half of `buildDesignSystem`: the `font` and
 * `typography` token groups, and the font fields that are reported rather than
 * typed — `inert` (declared, then read by nothing) and `unmappable` (shipped,
 * but with no DTCG member to carry them). Pure projections of `design.typeScale`.
 */

import { INHERITED_FONT_TOKENS } from '@/domain/models/app/design/inherited-tokens'
import { parseDimensionValue } from '@/domain/models/app/design/token-value-dtcg-service'
import { TYPE_SCALE_STEPS } from '@/domain/models/app/design/type-scale'
import type { DesignSystemDocument } from '@/domain/models/api/admin/design-system'
import type { TypeScale, TypeScaleSteps } from '@/domain/models/app/design/type-scale'

/** One declared value the renderer discards, with the reason it does. */
export interface InertEntry {
  readonly path: string
  readonly declared: string
  readonly reason: string
}

/** A token group plus the declarations that could not enter it. */
export interface Projection<T> {
  readonly tokens: Readonly<Record<string, T>>
  readonly unmappable: Readonly<Record<string, string>>
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
export const collectInertFontFields = (fonts: TypeScale['families']): readonly InertEntry[] =>
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
export const collectUnmappableFontFields = (
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

export const projectTypography = (
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

export const projectFonts = (fonts: TypeScale['families']): Readonly<Record<string, FontToken>> => {
  const inherited: readonly (readonly [string, FontToken])[] = Object.entries(
    INHERITED_FONT_TOKENS
  ).map(([name, stack]) => [name, { $type: 'fontFamily', $value: [...stack] }])
  const declared: readonly (readonly [string, FontToken])[] = Object.entries(fonts ?? {}).map(
    ([name, font]) => [name, { $type: 'fontFamily', $value: fontStack(font) }]
  )
  return Object.fromEntries([...inherited, ...declared])
}
