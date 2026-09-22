/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { optionalField } from '@/domain/models/api/combinators/optional-field'
import { componentTypeRefusalStateSchema } from './component-types-catalogue'
import {
  componentTypeAxisValueSchema,
  componentTypeCellSchema,
  componentTypeFieldSchema,
  componentTypeRouteSchema,
  componentTypeSharedModuleSchema,
  componentTypeSiblingSchema,
  componentTypeStateSchema,
} from './component-types-parts'

export const componentTypeDetailSchema = Schema.Struct({
  type: Schema.String.annotate({
    description: 'The type literal, exactly as an author writes it in config',
  }),
  category: Schema.String.annotate({
    description: 'The published category slug this type belongs to',
  }),
  // ─── THE SAME LINE THE SUMMARY CARRIES, FROM THE SAME SOURCE ─────────────
  //
  // A type's page opens with the one sentence saying what the type is FOR, and
  // that page binds the DETAIL read — so a field published only on the summary
  // row is a field the page cannot reach. It bound the list endpoint and threw
  // away every row but one, or it went without the deck entirely.
  //
  // Published from `COMPONENT_TYPE_PURPOSES`, the same constant the summary
  // reads, so the two can never say different things about one type. Not a
  // second copy: one source, two records that both need it.
  purpose: Schema.String.annotate({
    description:
      'The one line saying what this type is FOR — the same sentence the summary row carries, from the same source.',
    examples: ['One choice among many, folded until opened.'],
  }),
  title: Schema.String.annotate({
    description: "Human-readable heading of this type's category — see the summary contract",
  }),
  href: Schema.String.annotate({
    description: 'Mount-relative route of this page in the console',
  }),
  own: Schema.Array(componentTypeFieldSchema).annotate({
    description: 'The fields this type declares itself, in declaration order',
  }),
  shared: Schema.Array(componentTypeSharedModuleSchema).annotate({
    description:
      'The shared field modules this type spreads, as ROWS, never their fields. Rows and not a string array for the reason `variants` and `routes` are rows: `rowsKey` hands a template a record, and `$record.` cannot name a field of a bare string.',
  }),
  variant: optionalField(
    componentTypeFieldSchema.annotate({
      description: 'The field carrying a variant axis, when this type declares one',
    })
  ),
  size: optionalField(
    componentTypeFieldSchema.annotate({
      description: 'The field carrying a size union, when this type declares one',
    })
  ),
  variants: Schema.Array(componentTypeAxisValueSchema).annotate({
    description:
      'The values of this type’s variant axis, FLAT. Empty for the large majority that declare none. The same members are still nested under `variant.members`; this is the copy a row template can bind, since `rowsKey` is a flat `body[key]` lookup and `$record.` cannot walk a path.',
  }),
  sizes: Schema.Array(componentTypeAxisValueSchema).annotate({
    description:
      'The values of this type’s size axis, FLAT, on the same terms as `variants`. A numeric `size` (qr-code) is not an axis and answers empty — only a closed union is one.',
  }),
  states: Schema.Array(componentTypeStateSchema).annotate({
    description:
      'The states this type’s CATEGORY draws, in reading order. EMPTY — never absent — for the ten categories that draw none, because "this category has no states" and "nobody published states" are different facts and only the first is true.',
  }),
  // ─── THE ONE ARRAY A NESTED ROW TEMPLATE CANNOT REPLACE ──────────────────
  //
  // The two arrays above are each bindable on their own, and the matrix they
  // describe is not: every cell must be addressable as
  // `design-system-specimen-<type>-<variant>-<state>`, an identifier composed
  // from BOTH axes, and a nested binding replaces the outer row with the inner
  // rather than merging them. See `componentTypeCellSchema` for the spec that
  // pins it and the resolver path that implements it.
  //
  // Each alternative shape was measured, and each fails differently:
  //
  //   variants outer, states inner  the cell knows the state, not the variant
  //   states outer, variants inner  the mirror image
  //   a states legend in a FIXED variant  restates a registry fact in config —
  //                                       the `category eq 'ai'` mistake one
  //                                       axis over — and a literal axis value
  //                                       is membership-checked against the
  //                                       type's own union, which one
  //                                       `$param.type` page cannot satisfy for
  //                                       85 different types
  // state markers on every cell breaks `[internal ref]`, which
  //                                 pins each state at `toHaveCount(1)`; the
  //                                 builder avoids that with an outer-row-INDEX
  //                                 condition config has no operator for —
  //                                 which is why the cell carries `exhibit`
  //                                 rather than leaving the reading end to
  //                                 guess the first row from its variant's name
  //
  // ─── ADMITTED UNDER [internal ref], ON `snippet`'S TERMS EXACTLY ───────────────
  //
  // [internal ref] refuses a field embedding a choice belonging to the console — a
  // word, a sentence, a label, a reading order — and admits a fact the console
  // cannot compute or a MECHANICAL projection of a payload the response already
  // describes. This is the second, and more plainly so than `snippet`: a cross
  // product of two arrays published beside it, with no word and no sentence
  // anywhere in it. Its order is the two axes' own published order rather than
  // one chosen here.
  //
  // ORDER, and it is contract: variants OUTER, states INNER — one run of cells
  // per variant, the states in their published reading order within it. That is
  // the drawn matrix's own layout (a row per variant, its states as columns),
  // so a page rendering these rows as received reproduces it without declaring
  // a sort it has no operator for.
  //
  // EMPTY when EITHER axis is empty, which is the product rather than a special
  // case: 71 of the 91 catalogued types answer `[]` here. Deliberately NOT the
  // drawing side's shape — `variantMatrix` substitutes a synthetic `default`
  // column for a type whose category draws no states, so a variants-only type
  // still draws something. That substitution is a RENDERING choice, and
  // publishing it would put a state on the wire the type's category does not
  // have.
  //
  // Computed by `variantStateCells` in `domain/models/app/design`, from the
  // exact arrays published above as `variants` and `states` — so
  // `cells.length === variantCount * stateCount` holds by construction, and the
  // drawn matrix and the published one cannot come to disagree.
  cells: Schema.Array(componentTypeCellSchema).annotate({
    description:
      'Every variant of this type drawn in every state its category draws, FLAT — variants outer, states inner, each axis in its own published order. The one shape a config page can render the matrix from: a nested binding replaces the outer row with the inner, so a cell beneath it can name one axis but never both, while the cell’s identifier is composed from both. EMPTY — never absent — when either axis is empty, which is the product rather than a special case.',
  }),
  // ─── [internal ref]: A CATALOGUED TYPE HAS A PAGE, DRAWABLE OR NOT ──────────────
  //
  // The same two fields the summary row carries, for the same reason and read
  // the same way: a page documenting a type the catalogue REPORTS rather than
  // draws must carry the reason where the canvas would be. Publishing them on
  // the detail as well is what lets one page template serve all 85 types — a
  // config page has no `if`, so the gate has to arrive as a field.
  //
  // What is NOT here is a `drawable: false` that also empties `own` / `variant`
  // / `states`. A refused type's FIELDS are exactly as real as a drawn one's:
  // the refusal is about the preview frame, not about the schema, and an author
  // writing `form` needs its props documented more than most.
  drawable: Schema.Boolean.annotate({
    description:
      'Whether the catalogue has a drawing for this type. `false` for one it reports rather than draws — its fields are published either way.',
  }),
  refusalReason: optionalField(
    Schema.String.annotate({
      description:
        'The catalogue’s own sentence for why this type is not drawn, when it has one on file. ABSENT for a drawn type, and absent for a refused one the catalogue has no sentence for — an empty reason under a missing canvas reads as a rendering failure.',
    })
  ),
  /** Read exactly as the summary row reads it, and absent on the same terms. */
  refusalState: optionalField(componentTypeRefusalStateSchema),
  // ─── THE COUNTS ARE THE PAGE'S ONLY WAY TO OMIT A SECTION ────────────────
  //
  // The same three scalars the summary row carries, for a different job. On a
  // card they populate a meta line; here they are GATES. A type page draws a
  // variant matrix only for a type that has variants, a sizes row only for one
  // that has sizes — and a `visibility.record` predicate can read `variantCount
  // gt 0` where it cannot read "the `variants` array is non-empty": the
  // operators compare a field against a scalar, and there is no length operator
  // and no presence operator.
  //
  // The section must be ABSENT rather than empty, which is what makes this a
  // count and not a styling concern: the criterion asserts `toHaveCount(0)` for
  // a type with no variant union, so an empty section headed "Variants" would
  // fail while documenting an axis the type does not have.
  variantCount: Schema.Int.annotate({
    description:
      'How many values this type’s variant axis carries; `0` — never absent — when it declares none. The gate a page reads to omit the variants section entirely.',
  }),
  sizeCount: Schema.Int.annotate({
    description: 'How many values this type’s size axis carries; `0` when it declares none.',
  }),
  stateCount: Schema.Int.annotate({
    description:
      'How many states this type’s CATEGORY draws; `0` for the categories that draw none.',
  }),
  // ─── THE COUNT THAT ASKS "CAN IT BE DRAWN", NOT "DOES IT EXIST" ──────────
  //
  // `stateCount` is a fact about the VOCABULARY: how many states the category
  // distinguishes, which is four for `interactive` whether or not a single one
  // of them can be painted. So a type whose specimen the catalogue refuses
  // reports four states, passes a `stateCount gt 0` gate, and draws four cells
  // each holding the same refusal sentence — a heading over four apologies,
  // which is the block the 2026-09-16 review asked to be dropped rather than
  // explained.
  //
  // Published rather than derived on the page for the ordinary reason the two
  // counts above are: `visibility.record` compares one field against a scalar.
  // It has no way to ask whether a refusal sentence is present, and the page
  // cannot AND a count with a presence check even if it could.
  //
  // It is a COUNT rather than a boolean so it reads as a sibling of the three
  // gates beside it and a page swaps one field name for another — and so a
  // caller that wants "how many cells will this strip actually hold" gets the
  // number rather than having to re-multiply.
  drawableStateCount: Schema.Int.annotate({
    description:
      'How many of this type’s states can actually be DRAWN: `stateCount` where the catalogue draws a specimen, and `0` where it refuses one — every cell of a refused type can only repeat the same refusal. The gate a page reads to drop the States section rather than fill it with apologies.',
  }),
  // ─── THE ONE DISJUNCTION THE COUNTS ABOVE CANNOT EXPRESS ─────────────────
  //
  // Variants and states share ONE section, because a variant matrix draws its
  // states as its columns and a type with no variant union draws them as a row
  // instead — two shapes of one exhibit, under one heading, reached by one rail
  // entry. So the section exists when EITHER count is non-zero, and
  // `visibility.record` ANDs its operators over ONE field: there is no `or`.
  //
  // Measured over the 91 catalogued types, which is why this is a field and not
  // an authoring trick:
  //
  //   both > 0        3  (alert, badge, button)
  //   variants only   6  (image, progress, skeleton, …)
  //   states only    14  (input, checkbox, link, date-picker, …)
  //   neither        71
  //
  // Two sibling entries each gated on one count would draw TWICE on those 3 —
  // and `button` is the type the rail criterion pins at exactly six entries with
  // exact text, so the duplicate is a hard failure rather than a blemish.
  // Gating on either count alone silently loses 14 pages or 6.
  //
  // Published rather than closed with a new `visibility.record.anyOf`, and that
  // was decided by census rather than by taste: the remaining four console
  // pages were audited for OR-shaped gates and returned ZERO between them. One
  // site does not earn a widening of the gate language every operator config
  // then inherits — and the one OR-shaped need found elsewhere disjoins a
  // RECORD gate with a QUERY gate, which an `anyOf` over record fields could
  // not have closed anyway.
  //
  // Same shape as `drawable` beside `specimenState`, and as `defaultState` on
  // the env read: a fact the server computes because the page has no operator
  // for it.
  hasVariantsOrStates: Schema.Boolean.annotate({
    description:
      'Whether this type draws a variants-and-states section at all — `true` exactly when `variantCount` or `stateCount` is non-zero. The gate for the ONE section whose presence is a disjunction, which `visibility.record` cannot express because it ANDs its operators over a single field.',
  }),
  // ─── THE ONE LINE THAT IS ABOUT THE READER RATHER THAN THE PLATFORM ──────
  //
  // Every field above describes what the ENGINE accepts, and answers the same
  // on two instances of one build. This one describes what THIS operator wrote:
  // whether the rendering app restyled the type under `design.components`. It
  // is the type page's counterpart to the Overview's declaration ledger, asked
  // of one type instead of one layer, and read the same way — the operator's
  // config is consulted for the key, and a key nobody wrote is a gap.
  //
  // Published rather than left to the page, because a config page cannot ask
  // the question at all. `design.components` is keyed by TYPE, so answering it
  // means indexing a record by this page's own route parameter, and
  // `visibility.record` compares a field against a literal — there is no
  // dynamic lookup, no presence operator, and no way to reach a sibling key of
  // the config from a row. The alternative on offer was a chip hardcoded to
  // `Not configured`, which is confidently wrong for every app that DID restyle
  // the type, on the one line of the page that is about them.
  //
  // `false` where `design.components` has no key at all — see `styleable`
  // below, which is what a page gates on so it never points a reader at a key
  // AppSchema refuses.
  configured: Schema.Boolean.annotate({
    description:
      'Whether the rendering app restyled this type under `design.components` — `true` when the operator wrote a non-empty entry for it, `false` for a type running on the platform’s own recipe. The one fact on this response about the reader’s own config rather than about the engine. Always `false` where `styleable` is `false`, since there is no key to write.',
  }),
  // ─── WHETHER `configured` IS A GAP OR A NON-QUESTION ─────────────────────
  //
  // `configured: false` has two meanings and a reader cannot tell them apart:
  // "nobody wrote this key yet" and "there is no such key". This separates
  // them, and it exists because the difference is ACTIONABLE — the first is an
  // invitation to write `design.components.<type>`, and the second is an
  // invitation to write config AppSchema refuses.
  //
  // WHAT IT ACTUALLY MEANS, spelled out because the short reading is wrong:
  // the type owns an element the ENGINE draws and can therefore carry a class,
  // so `design.components` has a key for it. `command-palette` does not — it
  // emits no server-side markup at all, only a JSON config block and the
  // runtime that builds its overlay in the browser — so an entry could only
  // ever be a no-op, and the key is absent rather than accepted and ignored.
  //
  // MEASURED, because the obvious assumption is wrong: the registry's
  // `UNSTYLEABLE_COMPONENT_TYPES` names TWO types, and only one of them can
  // reach this response. `customHTML` is not catalogued at all — the detail
  // route 404s it — so the set this field distinguishes is the INTERSECTION of
  // unstyleable and catalogued, which is exactly one of 80 types today. Do not
  // restate either name in a consumer: the pair is a property of the component
  // registry, and a third entry there must reach a surface through this field
  // rather than through someone remembering.
  //
  // NOT `drawable`, and the two disagree in a way that matters. `drawable` is
  // about the CATALOGUE's preview frame: `form` is refused a
  // drawn specimen because rendering a live submit control on a documentation
  // page is not safe. They are fully styleable — their `design.components`
  // key exists and works. So a type can be `drawable: false, styleable: true`,
  // and reading either field as the other is wrong in both directions.
  //
  // Derived from `ENGINE_COMPONENT_TYPES`, never from a list restated here: the
  // exclusion set is two names today and is a property of the component
  // registry, so a third type added there must reach this field without anyone
  // remembering to edit it.
  styleable: Schema.Boolean.annotate({
    description:
      'Whether `design.components` has a key for this type — `true` when the engine draws an element that can carry the operator’s classes. `false` for a catalogued type that owns no engine-drawn element, where an entry could only be a no-op and the key does not exist; `command-palette`, whose overlay is built client-side, is the only such type today. NOT the same as `drawable`: a type the catalogue refuses to PREVIEW (`form`) is still styleable. The gate for any surface that offers a reader the key to write — `configured: false` under `styleable: false` is a non-question, not a gap.',
  }),
  // The count is NOT derivable from `routes` for the same reason as above —
  // there is no length operator — and the page prints it as a figure beside the
  // list. `0` gates the honest empty state ("not used on any page") against the
  // table, which is the one case a bare list cannot express: an empty list and a
  // missing read look identical.
  pageCount: Schema.Int.annotate({
    description:
      'How many of the operator’s routes write this type anywhere in their component tree. `0` — never absent — for a type nobody uses.',
  }),
  routes: Schema.Array(componentTypeRouteSchema).annotate({
    description:
      'The operator’s own routes that write this type, as rows, in route order. EMPTY — never absent — for a type nobody uses. Capped by `?routesLimit=` when the caller asks for a cap.',
  }),
  // ─── THE REMAINDER, AND WHY IT IS A FACT RATHER THAN A CHOICE ────────────
  //
  // [internal ref] refuses a field embedding a choice belonging to the console and
  // admits a fact the console cannot compute. "Show the first six" is a
  // CHOICE — how many chips fit is a design decision, and it stays in config,
  // which is why the cap arrives as `?routesLimit=` rather than being written
  // here. What config cannot do is SUBTRACT: `$record.` names a field, there is
  // no arithmetic, and `pageCount` minus a cap is unreachable.
  //
  // So the console asks for the cap and the server answers with the remainder.
  // Zero — never absent — when nothing was cut, which is the gate for drawing
  // no overflow label at all: an absent field and a remainder of zero are the
  // same picture and only one of them is testable.
  routesMore: Schema.Int.annotate({
    description:
      'How many routes `routes` omitted because of `?routesLimit=`. `0` — never absent — when the list is complete, which is the gate for showing no overflow label.',
  }),
  siblings: Schema.Array(componentTypeSiblingSchema).annotate({
    description:
      'Every other catalogued type in this type’s category, in category order, each with its own address. EMPTY for a category of one.',
  }),
  // EXACT PARITY WITH `pageCount` BESIDE `routes`, and for the identical
  // reason: `visibility.record` has no length operator, so `siblings.length` is
  // unreachable where `siblingCount eq 0` is not. Without it the "only type in
  // its category" empty state has no gate at all.
  //
  // The workaround it replaces is worth recording, because it typechecks and
  // renders correctly today: gate on `category eq 'ai'`, the one category that
  // currently has a single member. That is a REGISTRY FACT restated in config —
  // it goes wrong silently the day a second AI type is catalogued, or the day
  // another category shrinks to one, and neither event touches the page that
  // would then be lying. A count is the fact itself.
  siblingCount: Schema.Int.annotate({
    description:
      'How many OTHER catalogued types share this type’s category. `0` — never absent — for the only type in its category, which is the gate for that empty state.',
  }),
  // ─── ADMITTED UNDER [internal ref], AND THE TEST IS WORTH RESTATING ─────────────
  //
  // [internal ref] refuses a field that embeds a choice belonging to the console — a
  // word, a sentence, a label, a reading order — and admits a fact the console
  // cannot compute or a MECHANICAL SERIALIZATION of a payload the response
  // already describes. This is the second: `specimenSnippet` walks the drawn
  // component and prints its own keys, in its own order, with no editorial
  // choice anywhere in it, and a config page has no string operations with which
  // to walk a component tree at all.
  //
  // It is deliberately the SAME serialiser the anatomy panel spends, so the
  // snippet and the drawn control cannot come to disagree — two projections of
  // one definition, checked against each other on every run.
  //
  // ABSENT for a refused type, because there is no drawn specimen to serialise.
  // A snippet for a type nothing draws would be config that produces nothing,
  // offered for copying.
  snippet: optionalField(
    Schema.String.annotate({
      description:
        'The drawn specimen serialised as config, verbatim — the same serialisation the anatomy panel prints. ABSENT for a refused type: there is no specimen to serialise.',
      examples: ['type: button\nvariant: destructive'],
    })
  ),
  // ─── THE MACHINE-READABLE HALF OF THE SAME PROJECTION ────────────────────
  //
  // `snippet` is what a reader copies; this is what a checker compares. Both
  // are projections of ONE object — the specimen's own component definition —
  // which is the whole anti-drift guarantee: a config block hand-written beside
  // a specimen drifts SILENTLY, because nothing renders it and so nothing
  // disagrees when the props change.
  //
  // A config page cannot produce this half. It would have to walk a component
  // tree and serialise it, and a config page has no string operations at all.
  // So the projection that the builder did in code arrives as a field, and the
  // page stamps it where the builder stamped it.
  //
  // Admitted under [internal ref] on the same footing as `snippet` beside it, and by
  // the same test: `JSON.stringify` over the specimen's own props makes no
  // editorial choice anywhere — no word, no sentence, no reading order. It is a
  // mechanical serialization of a payload this response already describes.
  //
  // It is an ORACLE field and not a layout one. It says nothing about where the
  // specimen sits or how it is styled; it says what the specimen was drawn
  // WITH, which is the fact the snippet must agree with.
  //
  // ABSENT for a refused type, on `snippet`'s terms exactly: nothing was drawn,
  // so there are no drawn props to report.
  drawnProps: optionalField(
    Schema.String.annotate({
      description:
        'The props the catalogue specimen was actually drawn with, as a JSON object — the machine-readable projection of the same definition `snippet` prints in config form, so the two cannot come to disagree. ABSENT for a refused type.',
      examples: ['{"variant":"destructive","label":"Delete"}'],
    })
  ),
}).annotate({
  strictKeys: true,
  title: 'sovrium:strict-keys',
  identifier: 'ComponentTypeDetail',
})

/** @public */
export type ComponentTypeDetail = typeof componentTypeDetailSchema.Type
