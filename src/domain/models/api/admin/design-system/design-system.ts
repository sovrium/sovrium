/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * API contract for `GET /api/admin/design-system.json`.
 *
 * A **W3C Design Tokens Format Module (DTCG) 2025.10** document describing the
 * running app's design system, plus the Sovrium-specific guidance layer
 * (principles, voice, colour roles, component usage) carried in `$extensions`.
 *
 * Source story: [internal ref]
 *
 * ─── AUTHORISATION ──────────────────────────────────────────────────────────
 *
 * Named by [internal ref] **amendment A2**, which is DRAFTED AND NOT YET RATIFIED.
 * The contract is authored ahead of ratification; the specs sit RED until it
 * lands. Same invariant as A1: reading is observability, mutating is
 * authoring. There is no request schema in this module because there is
 * nothing to write to, and A2 forbids an export-then-reimport round trip
 * outright —, which asserts the ABSENCE of a
 * write route rather than trusting the absence of a schema.
 *
 * ─── THE CONFIDENTIALITY BOUND ──────────────────────────────────────────────
 *
 * This projection reads `design.*` and `theme.*` and NOTHING ELSE. In
 * particular it never resolves an `app.env[]` VALUE: `app.env[]` declares
 * variable NAMES, and resolving one here would re-implement `/_admin/env`
 * without A1's redaction condition — which A1 itself defines as an
 * unauthorised surface. It carries no table DATA either, for the same reason:
 * a design system describes how an app looks, not what is in it.
 *
 * `.strict()` throughout is part of that bound rather than mere tidiness: a
 * closed response object means an implementer cannot smuggle an extra field
 * into the payload without the contract rejecting it first.
 *
 * ─── WHY THE COLOUR VALUE IS AN OBJECT AND NOT A HEX STRING ─────────────────
 *
 * DTCG 2025.10 defines a colour `$value` as an OBJECT carrying `colorSpace`
 * and `components`, with `alpha` and `hex` optional — NOT the bare
 * `"#6b7f5e"` string that earlier drafts and most in-house token files use.
 * Verified against the published draft rather than recalled. Emitting a hex
 * string here would produce a document that looks like DTCG and fails every
 * conformant consumer.
 *
 * `hex` is populated whenever the authored value was hexadecimal, which is
 * what makes round-trip fidelity assertable: the
 * operator's declared `#6b7f5e` survives verbatim in a standard field.
 *
 * ─── WHAT IS DELIBERATELY NOT IN THE TOKEN TREE ─────────────────────────────
 *
 * DTCG's structured value types cannot represent an arbitrary CSS string, and
 * bending one to fit is worse than omitting it — a malformed `dimension` or
 * `shadow` is a lie a conformant tool will act on.
 *
 *  - **Shadows.** `theme.shadows.md` is a raw CSS string
 *    (`'0 4px 6px -1px rgb(0 0 0 / 0.1)'`). DTCG `shadow` REQUIRES a decomposed
 *    `{color, offsetX, offsetY, blur, spread}`. Parsing arbitrary `box-shadow`
 *    syntax back into those five parts is error-prone in exactly the cases
 *    that matter (multiple layers, `inset`, colour functions), so v1 emits NO
 *    `shadow` group and records the raw declarations under `$extensions`.
 *  - **Non-convertible dimensions.** `spacing: '4rem'` becomes
 *    `{value: 4, unit: 'rem'}`. `spacing: 'clamp(1rem, 2vw, 3rem)'` has no
 *    DTCG dimension form at all, so it is NOT emitted as a dimension — it goes
 *    to `$extensions` with its raw text intact.
 * - **The inert font fields**. See `inertDeclarationSchema`.
 *
 * @see https://www.designtokens.org/tr/drafts/format/
 * @see [internal ref] (A2, draft)
 */

import { z } from '@hono/zod-openapi'

/**
 * The `$extensions` namespace key.
 *
 * DTCG recommends reverse domain name notation and requires tools to preserve
 * extension data they do not understand — which is precisely the contract that
 * lets Sovrium's voice layer ride inside a standard token document without
 * corrupting it for a consumer that only speaks DTCG.
 */
export const SOVRIUM_EXTENSION_KEY = 'com.sovrium.design-system' as const

// ---------------------------------------------------------------------------
// DTCG value shapes
// ---------------------------------------------------------------------------

/**
 * A DTCG colour value.
 *
 * `colorSpace` + `components` are the required pair. `hex` is the optional
 * serialization hint, and is the field a round-trip assertion reads.
 */
export const dtcgColorValueSchema = z
  .object({
    colorSpace: z.string().describe("Colour space of `components`, e.g. 'srgb'"),
    components: z.array(z.number()).describe('Channel values within the declared colour space'),
    alpha: z.number().min(0).max(1).optional().describe('Alpha channel, 0–1'),
    hex: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .optional()
      .describe('Hex fallback — populated verbatim when the authored value was hexadecimal'),
  })
  .strict()
  .openapi('DtcgColorValue')

/** A DTCG dimension value — a number plus `px` or `rem`, never a raw CSS string. */
export const dtcgDimensionValueSchema = z
  .object({
    value: z.number().describe('Numeric magnitude'),
    unit: z.enum(['px', 'rem']).describe('DTCG permits only these two units'),
  })
  .strict()
  .openapi('DtcgDimensionValue')

/** A DTCG duration value — a number plus `ms` or `s`. */
export const dtcgDurationValueSchema = z
  .object({
    value: z.number().describe('Numeric magnitude'),
    unit: z.enum(['ms', 's']).describe('DTCG permits only these two units'),
  })
  .strict()
  .openapi('DtcgDurationValue')

// ---------------------------------------------------------------------------
// DTCG tokens
// ---------------------------------------------------------------------------

const withDescription = { $description: z.string().optional() }

export const dtcgColorTokenSchema = z
  .object({ $type: z.literal('color'), $value: dtcgColorValueSchema, ...withDescription })
  .strict()
  .openapi('DtcgColorToken')

export const dtcgDimensionTokenSchema = z
  .object({ $type: z.literal('dimension'), $value: dtcgDimensionValueSchema, ...withDescription })
  .strict()
  .openapi('DtcgDimensionToken')

export const dtcgDurationTokenSchema = z
  .object({ $type: z.literal('duration'), $value: dtcgDurationValueSchema, ...withDescription })
  .strict()
  .openapi('DtcgDurationToken')

/**
 * A DTCG `typography` COMPOSITE value — the app's type scale, one step per token.
 *
 * Verified against the published draft rather than recalled, because the same
 * class of mistake already bit this file once (DTCG types a colour `$value` as
 * an OBJECT, not the hex string every in-house token file uses). The composite
 * names five sub-values, and two of them are NOT what a CSS author would guess:
 *
 *  - `fontSize` and `letterSpacing` are **dimensions** — `{value, unit}` with
 *    `unit` restricted to `px` or `rem`. Not CSS strings.
 *  - `lineHeight` is a **number**, NOT a dimension. A unitless ratio, so
 *    `'24px'` has no representation here at all. `design.typeScale` types it as
 *    a number for exactly this reason, which also happens to be the better
 *    practice: a ratio survives a size change, a fixed leading does not.
 *
 * Every member except `fontSize` is optional here. A step declaring only a size
 * is a real and common state — the rest inherit — and inventing values to fill
 * the composite would put numbers into the document that the app does not
 * render, which is the failure `inertDeclarationSchema` exists to prevent.
 *
 * `letterSpacing` in `em` is the one member that can be present in the config
 * and absent here: `em` is the idiomatic tracking unit and DTCG has no form for
 * it, so it is honoured in CSS and reported by path under `unmappable`.
 *
 * @see https://www.designtokens.org/tr/drafts/format/ (§ Typography composite type)
 */
export const dtcgTypographyValueSchema = z
  .object({
    fontFamily: z
      .union([z.string(), z.array(z.string())])
      .optional()
      .describe('Resolved font stack for this step, when it names a declared face'),
    fontSize: dtcgDimensionValueSchema.describe('Rendered size of this step'),
    fontWeight: z.number().min(1).max(1000).optional().describe('Weight, 1–1000 per DTCG'),
    letterSpacing: dtcgDimensionValueSchema
      .optional()
      .describe('Tracking. Absent when the author declared it in `em`, which DTCG cannot carry'),
    lineHeight: z
      .number()
      .optional()
      .describe('Leading as a UNITLESS RATIO — DTCG types this as a number, not a dimension'),
  })
  .strict()
  .openapi('DtcgTypographyValue')

export const dtcgTypographyTokenSchema = z
  .object({
    $type: z.literal('typography'),
    $value: dtcgTypographyValueSchema,
    ...withDescription,
  })
  .strict()
  .openapi('DtcgTypographyToken')

/** DTCG permits a single font name or an ordered stack. */
export const dtcgFontFamilyTokenSchema = z
  .object({
    $type: z.literal('fontFamily'),
    $value: z.union([z.string(), z.array(z.string())]),
    ...withDescription,
  })
  .strict()
  .openapi('DtcgFontFamilyToken')

// ---------------------------------------------------------------------------
// The Sovrium guidance layer, carried in `$extensions`
// ---------------------------------------------------------------------------

/** Per-token usage guidance, mirroring `design.colorRoles`. */
export const colorRoleGuidanceSchema = z
  .object({
    usage: z.string().optional().describe('What this colour is for, and what it must not be used for'),
    pairsWith: z.string().optional().describe('The token this one is designed to sit against'),
  })
  .strict()
  .openapi('ColorRoleGuidance')

/** Per-component usage guidance, mirroring `design.components`. */
export const componentGuidanceSchema = z
  .object({
    usage: z.string().optional(),
    when: z.string().optional(),
    dont: z.string().optional(),
  })
  .strict()
  .openapi('ComponentGuidance')

/**
 * The mark and its placement rules, mirroring `design.logo`.
 *
 * `src` / `srcDark` are carried VERBATIM as the author declared them —
 * root-relative or `https://`, never rewritten to an absolute URL. A design
 * system that silently absolutised its own asset paths would publish a document
 * that only resolves against the host it was generated on, which is precisely
 * the property that makes a charter shareable.
 */
export const logoGuidanceSchema = z
  .object({
    src: z.string().describe('The primary mark, as declared'),
    srcDark: z.string().optional().describe('The variant shown in dark mode (the light-ink file)'),
    alt: z.string().describe('Accessible name of the mark'),
    clearSpace: z.string().optional().describe('Exclusion zone, stated relative to the mark'),
    minWidth: z.string().optional().describe('Smallest reproduction width'),
    misuse: z.array(z.string()).optional().describe('What must never be done to the mark'),
  })
  .strict()
  .openapi('LogoGuidance')

/** Imagery and iconography rules, mirroring `design.imagery`. */
export const imageryGuidanceSchema = z
  .object({
    principles: z.array(z.string()).optional(),
    photography: z.array(z.string()).optional(),
    iconSet: z.string().optional(),
    patterns: z.array(z.string()).optional(),
  })
  .strict()
  .openapi('ImageryGuidance')

/** Voice and tone, mirroring `design.voice`. */
export const voiceGuidanceSchema = z
  .object({
    personality: z.array(z.string()).optional(),
    pronoun: z.string().optional(),
    prefer: z.array(z.string()).optional(),
    avoid: z.array(z.string()).optional(),
    tone: z
      .object({
        empty: z.string().optional(),
        loading: z.string().optional(),
        error: z.string().optional(),
        success: z.string().optional(),
        destructive: z.string().optional(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .openapi('VoiceGuidance')

/**
 * A per-zone voice override, mirroring `design.zones[].voice`.
 *
 * DERIVED from {@link voiceGuidanceSchema} rather than re-typed, because it IS
 * the base voice minus one field, and re-typing it would let the two drift: a
 * field added to `design.voice` would reach the base contract and silently miss
 * the overrides, which is the exact shape of the bug that kept `design.imagery`
 * out of the console. `.omit()` preserves `.strict()`, so this rejects an
 * unknown key AND rejects `personality` by name.
 *
 * `personality` is absent deliberately, mirroring `ZoneVoiceOverrideSchema`: it
 * is app IDENTITY, not situational register. A zone that is a different
 * personality is a different app.
 */
export const zoneVoiceGuidanceSchema = voiceGuidanceSchema
  .omit({ personality: true })
  .openapi('ZoneVoiceGuidance')

/**
 * One zone of the app's zone map, mirroring `design.zones[]`.
 *
 * A voice override here is per-FIELD: a declared field replaces the same field
 * of `design.voice` for the routes this pattern governs, and an undeclared one
 * inherits. The document carries only what the author DECLARED — resolving the
 * inheritance into each entry would publish the base voice five times over and
 * leave no consumer able to tell an override from an inherited default.
 */
export const designZoneGuidanceSchema = z
  .object({
    pattern: z
      .string()
      .describe("Declared route pattern this zone governs, or the catch-all 'everything else'"),
    zone: z.string().describe('The zone this pattern belongs to'),
    accentBudget: z
      .enum(['public', 'product'])
      .optional()
      .describe('Which accent budget the zone carries'),
    voice: zoneVoiceGuidanceSchema
      .optional()
      .describe('How this zone departs from `design.voice`, field by field'),
  })
  .strict()
  .openapi('DesignZoneGuidance')

/**
 * One declared-but-inert theme value.
 *
 * THE HONEST REPRESENTATION OF A FIELD THE RENDERER DISCARDS, and the reason
 * this schema exists at all: an agent handed this document will OBEY it, so a
 * value that validates and then reaches nothing must never appear in the token
 * tree as though it ships.
 *
 * Three candidate representations were considered:
 *
 *  - **Emit it as a live token.** Refused outright — it is the failure this
 *    whole export is supposed to prevent.
 *  - **`$deprecated: '<explanation>'`.** DTCG does define `$deprecated` with a
 *    string form, and a conformant consumer understands it. But "deprecated"
 *    means *this worked and is going away*; these fields never worked. Using
 *    it would be standard-conformant and semantically false, and the token
 *    would still sit in the tree for a naive consumer to emit.
 *  - **Omit from the tree AND record here.** Chosen. The token tree then
 *    contains only what actually ships — so no consumer can act on a phantom —
 *    while the author's declaration is not silently swallowed: they can see
 *    that Sovrium received it and did nothing with it, which is the fact they
 *    need in order to stop maintaining it.
 */
export const inertDeclarationSchema = z
  .object({
    path: z.string().describe("Config path of the declaration, e.g. 'theme.fonts.body.lineHeight'"),
    declared: z.string().describe('The value the author wrote, verbatim'),
    reason: z.string().describe('Why it does not reach the rendered app'),
  })
  .strict()
  .openapi('InertDeclaration')

/** Everything Sovrium adds that DTCG has no home for. */
export const sovriumDesignExtensionSchema = z
  .object({
    principles: z.array(z.string()).optional(),
    logo: logoGuidanceSchema.optional(),
    imagery: imageryGuidanceSchema.optional(),
    voice: voiceGuidanceSchema.optional(),
    colorRoles: z.record(z.string(), colorRoleGuidanceSchema).optional(),
    components: z.record(z.string(), componentGuidanceSchema).optional(),
    /** The zone map — which route family is which register. See {@link designZoneGuidanceSchema}. */
    zones: z.array(designZoneGuidanceSchema).optional(),
    /** Raw CSS declarations with no faithful DTCG form (shadows, `clamp()` spacing, …). */
    unmappable: z.record(z.string(), z.string()).optional(),
    /** Declared values the renderer discards — see `inertDeclarationSchema`. */
    inert: z.array(inertDeclarationSchema).optional(),
  })
  .strict()
  .openapi('SovriumDesignExtension')

export const designSystemExtensionsSchema = z
  .object({ [SOVRIUM_EXTENSION_KEY]: sovriumDesignExtensionSchema })
  .strict()
  .openapi('DesignSystemExtensions')

// ---------------------------------------------------------------------------
// The document
// ---------------------------------------------------------------------------

/**
 * The DTCG document served at `GET /api/admin/design-system.json`.
 *
 * Top-level keys are GROUPS (DTCG: an object without `$value`), named after
 * the theme sections they project. `$extensions` is legal on a group, and the
 * document root is a group.
 *
 * There is deliberately no `shadow` group — see the module header.
 */
export const designSystemDocumentSchema = z
  .object({
    $description: z.string().describe('One line naming the app this document describes'),
    color: z.record(z.string(), dtcgColorTokenSchema).describe('Colour tokens'),
    spacing: z.record(z.string(), dtcgDimensionTokenSchema).describe('Spacing scale'),
    radius: z.record(z.string(), dtcgDimensionTokenSchema).describe('Border radii'),
    breakpoint: z.record(z.string(), dtcgDimensionTokenSchema).describe('Responsive thresholds'),
    font: z.record(z.string(), dtcgFontFamilyTokenSchema).describe('Font families'),
    typography: z
      .record(z.string(), dtcgTypographyTokenSchema)
      .describe('The type scale — one composite token per declared step, in ladder order'),
    duration: z.record(z.string(), dtcgDurationTokenSchema).describe('Animation durations'),
    $extensions: designSystemExtensionsSchema,
  })
  .strict()
  .openapi('DesignSystemDocument')

/** @public */
export type DesignSystemDocument = z.infer<typeof designSystemDocumentSchema>
/** @public */
export type DtcgTypographyValue = z.infer<typeof dtcgTypographyValueSchema>
/** @public */
export type SovriumDesignExtension = z.infer<typeof sovriumDesignExtensionSchema>
/** @public */
export type InertDeclaration = z.infer<typeof inertDeclarationSchema>
