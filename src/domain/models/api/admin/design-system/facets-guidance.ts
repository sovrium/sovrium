/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { optionalField } from '@/domain/models/api/combinators/optional-field'

// ---------------------------------------------------------------------------
// The declared guidance, split into the two registers
// ---------------------------------------------------------------------------

/**
 * Which declaration a guidance row came from.
 *
 * ─── ONE DISCRIMINATOR, SPELLED AS THE CONFIG PATH ─────────────────────────
 *
 * The alternative was two fields — a `kind` naming the subject and a `register`
 * naming which of its sentences this is — and it reads worse at every call
 * site: a page filtering for "the avoid list" would carry two query params, and
 * a row would be addressable only by the pair. Spelling the whole position into
 * one closed union makes `?kind=voice.avoid` mean exactly one thing.
 *
 * A component declares up to three registers (`usage`, `when`, `dont`) and they
 * are three different sentences answering three different questions, so they
 * are three kinds rather than three fields on one row: the Components page
 * draws them under three headings, and a row shape carrying two empty
 * sentences would need a filter in the page to avoid drawing blank ones.
 *
 * Zone voice is listed separately from app voice for the same reason it is a
 * separate declaration: a rule that applies to one zone is not a house rule,
 * and merging them would tell a reader the marketing zone's tone governs the
 * whole app.
 */
export const guidanceKindSchema = Schema.Literals([
  'principle',
  'voice.personality',
  'voice.pronoun',
  'voice.prefer',
  'voice.avoid',
  'voice.tone',
  'colorRole',
  'component.usage',
  'component.when',
  'component.dont',
  'zone.voice.pronoun',
  'zone.voice.prefer',
  'zone.voice.avoid',
  'zone.voice.tone',
  // The two families the Brand page draws and no kind carried. Both are
  // declared SENTENCES, which is what this facet is for — the mark's GEOMETRY
  // (clear space, minimum width, the renderings) is not, and lives on the brand
  // facet instead. Additive: a caller filtering on an existing kind is
  // unaffected, and the union stays closed so a typo is still a 400.
  'imagery.principles',
  'imagery.photography',
  'imagery.iconSet',
  'imagery.patterns',
  'logo.misuse',
]).annotate({
  description: 'Which declaration this sentence was written in, spelled as its config position',
})

/**
 * One declared sentence of guidance, split into the register a reader obeys and
 * the reason the same line gave for it.
 *
 * ─── THE SPLIT IS SERVER-SIDE, AND IT HAS TO BE ────────────────────────────
 *
 * `design.voice.prefer` is an array of bare strings, and every entry
 * `apps/website` ships is written as an instruction followed by its rationale,
 * because that is how a writing rule is usefully stated. Separating the two is
 * `splitGuidanceLine` (`domain/models/app/design/guidance-line.ts`), which is quote-aware
 * precisely because a naive split-on-first-period cuts through
 * `…"Sovrium runs the application. On your own infrastructure."` and produces
 * two halves that each look plausible alone.
 *
 * A config page has no string operations at all, so the split cannot move to
 * the page. Publishing the raw line and letting a renderer split it would
 * duplicate a quote-parser into the presentation layer, where the second copy
 * would drift from the first. So the endpoint runs the shipped splitter and
 * publishes both halves.
 *
 * The invariant the console's whole claim rests on — *these are the operator's
 * own words* — is that `instruction` and `reason` rejoin to the declaration
 * exactly, with one space between them. `[internal ref]` asserts it
 * against the page, and it holds here by construction: the splitter cuts at one
 * index and trims the whitespace that spanned the cut.
 *
 * `reason` is ABSENT, never empty, for a single-sentence rule. A blank second
 * register would draw an empty paragraph under every one-line rule, and
 * fabricating a rationale to fill it would be a worse lie than no second
 * register at all.
 */
export const guidanceRowSchema = Schema.Struct({
  kind: guidanceKindSchema,
  index: Schema.Int.annotate({
    description:
      'This row’s position within its own kind, zero-based — the sequence a reader sees. Published because a config page has neither arithmetic nor a list counter, so a row template printing `01` or stamping an addressable ordinal cannot derive it; and a `components[x].guidance.usage` address carries no number to parse. Where `path` does carry one, the two agree.',
    examples: [0, 2],
  }),
  ordinal: Schema.String.annotate({
    description:
      'The literal a page PRINTS beside this row: one-based and zero-padded to two digits. Published rather than derived because a config page has no arithmetic and no string operations — it cannot add one to `index`, and it cannot pad the result. `index` stays for a page that wants the number.',
    examples: ['01', '12'],
  }),
  path: Schema.String.annotate({
    description:
      'Where this sentence is declared, as a config address. Unique across the response, and the same vocabulary the export uses to report an unmappable token.',
    examples: ['design.voice.prefer[2]', 'components[section-header].guidance.usage'],
  }),
  label: Schema.String.annotate({
    description:
      'The subject this sentence is about, in a reader’s words: a colour role, a component name, a tone moment, a zone. Empty for a declaration that has no subject but itself, such as a principle.',
    examples: ['primary', 'section-header', 'error'],
  }),
  instruction: Schema.String.annotate({
    description: 'The sentence a reader must obey. Never empty.',
  }),
  reason: optionalField(
    Schema.String.annotate({
      description:
        'Why, when the declared line said. Absent — never empty — when the line was one sentence.',
    })
  ),
  pairsWith: optionalField(
    Schema.String.annotate({
      description:
        'The role this one is meant to be used against, when the declaration named one. Colour roles only.',
      examples: ['on-primary'],
    })
  ),
  verdict: optionalField(
    Schema.Literals(['prefer', 'never']).annotate({
      description:
        'Whether this rule asks for something or forbids it. IMAGERY rows only, where the two are drawn as separate columns and a page has no string test to tell them apart. Absent — never `prefer` by default — on every other kind, because a principle or a colour-role note is neither. The vocabulary is `prefer` / `never` because a page stamps the value VERBATIM into `data-design-imagery-verdict`, and that is what the shipped attribute already carries.',
    })
  ),
}).annotate({
  strictKeys: true,
  title: 'sovrium:strict-keys',
  identifier: 'GuidanceRow',
})

/**
 * The query a guidance read carries.
 *
 * An unknown `kind` is refused by the union rather than answered empty, because
 * unlike a token group the set of kinds is CLOSED and named here: a caller
 * asking for `voice.forbid` has made a mistake the contract can name, and
 * answering it with zero rows would let that mistake ship as an empty table.
 */
export const guidanceQuerySchema = Schema.Struct({
  kind: optionalField(
    guidanceKindSchema.annotate({
      description: 'Restrict to one declaration. Omit for every sentence the app declares.',
    })
  ),
  // ─── NARROWING TO ONE SUBJECT, AND WHY THAT IS A FILTER AND NOT A FIELD ──
  //
  // `[internal ref]` draws one card per declared reusable component,
  // each carrying its OWN `components[].guidance` beside its specimen. The card
  // is a row of the usage facet, and a row template binds one rows source — so
  // the guidance has to arrive either as more fields on `usageRowSchema` or as
  // a second read the card makes for itself.
  //
  // It is this, and the reason is drift rather than taste. Those sentences are
  // ALREADY published: this facet carries each one as an `instruction` and its
  // `reason`, cut apart by the quote-aware `splitGuidanceLine`, with its
  // `path`, its `ordinal` and its `index`. Copying the raw `usage` / `when` /
  // `dont` onto a usage row would publish one operator sentence in a SECOND,
  // unsplit shape from a second endpoint — a card printing the whole line where
  // every other guidance surface prints the two registers, and a second
  // unchecked path around the rejoin invariant `[internal ref]`
  // asserts. One fact, one shape: the same rule the module header states for
  // `?flat=1` against the console's own token read.
  //
  // A card reaches it through a nested `{ system }` binding whose `query`
  // carries `$record.name` — the bounded depth-2 expansion
  // `[internal ref]` landed, and the reference position it
  // permits. The cost is stated plainly: one request per card rather than one
  // per page, bounded by the number of templates an operator hand-writes in
  // `components[]` (four across the two shipped apps).
  //
  // An unknown `label` answers ZERO rows rather than 404, matching
  // `usageQuery.name` exactly: whether a subject exists is the catalogue's and
  // the config's question, and duplicating that judgement here would give two
  // endpoints an opportunity to disagree. It is an open string for the same
  // reason — a label is a component name, a colour role or a zone, all of them
  // the operator's own words, so there is no closed set to check against.
  label: optionalField(
    Schema.String.annotate({
      description:
        'Restrict to the sentences about one subject — a component name, a colour role, a tone moment, a zone. Matched exactly against the row’s own `label`. An unknown subject answers zero rows, never 404. Composes with `kind`.',
      examples: ['site-header', 'primary'],
    })
  ),
}).annotate({
  strictKeys: true,
  title: 'sovrium:strict-keys',
  identifier: 'GuidanceQuery',
})

/** Every sentence the app declares, as rows — the shared envelope. */
export const guidanceListResponseSchema = Schema.Struct({
  items: Schema.Array(guidanceRowSchema).annotate({
    description:
      'The declared sentences, in declaration order, filtered by `kind` when one was given',
  }),
  total: Schema.Int.annotate({
    description: 'How many rows this response carries',
  }),
}).annotate({
  strictKeys: true,
  title: 'sovrium:strict-keys',
  identifier: 'GuidanceListResponse',
})

/** @public */
export type GuidanceKind = typeof guidanceKindSchema.Type
/** @public */
export type GuidanceRow = typeof guidanceRowSchema.Type
/** @public */
export type GuidanceQuery = typeof guidanceQuerySchema.Type
/** @public */
export type GuidanceListResponse = typeof guidanceListResponseSchema.Type
