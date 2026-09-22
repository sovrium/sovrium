/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { optionalField } from '@/domain/models/api/combinators/optional-field'
import { flatTokenRowSchema } from './component-types'

// ---------------------------------------------------------------------------
// The resolved tokens, by group, with counts
// ---------------------------------------------------------------------------

/**
 * How many of the returned rows fall on each side of the three questions.
 *
 * ─── THREE COUNTS, NOT A PERCENTAGE ────────────────────────────────────────
 *
 * "Votre design" answers *how much of this system did I choose?*, and the
 * honest answer is a pair of integers over a total rather than a ratio: an
 * operator who overrode four tokens of two hundred is told "4 overridden",
 * which is actionable, where "2%" is a number nobody can act on.
 *
 * `inherited + overridden === total` holds by construction — the two are the
 * complement of one another, exactly as the row contract's own note explains —
 * so publishing both is redundant *arithmetically* and not *editorially*: the
 * page prints them side by side and deriving one in the page would put a
 * subtraction in config.
 *
 * `locked` is orthogonal and overlaps both: it counts rows config cannot change
 * at all. It is expected to be **0** for every group the document publishes
 * today, because every group has an authoring position — a measured fact rather
 * than a stub, and the counter is what will notice the day a group loses one.
 */
export const designTokenSummarySchema = Schema.Struct({
  total: Schema.Int.annotate({
    description: 'How many rows this response carries — the same number as `total` beside it',
  }),
  inherited: Schema.Int.annotate({
    description: 'How many of those rows the platform supplied rather than the operator',
  }),
  overridden: Schema.Int.annotate({
    description: 'How many of those rows the operator declared over an inherited value',
  }),
  locked: Schema.Int.annotate({
    description:
      'How many of those rows config cannot change at all. Zero for every group published today — the counter is what notices if that stops being true.',
  }),
  // ─── THE ONE [internal ref] FACT A COLOUR ROW CANNOT CARRY ────────────────────
  //
  // Whether this app declared `theme.darkColors` AT ALL. A page reading the dark
  // scheme needs it to decide between drawing the dark ladder and saying why
  // there is none, and no row can answer it: a row's own `dark` is absent both
  // when the app declared no dark palette and when it declared one that skips
  // this token, and those are different facts.
  //
  // On the SUMMARY rather than repeated onto every row, because a page reaches
  // it as a page-level `{ system }` record (`recordKey: summary`) and gates on it
  // there — one binding, one gate, rather than the same boolean on 80 rows.
  darkDeclared: Schema.Boolean.annotate({
    description:
      'Whether this app declares `theme.darkColors` at all. The gate a page reads to draw the dark ladder or the one honest sentence saying there is none.',
  }),
}).annotate({
  strictKeys: true,
  title: 'sovrium:strict-keys',
  identifier: 'DesignTokenSummary',
})

/**
 * One declaration the engine VALIDATED and then did not carry into the token
 * document.
 *
 * ─── THE FAILURE THIS EXISTS TO STOP BEING SILENT ──────────────────────────
 *
 * An operator writes `theme.fonts.body.lineHeight`, the config decodes, the app
 * boots, and nothing anywhere renders it. From the outside that is
 * indistinguishable from a renderer bug in their own page, and the console is
 * the only surface that could tell them otherwise.
 *
 * Two reasons, and they are different enough that a page prints them under
 * different headings:
 *
 *  - `inert`      — a valid declaration no renderer reads. It carries a
 *                   `reason` saying so.
 *  - `unmappable` — shipped and working, with no faithful DTCG form, so it
 *                   cannot become a token row. The value IS in use.
 *
 * ROWS rather than the `{ inert: [], unmappable: {} }` shape the document
 * carries, for the reason every array on this contract is rows: `rowsKey` is a
 * flat `body[key]` lookup and a keyed OBJECT is not a row set at all — a page
 * binding `unmappable` would be handed one record whose fields are config paths.
 */
export const discardedDeclarationSchema = Schema.Struct({
  kind: Schema.Literals(['inert', 'unmappable']).annotate({
    description:
      'Why this declaration is not a token. `inert` — valid and read by no renderer. `unmappable` — shipped and working, with no faithful DTCG form.',
  }),
  path: Schema.String.annotate({
    description:
      'The config address that declares it, so a reader who wants to change it has the line',
    examples: ['design.typeScale.families.body.lineHeight'],
  }),
  declared: Schema.String.annotate({
    description: 'The declared value as text — what the operator actually wrote',
    examples: ['1.6', '0.02em'],
  }),
  reason: optionalField(
    Schema.String.annotate({
      description:
        'Why an `inert` declaration is read by nothing. ABSENT on an `unmappable` row, whose `kind` is the whole explanation and which is NOT a defect.',
    })
  ),
}).annotate({
  strictKeys: true,
  title: 'sovrium:strict-keys',
  identifier: 'DiscardedDeclaration',
})

/**
 * The query a token read carries.
 *
 * ─── `group`, NOT `facet` ──────────────────────────────────────────────────
 *
 * The DTCG document's own top-level members are `color`, `spacing`, `radius`,
 * `breakpoint`, `font`, `typography`, `duration`, `easing`, and a token row's
 * `path` is `<group>.<name>`. Naming the filter after anything else would put a
 * second word on one concept and hand every reader the job of mapping between
 * them — the same reasoning that keeps `classProvenanceLayerSchema` on the
 * resolver's own vocabulary.
 *
 * ─── ONE GROUP, NOT A LIST ─────────────────────────────────────────────────
 *
 * A console section spanning two groups (Motion is `duration` plus `easing`)
 * binds two reads, because it draws two different things: a duration is a
 * number in a table and a curve is a drawing. A comma-separated list would buy
 * one fewer request and cost a parser, an escaping rule, and an ambiguity about
 * what `summary` then summarises.
 *
 * ─── PLUS ONE GROUP THE DOCUMENT DOES NOT HAVE: `shadow` ──────────────────
 *
 * This is the one place the facet read's row SET differs from `?flat=1`'s, and
 * it is deliberate rather than drift. The elevation ramp is published under
 * `$extensions.shadows` rather than as a DTCG group, and `?flat=1` — which
 * projects the DOCUMENT, and skips every `$`-prefixed member so that
 * `$description` does not land in the palette table — therefore cannot carry
 * it. Foundations draws elevation as a family beside spacing and radius, and a
 * token table that omitted it would under-report the system the page is
 * documenting. So `?flat=1` mirrors the document's tree and this mirrors the
 * console's families; the rows have one shape and the difference is one group,
 * stated here rather than discovered.
 *
 * The ramp already carries per-step `provenance` (`declared` / `inherited`),
 * which is `overridden` / `inherited` under another name — the only group whose
 * provenance the document itself publishes — so no second derivation is needed
 * to fill the row.
 *
 * An UNKNOWN group is not an error: it returns zero rows and a zero summary,
 * because "no tokens in that group" is the truthful answer for a group the
 * document does not publish, and a 404 here would let a caller enumerate which
 * groups exist by probing.
 */
export const designTokenQuerySchema = Schema.Struct({
  group: optionalField(
    Schema.String.annotate({
      description:
        "Restrict to one top-level group of the DTCG document. Omit for the whole system — which is what the 'Votre design' counters mean.",
      examples: ['color', 'easing'],
    })
  ),
}).annotate({
  strictKeys: true,
  title: 'sovrium:strict-keys',
  identifier: 'DesignTokenQuery',
})

/**
 * The resolved design tokens as rows, with the counts the headline prints.
 *
 * ─── WHY THIS IS NOT `?flat=1` ─────────────────────────────────────────────
 *
 * `GET /api/admin/design-system.json?flat=1` serves the SAME row contract, and
 * that is deliberate: one shape for one fact. The two addresses differ in what
 * they are FOR, and the difference is visible in the response.
 *
 *  - `?flat=1` is a projection of the exported DOCUMENT. It is whole, it is
 *    unfiltered, and it emits the export's audit row, because an operator
 *    pulling the token table is pulling the same thing the export hands to an
 *    agent.
 *  - This is the console's own read. It filters, it counts, and it writes no
 *    audit row — one console page visit fires several, and recording each would
 *    drown the export entry in navigation, which is the rule
 *    `design-system-schema.ts` already states for the per-type reads.
 *
 * Collapsing them would mean either auditing every table repaint or dropping
 * the audit row from the export projection. Neither is a trade worth one fewer
 * route.
 */
/**
 * One token row as the CONSOLE reads it: the published row, plus the leaf a
 * page can spell.
 *
 * ─── WHY IT IS NOT `flatTokenRowSchema` ────────────────────────────────────
 *
 * That schema is the `?flat=1` projection of the exported DOCUMENT, and the
 * document's contract is not the console's to widen — a consumer diffing two
 * exports would see a key appear that says nothing about the design system.
 * This row is the same data addressed for a page, which is a different
 * audience, so it is a different type rather than a shared one with an
 * optional field nobody can predict.
 *
 * `leaf` is the last segment of `path`, and it is published for the reason
 * every other addition in this family is: a config page has no string
 * operations, so `…-swatch-$record.leaf` is spellable and
 * `…-swatch-$record.path.split('.').pop()` is not.
 */
export const designTokenRowSchema = Schema.Struct({
  ...flatTokenRowSchema.fields,
  leaf: Schema.String.annotate({
    description:
      'The last segment of `path` — the token’s own name, without its group. Published because a page cannot split a string, and a per-token testid or anchor needs exactly this.',
    examples: ['background', 'signature'],
  }),
  // ─── THE FIVE COLOUR-ONLY FIELDS, AND WHY THEY ARE ON THIS ROW ───────────
  //
  // Absent on every non-colour row, which is the honest shape: a spacing token
  // has no hex and no gamut, and a row carrying `hex: ''` would print a blank
  // where a reader expects a value. They are here rather than on a colour-only
  // sibling response because a page binds ONE rows source, and a foundations
  // panel draws the colour ladder from this one.
  //
  // Each is a CONVERSION or a MEASUREMENT the page cannot perform: there is no
  // arithmetic in a config page, and an Oklab matrix multiply is a long way past
  // arithmetic.
  hex: optionalField(
    Schema.String.annotate({
      description:
        'The row’s colour as six-digit sRGB hex, upper-case. ABSENT for a non-colour row, and absent for a colour sRGB cannot hold — a clamped hex presented as an equal is worse than none.',
      examples: ['#FAFAFA'],
    })
  ),
  gamut: optionalField(
    Schema.Literals(['srgb', 'wide']).annotate({
      description:
        'Whether sRGB can hold this colour. `wide` is what makes an absent `hex` mean "out of gamut" rather than "not a colour" — the two are different facts and only this field tells them apart.',
    })
  ),
  // ─── THE CONTRAST TRIPLE ──────────────────────────────────────────────────
  //
  // `contrastLevel` is the machine value a page stamps; `contrastRatio` is the
  // NUMBER, not the rendered `17.40:1`. [internal ref]: the ratio is a fact and the
  // page composes the `:1` beside it, where a pre-rendered string would freeze
  // a two-decimal formatting choice into a published contract.
  //
  // ABSENT for the ground itself — a colour measured against itself is 1:1 and
  // says nothing — and absent when either operand does not resolve, because a
  // ratio measured against something the author did not name is a guess.
  contrastAgainst: optionalField(
    Schema.String.annotate({
      description:
        'The leaf name of the ground this colour was measured against. Carried rather than assumed, so a page prints the pairing it is documenting rather than one it inferred.',
      examples: ['background'],
    })
  ),
  contrastRatio: optionalField(
    Schema.Finite.annotate({
      description:
        'The WCAG contrast ratio against `contrastAgainst`, 1–21. A NUMBER: the page composes the `:1` beside it, since a rendered string would freeze a formatting choice into the contract.',
      examples: [17.4],
    })
  ),
  contrastLevel: optionalField(
    Schema.Literals(['AAA', 'AA', 'fail']).annotate({
      description:
        'The WCAG grade at body-text size — the literal a page stamps into an addressable attribute. `fail` rather than an absence, because "this pair fails" and "this pair was not measured" are different facts a reader must be able to tell apart.',
    })
  ),
  // ─── THE DARK HALF, AND WHY IT IS NOT THE LIGHT HALF RE-READ ─────────────
  //
  // Every field above projects `value`, which is the LIGHT value. A page shown
  // under `?scheme=dark` paints `dark` instead, and the three light fields go
  // on describing a colour that is no longer on screen — a swatch showing one
  // colour beside a ratio measured on another, with nothing saying so.
  //
  // The ground moves too: a dark swatch is measured against the DARK
  // background, not the light one, so this is a second measurement rather than
  // the same number relabelled.
  darkHex: optionalField(
    Schema.String.annotate({
      description:
        'The row’s DARK counterpart as six-digit sRGB hex, upper-case. ABSENT when the operator declared no dark counterpart for this token, and absent for a colour sRGB cannot hold — on `hex`’s terms exactly.',
      examples: ['#101010'],
    })
  ),
  darkGamut: optionalField(
    Schema.Literals(['srgb', 'wide']).annotate({
      description:
        'Whether sRGB can hold the DARK counterpart. Distinguishes an absent `darkHex` that means "out of gamut" from one that means "no dark counterpart was declared", exactly as `gamut` does for the light half.',
    })
  ),
  darkContrastAgainst: optionalField(
    Schema.String.annotate({
      description:
        'The leaf name of the DARK ground this counterpart was measured against. Carried rather than assumed, for `contrastAgainst`’s reason — and it is a different measurement, because the dark background is a different colour.',
      examples: ['background'],
    })
  ),
  darkContrastRatio: optionalField(
    Schema.Finite.annotate({
      description:
        'The WCAG contrast ratio of the DARK counterpart against `darkContrastAgainst`, 1–21. A NUMBER, on `contrastRatio`’s terms: the page composes the `:1`.',
      examples: [15.2],
    })
  ),
  // ─── REQUIRED, AND THAT IS THE WHOLE POINT OF THE FIELD ──────────────────
  //
  // Its three siblings above are optional, because an absent hex or ratio is
  // read beside a `gamut` that says which absence it is. This one has no such
  // partner, and the state it has to express IS an absence: an app declaring no
  // `theme.darkColors` measures nothing in dark, and the page must hide every
  // dark badge and show ONE note naming the key that would fill the gap.
  //
  // `visibility.record` carries nine value comparisons and NO presence
  // operator, so a page cannot ask whether `darkContrastRatio` arrived. An
  // optional level would leave the unmeasured state unreachable — which is the
  // very defect the criterion exists to prevent, one layer down: a swatch, a
  // value, and no account of its contrast, from which the only available
  // conclusion is that the ratio was fine.
  //
  // So `unmeasured` is a VALUE, present on every row, and the badge is gated
  // `darkContrastLevel neq unmeasured`. Required on a spacing row too: nothing
  // measured its dark contrast either, and a total field is what makes the gate
  // total.
  darkContrastLevel: Schema.Literals(['AAA', 'AA', 'fail', 'unmeasured']).annotate({
    description:
      'The WCAG grade of the DARK counterpart, or `unmeasured` when there is none to grade — no dark counterpart declared, a colour that did not resolve, or a row that is not a colour. REQUIRED on every row: it is the gate a page reads to hide a dark badge, and `visibility.record` has no presence operator to test an absence with.',
  }),
  // ─── THE TWO TYPOGRAPHY-ONLY FIELDS ──────────────────────────────────────
  //
  // A `typography.*` token's `$value` is a COMPOSITE — font family, size,
  // weight, tracking and leading in one object — and `value` renders it with
  // the generic `key: value; …` fallback, because unlike a colour or a
  // dimension the bundle has no single CSS spelling. So the row a Foundations
  // ladder binds carries its size as a substring of
  // `fontFamily: Inter; fontSize: 2.75rem; fontWeight: 700; lineHeight: 1.1`.
  //
  // A config page cannot reach either half of that. It has no string
  // operations, so it cannot cut the composite; and `$record.<field>`'s grammar
  // is `[a-zA-Z0-9_]+` and admits no dots, so `$record.value.fontSize` resolves
  // `$record.value` and leaves `.fontSize` as literal text on the page. Exactly
  // the flatness constraint that put `leaf` beside `path` and the axis counts on
  // a catalogue row.
  //
  // ─── WHY THEY ARE NOT THE `/type-ladder` ROWS ────────────────────────────
  //
  // `typeLadderRowSchema` publishes the PLATFORM ladder — what Sovrium's own
  // `text-*` utilities resolve to, a build constant that takes no app. (It read
  // "Tailwind's own" until the ladder moved into the `--text-*` namespace and
  // became Sovrium's; before that no utility read it at all.)
  // `[internal ref]` draws BOTH: the operator's declared step, and the
  // platform ladder beside it for an app that declared none. These two fields
  // are the declared half, and keeping them apart is what stops one being read
  // as the other — which is the whole reason the platform ladder got its own
  // endpoint rather than being folded into this response.
  //
  // ABSENT on every non-typography row, on the colour half's terms: a spacing
  // token has no leading, and a row carrying `lineHeight: 0` would print a
  // number where a reader expects silence.
  fontSize: optionalField(
    Schema.String.annotate({
      description:
        'This step’s declared font size, with its unit — the `fontSize` member of the typography composite, addressable on its own. ABSENT for every row that is not a `typography.*` token.',
      examples: ['2.75rem', '0.8125rem'],
    })
  ),
  // A NUMBER, and that is the schema's own shape rather than a choice made
  // here: `design.typeScale.*.lineHeight` is a unitless ratio typed
  // `Schema.Number`, and DTCG types `lineHeight` the same way. Publishing
  // `'1.1'` would freeze `String(1.1)`'s formatting into a published contract,
  // which is the objection [internal ref] raises against `contrastRatio` being
  // pre-rendered as `17.40:1` — the page composes what it prints.
  //
  // Absent both for a non-typography row AND for a declared step that named no
  // leading, which is a real state: `lineHeight` is optional on the step, and a
  // step declaring only a size inherits its leading from the cascade.
  lineHeight: optionalField(
    Schema.Finite.annotate({
      description:
        'This step’s declared line height as a unitless ratio. A NUMBER, on `contrastRatio`’s terms — the page composes any formatting. ABSENT for a non-typography row, and for a declared step that named no leading.',
      examples: [1.1, 1.6],
    })
  ),
}).annotate({
  strictKeys: true,
  title: 'sovrium:strict-keys',
  identifier: 'DesignTokenRow',
})

export const designTokenFacetResponseSchema = Schema.Struct({
  items: Schema.Array(designTokenRowSchema).annotate({
    description: 'The resolved tokens, in document order, filtered by `group` when one was given',
  }),
  total: Schema.Int.annotate({
    description: 'How many rows this response carries',
  }),
  summary: designTokenSummarySchema,
  // A SECOND rows set on one body, bound by its own `rowsKey`. It rides here
  // rather than on an endpoint of its own because it is the same question one
  // level down — "what did this app declare, and what became of it?" — and a
  // panel drawing both would otherwise need two reads to answer it.
  //
  // NEVER filtered by `group`: a discarded declaration has no token group to
  // belong to, which is what being discarded means.
  discarded: Schema.Array(discardedDeclarationSchema).annotate({
    description:
      'Declarations this app made that did not become tokens — validated and read by nothing, or shipped with no faithful DTCG form. EMPTY, never absent, and never narrowed by `group`.',
  }),
}).annotate({
  strictKeys: true,
  title: 'sovrium:strict-keys',
  identifier: 'DesignTokenFacetResponse',
})

/** @public */
export type DesignTokenSummary = typeof designTokenSummarySchema.Type
/** @public */
export type DesignTokenQuery = typeof designTokenQuerySchema.Type
/** @public */
export type DesignTokenFacetResponse = typeof designTokenFacetResponseSchema.Type
/** @public */
export type DiscardedDeclaration = typeof discardedDeclarationSchema.Type
/** @public */
export type DesignTokenRow = typeof designTokenRowSchema.Type
