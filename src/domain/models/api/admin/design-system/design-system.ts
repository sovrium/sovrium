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

import { Schema, Struct } from 'effect'
import { optionalField } from '@/domain/models/api/combinators/optional-field'

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
export const dtcgColorValueSchema = Schema.Struct({
  colorSpace: Schema.String.annotate({ description: "Colour space of `components`, e.g. 'srgb'" }),
  components: Schema.Array(Schema.Finite).annotate({
    description: 'Channel values within the declared colour space',
  }),
  alpha: optionalField(
    Schema.Finite.annotate({ description: 'Alpha channel, 0–1' }).pipe(
      Schema.check(Schema.isGreaterThanOrEqualTo(0), Schema.isLessThanOrEqualTo(1))
    )
  ),
  hex: optionalField(
    Schema.String.annotate({
      description: 'Hex fallback — populated verbatim when the authored value was hexadecimal',
    }).pipe(Schema.check(Schema.isPattern(/^#[0-9a-fA-F]{6}$/)))
  ),
}).annotate({ strictKeys: true, title: 'sovrium:strict-keys', identifier: 'DtcgColorValue' })

/** A DTCG dimension value — a number plus `px` or `rem`, never a raw CSS string. */
export const dtcgDimensionValueSchema = Schema.Struct({
  value: Schema.Finite.annotate({ description: 'Numeric magnitude' }),
  unit: Schema.Literals(['px', 'rem']).annotate({
    description: 'DTCG permits only these two units',
  }),
}).annotate({ strictKeys: true, title: 'sovrium:strict-keys', identifier: 'DtcgDimensionValue' })

/** A DTCG duration value — a number plus `ms` or `s`. */
export const dtcgDurationValueSchema = Schema.Struct({
  value: Schema.Finite.annotate({ description: 'Numeric magnitude' }),
  unit: Schema.Literals(['ms', 's']).annotate({ description: 'DTCG permits only these two units' }),
}).annotate({ strictKeys: true, title: 'sovrium:strict-keys', identifier: 'DtcgDurationValue' })

// ---------------------------------------------------------------------------
// DTCG tokens
// ---------------------------------------------------------------------------

const withDescription = {
  $description: optionalField(Schema.String),
}

export const dtcgColorTokenSchema = Schema.Struct({
  $type: Schema.Literal('color'),
  $value: dtcgColorValueSchema,
  ...withDescription,
}).annotate({ strictKeys: true, title: 'sovrium:strict-keys', identifier: 'DtcgColorToken' })

export const dtcgDimensionTokenSchema = Schema.Struct({
  $type: Schema.Literal('dimension'),
  $value: dtcgDimensionValueSchema,
  ...withDescription,
}).annotate({ strictKeys: true, title: 'sovrium:strict-keys', identifier: 'DtcgDimensionToken' })

export const dtcgDurationTokenSchema = Schema.Struct({
  $type: Schema.Literal('duration'),
  $value: dtcgDurationValueSchema,
  ...withDescription,
}).annotate({ strictKeys: true, title: 'sovrium:strict-keys', identifier: 'DtcgDurationToken' })

/**
 * A DTCG `cubicBezier` value — the four control-point ratios, in order.
 *
 * ─── EASING HAS A DTCG FORM, AND THIS CODEBASE USED TO SAY IT DID NOT ──────
 *
 * `inherited-tokens.ts` states that "an easing has no DTCG form at all" and
 * that publishing one "would invent a type DTCG does not have". That is wrong,
 * and it contradicts its own sibling: `design-system.ts` already names the
 * destination — *"promoting it to a first-class `cubicBezier` group is a
 * separate decision"* — and `design-system-foundation-motion.ts` already PARSES
 * `cubic-bezier(x1, y1, x2, y2)` into exactly these four numbers in order to
 * draw the curve. The type exists, the parser exists, and all four inherited
 * curves are `cubic-bezier(...)`.
 *
 * DTCG fixes the length at four and the order at `[P1x, P1y, P2x, P2y]`. The x
 * ordinates are bounded to `0..1` because a control point outside that range is
 * not a valid timing function; the y ordinates are deliberately UNBOUNDED —
 * `emphasized` overshoots at `1.1`, and clamping it would silently rewrite a
 * curve the platform actually ships.
 */
export const dtcgCubicBezierValueSchema = Schema.Tuple([
  Schema.Finite.annotate({
    description: 'P1x — bounded; an x ordinate outside 0..1 is not a curve',
  }).pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0), Schema.isLessThanOrEqualTo(1))),
  Schema.Finite.annotate({ description: 'P1y — unbounded; an overshoot past 1 is a real easing' }),
  Schema.Finite.annotate({ description: 'P2x — bounded, as P1x' }).pipe(
    Schema.check(Schema.isGreaterThanOrEqualTo(0), Schema.isLessThanOrEqualTo(1))
  ),
  Schema.Finite.annotate({ description: 'P2y — unbounded, as P1y' }),
]).annotate({ description: 'The four control-point ratios of a cubic-bezier, in DTCG order' })

export const dtcgCubicBezierTokenSchema = Schema.Struct({
  $type: Schema.Literal('cubicBezier'),
  $value: dtcgCubicBezierValueSchema,
  ...withDescription,
}).annotate({ strictKeys: true, title: 'sovrium:strict-keys', identifier: 'DtcgCubicBezierToken' })

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
export const dtcgTypographyValueSchema = Schema.Struct({
  fontFamily: optionalField(
    Schema.Union([Schema.String, Schema.Array(Schema.String)]).annotate({
      description: 'Resolved font stack for this step, when it names a declared face',
    })
  ),
  fontSize: dtcgDimensionValueSchema.annotate({ description: 'Rendered size of this step' }),
  fontWeight: optionalField(
    Schema.Finite.annotate({ description: 'Weight, 1–1000 per DTCG' }).pipe(
      Schema.check(Schema.isGreaterThanOrEqualTo(1), Schema.isLessThanOrEqualTo(1000))
    )
  ),
  letterSpacing: optionalField(
    dtcgDimensionValueSchema.annotate({
      description: 'Tracking. Absent when the author declared it in `em`, which DTCG cannot carry',
    })
  ),
  lineHeight: optionalField(
    Schema.Finite.annotate({
      description: 'Leading as a UNITLESS RATIO — DTCG types this as a number, not a dimension',
    })
  ),
}).annotate({ strictKeys: true, title: 'sovrium:strict-keys', identifier: 'DtcgTypographyValue' })

export const dtcgTypographyTokenSchema = Schema.Struct({
  $type: Schema.Literal('typography'),
  $value: dtcgTypographyValueSchema,
  ...withDescription,
}).annotate({ strictKeys: true, title: 'sovrium:strict-keys', identifier: 'DtcgTypographyToken' })

/** DTCG permits a single font name or an ordered stack. */
export const dtcgFontFamilyTokenSchema = Schema.Struct({
  $type: Schema.Literal('fontFamily'),
  $value: Schema.Union([Schema.String, Schema.Array(Schema.String)]),
  ...withDescription,
}).annotate({ strictKeys: true, title: 'sovrium:strict-keys', identifier: 'DtcgFontFamilyToken' })

// ---------------------------------------------------------------------------
// The Sovrium guidance layer, carried in `$extensions`
// ---------------------------------------------------------------------------

/** Per-token usage guidance, mirroring `design.colorRoles`. */
export const colorRoleGuidanceSchema = Schema.Struct({
  usage: optionalField(
    Schema.String.annotate({
      description: 'What this colour is for, and what it must not be used for',
    })
  ),
  pairsWith: optionalField(
    Schema.String.annotate({ description: 'The token this one is designed to sit against' })
  ),
}).annotate({ strictKeys: true, title: 'sovrium:strict-keys', identifier: 'ColorRoleGuidance' })

/** Per-component usage guidance, mirroring `design.components`. */
export const componentGuidanceSchema = Schema.Struct({
  usage: optionalField(Schema.String),
  when: optionalField(Schema.String),
  dont: optionalField(Schema.String),
}).annotate({ strictKeys: true, title: 'sovrium:strict-keys', identifier: 'ComponentGuidance' })

/**
 * The mark and its placement rules, mirroring `design.logo`.
 *
 * `src` / `srcDark` are carried VERBATIM as the author declared them —
 * root-relative or `https://`, never rewritten to an absolute URL. A design
 * system that silently absolutised its own asset paths would publish a document
 * that only resolves against the host it was generated on, which is precisely
 * the property that makes a charter shareable.
 */
export const logoGuidanceSchema = Schema.Struct({
  src: Schema.String.annotate({ description: 'The primary mark, as declared' }),
  srcDark: optionalField(
    Schema.String.annotate({ description: 'The variant shown in dark mode (the light-ink file)' })
  ),
  alt: Schema.String.annotate({ description: 'Accessible name of the mark' }),
  clearSpace: optionalField(
    Schema.String.annotate({ description: 'Exclusion zone, stated relative to the mark' })
  ),
  minWidth: optionalField(Schema.String.annotate({ description: 'Smallest reproduction width' })),
  misuse: optionalField(
    Schema.Array(Schema.String).annotate({ description: 'What must never be done to the mark' })
  ),
}).annotate({ strictKeys: true, title: 'sovrium:strict-keys', identifier: 'LogoGuidance' })

/** Imagery and iconography rules, mirroring `design.imagery`. */
export const imageryGuidanceSchema = Schema.Struct({
  principles: optionalField(Schema.Array(Schema.String)),
  photography: optionalField(Schema.Array(Schema.String)),
  iconSet: optionalField(Schema.String),
  patterns: optionalField(Schema.Array(Schema.String)),
}).annotate({ strictKeys: true, title: 'sovrium:strict-keys', identifier: 'ImageryGuidance' })

/** Voice and tone, mirroring `design.voice`. */
export const voiceGuidanceSchema = Schema.Struct({
  personality: optionalField(Schema.Array(Schema.String)),
  pronoun: optionalField(Schema.String),
  prefer: optionalField(Schema.Array(Schema.String)),
  avoid: optionalField(Schema.Array(Schema.String)),
  tone: optionalField(
    Schema.Struct({
      empty: optionalField(Schema.String),
      loading: optionalField(Schema.String),
      error: optionalField(Schema.String),
      success: optionalField(Schema.String),
      destructive: optionalField(Schema.String),
    }).annotate({ strictKeys: true, title: 'sovrium:strict-keys' })
  ),
}).annotate({ strictKeys: true, title: 'sovrium:strict-keys', identifier: 'VoiceGuidance' })

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
export const zoneVoiceGuidanceSchema = Schema.Struct(
  Struct.omit(voiceGuidanceSchema.fields, ['personality'])
).annotate({
  strictKeys: true,
  title: 'sovrium:strict-keys',
  identifier: 'ZoneVoiceGuidance',
})

/**
 * One zone of the app's zone map, mirroring `design.zones[]`.
 *
 * A voice override here is per-FIELD: a declared field replaces the same field
 * of `design.voice` for the routes this pattern governs, and an undeclared one
 * inherits. The document carries only what the author DECLARED — resolving the
 * inheritance into each entry would publish the base voice five times over and
 * leave no consumer able to tell an override from an inherited default.
 */
export const designZoneGuidanceSchema = Schema.Struct({
  pattern: Schema.String.annotate({
    description: "Declared route pattern this zone governs, or the catch-all 'everything else'",
  }),
  zone: Schema.String.annotate({ description: 'The zone this pattern belongs to' }),
  accentBudget: optionalField(
    Schema.Literals(['public', 'product']).annotate({
      description: 'Which accent budget the zone carries',
    })
  ),
  voice: optionalField(
    zoneVoiceGuidanceSchema.annotate({
      description: 'How this zone departs from `design.voice`, field by field',
    })
  ),
}).annotate({ strictKeys: true, title: 'sovrium:strict-keys', identifier: 'DesignZoneGuidance' })

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
export const inertDeclarationSchema = Schema.Struct({
  path: Schema.String.annotate({
    description: "Config path of the declaration, e.g. 'theme.fonts.body.lineHeight'",
  }),
  declared: Schema.String.annotate({ description: 'The value the author wrote, verbatim' }),
  reason: Schema.String.annotate({ description: 'Why it does not reach the rendered app' }),
}).annotate({ strictKeys: true, title: 'sovrium:strict-keys', identifier: 'InertDeclaration' })

/**
 * A value the app ships, and whether the operator chose it.
 *
 * ─── THE MERGE LOSES A FACT THE SURFACE KEEPS, SO IT IS CARRIED ────────────
 *
 * Foundations draws `{ ...INHERITED, ...declared }` — the ramp the app actually
 * moves and elevates on, not the subset its config names. The export must agree
 * with the surface or it documents a different system than the console does,
 * and `[internal ref]` already argues that failure for breakpoints:
 * *"an app reports the breakpoints it DECLARED rather than the ones it SHIPS…
 * Inheritance is precisely what an author cannot learn by reading their own
 * config, which is what this console is for."*
 *
 * But a BARE merge is worse than either half alone for the reader this export
 * exists for. An agent handed five shadows cannot tell the one the operator
 * chose from the four Sovrium supplied, so it treats platform defaults as
 * intentional and preserves them as if they were decisions. `provenance` is
 * what keeps the merge honest.
 */
export const providedValueSchema = Schema.Struct({
  value: Schema.String.annotate({ description: 'The value as the renderer applies it' }),
  provenance: Schema.Literals(['declared', 'inherited']).annotate({
    description: 'Whether the operator wrote this value or the platform supplied it',
  }),
}).annotate({ strictKeys: true, title: 'sovrium:strict-keys', identifier: 'ProvidedValue' })

/** One component type as the catalogue publishes it. */
export const catalogueEntrySchema = Schema.Struct({
  type: Schema.String.annotate({
    description: 'The type literal, exactly as the schema spells it',
  }),
  category: Schema.String.annotate({
    description: 'The published category the registry places it in',
  }),
  variants: optionalField(
    Schema.Array(Schema.String).annotate({
      description: 'The variant axis, where the type declares one — absent, never empty',
    })
  ),
  /**
   * Why this type is not drawn. Present only for a refused type, and carrying
   * the type's OWN sentence: fifteen types are refused for ten distinct
   * reasons, and `tab-panel` — schema-accepted with no renderer behind it —
   * is a fact nothing else in the product states.
   */
  excludedReason: optionalField(
    Schema.String.annotate({ description: 'The type-specific reason it is not drawn' })
  ),
}).annotate({ strictKeys: true, title: 'sovrium:strict-keys', identifier: 'CatalogueEntry' })

/** Everything Sovrium adds that DTCG has no home for. */
export const sovriumDesignExtensionSchema = Schema.Struct({
  principles: optionalField(Schema.Array(Schema.String)),
  logo: optionalField(logoGuidanceSchema),
  imagery: optionalField(imageryGuidanceSchema),
  voice: optionalField(voiceGuidanceSchema),
  colorRoles: optionalField(Schema.Record(Schema.String, colorRoleGuidanceSchema)),
  components: optionalField(Schema.Record(Schema.String, componentGuidanceSchema)),
  /** The zone map — which route family is which register. See {@link designZoneGuidanceSchema}. */
  zones: optionalField(Schema.Array(designZoneGuidanceSchema)),
  /**
   * The elevation ramp this app SHIPS — inherited merged under declared.
   *
   * ─── WHY HERE AND NOT IN THE DTCG TREE ─────────────────────────────────
   *
   * A DTCG `shadow` needs a decomposed `{color, offsetX, offsetY, blur,
   * spread}`, and parsing arbitrary `box-shadow` back into it fails exactly
   * where it matters — multiple layers, `inset`, colour functions. Three of
   * the five inherited steps are two-layer. So the document still emits NO
   * `shadow` group, `[internal ref]` still holds, and the raw string
   * still appears under `unmappable` for anything declared.
   *
   * This is ADDITIVE to that, not a replacement for it: a consumer that wants
   * a faithful DTCG shadow still gets nothing, and a consumer that wants to
   * know what the app actually elevates with now gets the whole ramp.
   */
  shadows: optionalField(Schema.Record(Schema.String, providedValueSchema)),
  /**
   * The component catalogue — every type this instance ships, with its
   * category, its variant axis where the schema declares one, and the reason
   * it is not drawn where it is not.
   */
  catalogue: optionalField(Schema.Array(catalogueEntrySchema)),
  /** Raw CSS declarations with no faithful DTCG form (shadows, `clamp()` spacing, …). */
  unmappable: optionalField(Schema.Record(Schema.String, Schema.String)),
  /** Declared values the renderer discards — see `inertDeclarationSchema`. */
  inert: optionalField(Schema.Array(inertDeclarationSchema)),
}).annotate({
  strictKeys: true,
  title: 'sovrium:strict-keys',
  identifier: 'SovriumDesignExtension',
})

export const designSystemExtensionsSchema = Schema.Struct({
  [SOVRIUM_EXTENSION_KEY]: sovriumDesignExtensionSchema,
}).annotate({
  strictKeys: true,
  title: 'sovrium:strict-keys',
  identifier: 'DesignSystemExtensions',
})

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
export const designSystemDocumentSchema = Schema.Struct({
  $description: Schema.String.annotate({
    description: 'One line naming the app this document describes',
  }),
  color: Schema.Record(Schema.String, dtcgColorTokenSchema).annotate({
    description: 'Colour tokens',
  }),
  spacing: Schema.Record(Schema.String, dtcgDimensionTokenSchema).annotate({
    description: 'Spacing scale',
  }),
  radius: Schema.Record(Schema.String, dtcgDimensionTokenSchema).annotate({
    description: 'Border radii',
  }),
  breakpoint: Schema.Record(Schema.String, dtcgDimensionTokenSchema).annotate({
    description: 'Responsive thresholds',
  }),
  font: Schema.Record(Schema.String, dtcgFontFamilyTokenSchema).annotate({
    description: 'Font families',
  }),
  typography: Schema.Record(Schema.String, dtcgTypographyTokenSchema).annotate({
    description: 'The type scale — one composite token per declared step, in ladder order',
  }),
  duration: Schema.Record(Schema.String, dtcgDurationTokenSchema).annotate({
    description: 'Animation durations',
  }),
  /**
   * The easing curves — the OTHER half of `theme.animations`, promoted out of
   * `unmappable` where Phase 1 filed it.
   *
   * A MOVE, and a consumer reading `unmappable` for an easing will stop
   * finding it there. That is the point: a `cubic-bezier(...)` has a faithful
   * DTCG form, so filing it beside genuinely unmappable values misreported it
   * as inexpressible. Only curves that PARSE are promoted — a declared
   * `ease-in-out` or a keyword DTCG cannot carry stays in `unmappable`, for
   * exactly the reason shadows do.
   *
   * ─── OPTIONAL, UNLIKE EVERY OTHER GROUP, AND ONLY WHILE IT MOVES ───────
   *
   * `color`, `spacing`, `duration` and the rest are required because they
   * have always been emitted, empty when an app declares none. This group is
   * optional because the route VALIDATES its response against this schema:
   * requiring it makes `GET /api/admin/design-system.json` answer 500 for
   * every app until the builder is taught to emit it, which reddens the whole
   * export surface for a reason no individual criterion is claiming. Absence
   * is the honest encoding of a document written before the promotion; once
   * the builder emits it, it is always present.
   */
  easing: optionalField(
    Schema.Record(Schema.String, dtcgCubicBezierTokenSchema).annotate({
      description: 'Easing curves, as DTCG cubicBezier tokens',
    })
  ),
  $extensions: designSystemExtensionsSchema,
}).annotate({ strictKeys: true, title: 'sovrium:strict-keys', identifier: 'DesignSystemDocument' })

/** @public */
export type DesignSystemDocument = typeof designSystemDocumentSchema.Type
/** @public */
export type DtcgTypographyValue = typeof dtcgTypographyValueSchema.Type
/** @public */
export type SovriumDesignExtension = typeof sovriumDesignExtensionSchema.Type
/** @public */
export type InertDeclaration = typeof inertDeclarationSchema.Type

/**
 * The query the catalogue's fixture-row read carries.
 *
 * One optional cap, for the same reason the component-type detail carries one:
 * the console needs a SHORT list and an EMPTY one to draw the states a `table`
 * or a `form` specimen has, and the endpoint should not learn what "short"
 * means. It caps the fixture rather than generating rows — `?rows=0` is the
 * empty state, `?rows=2` is a short list, omitted is the whole fixture.
 *
 * A cap on the existing address rather than a sibling endpoint: no new path, no
 * new guard entry, nothing to keep in sync, and it is the idiom this family
 * already speaks (`?key=`, `?group=`, `?subject=`, `?routesLimit=`).
 *
 * ─── AND THE PAGE WINDOW A BOUND GRID SENDS ────────────────────────────────
 *
 * `page` and `limit` are DECLARED rather than tolerated, because the fixture is
 * now deeper than one page. A bound grid appends them to every request
 * (`buildSystemQueryString`), and while the fixture was three rows they were
 * harmlessly accepted and ignored — three rows are one page at any page size.
 * Past a page that stops being harmless: the grid renders a pager reading
 * `1-10 of 30` over a handler that serves all thirty rows and never moves the
 * window, so the pager announces pages it cannot reach.
 *
 * The cap applies FIRST and the window selects from what survives it, so
 * `?rows=10&limit=5` is five rows out of ten and never five out of thirty.
 *
 * `Schema.String` on all three because a query param always IS one. The
 * conversion to a number lives beside the handler that slices with it, so an
 * unusable value is ignored rather than turned into a 400 — see
 * `parseOptionalCap` and `parseOptionalPositive` there.
 *
 * ─── NOT `strictKeys`, UNLIKE EVERY OTHER QUERY IN THIS FAMILY ─────────────
 *
 * The sibling reads are addressed by a console page and nothing else, so a
 * param they do not declare is a typo worth refusing. This one is BOUND: a
 * `table`, `list`, `gallery` or `kanban` specimen points a system source at it,
 * and the same grid also sends `sort`, `q` and `cursor`. Under `strictKeys` the
 * first such grid would be answered 400, and the catalogue page documenting
 * `table` would draw a validation error instead of a table.
 *
 * So an undeclared key is still tolerated and simply not implemented. What is
 * no longer true is the old reason for being relaxed about ALL of them — that
 * "the fixture is three rows, which is one page at any page size and one order
 * at any sort". The two that carry a page now have a declaration; `sort` does
 * not, and a grid that sends one gets the fixture's own order.
 */
export const specimenRowsQuerySchema = Schema.Struct({
  rows: optionalField(
    Schema.String.annotate({
      description:
        'Cap the fixture at this many rows. `0` serves the empty state. Omitted, the whole fixture is served.',
      examples: ['0', '2'],
    })
  ),
  page: optionalField(
    Schema.String.annotate({
      description: '1-indexed page of the capped fixture. Ignored without a `limit`.',
      examples: ['1', '3'],
    })
  ),
  limit: optionalField(
    Schema.String.annotate({
      description:
        'Page size. Omitted, the whole capped fixture is served. `total` describes the capped fixture either way, so a pager can say `1-10 of 30`.',
      examples: ['10'],
    })
  ),
}).annotate({
  identifier: 'SpecimenRowsQuery',
})

/** @public */
export type SpecimenRowsQuery = typeof specimenRowsQuerySchema.Type
