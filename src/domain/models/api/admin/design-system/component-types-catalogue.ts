/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { optionalField } from '@/domain/models/api/combinators/optional-field'

// ---------------------------------------------------------------------------
// The catalogue, as rows
// ---------------------------------------------------------------------------

/**
 * One component type as the catalogue lists it.
 *
 * ─── `title` IS THE CATEGORY'S HEADING, NOT THE TYPE'S ─────────────────────
 *
 * Nothing in the product owns a human-readable name for an individual type:
 * the registry's only display strings are its per-CATEGORY headings
 * (`interactive` → `Interactive`), and the type literal (`table`) is what
 * an author actually writes in config, so title-casing it here would invent a
 * second name for the same thing and put the invented one on the card.
 *
 * So a row carries the type VERBATIM and the heading of the group it belongs
 * to — which is exactly what a card index grouped by category needs, and is
 * the only human-readable string that has a source.
 *
 * ─── `excludedReason` NAMES THE ENGINE'S EXCLUSION, NOT THE MISSING CANVAS ─
 *
 * An excluded type is LISTED, not hidden. Its absence would read as "this type
 * does not exist", which is false and unactionable; its presence with the
 * reason attached tells an author both that the type is real and what the
 * engine will not let them do with it. The reason is the type's OWN sentence
 * rather than a shared one — a single sentence pasted across N types goes false
 * on all N together, and no reader can tell which one it stopped describing.
 *
 * It is NOT the signal that a row carries no canvas, and the two came apart the
 * day one type had two answers. `form` is excluded because its BOUND modes emit
 * a live submit control, which is also why a `specimen` may not be pointed at
 * it; its bare mode carries no action and no submit path, so the catalogue
 * draws that and the row reads `drawable: true`. `refusalReason` is the field
 * that always travels with a missing canvas, and `drawable` is the gate.
 */
/**
 * WHY a type is reported rather than drawn — the catalogue's own three-value
 * vocabulary, published verbatim.
 *
 * ─── THE WIRE WORD IS THE CODE WORD ────────────────────────────────────────
 *
 * These are exactly the values `SpecimenRefusal.state` carries
 * (`domain/models/app/design/catalog-specimens`), for the reason
 * {@link classProvenanceLayerSchema} gives one paragraph down: the console's
 * whole job here is to say WHY a type is not drawn, so inventing a prettier
 * synonym would put a second name on one concept and hand every reader the job
 * of mapping between them.
 *
 *  - `no-renderer`       schema-accepted, and `COMPONENT_REGISTRY` has no entry.
 *                        Drawing an empty box under that heading would be the
 *                        catalogue asserting the defect is the design.
 *                        ZERO types carry it today — `tab-panel` was the only
 *                        one and C1 retired it — and that is its HEALTHY value,
 *                        not a reason to drop it: this literal names a DEFECT,
 *                        so the day it has a member is the day the catalogue
 *                        needs a word for one. Removing it would leave that
 *                        type classifiable as nothing at all.
 * `[internal ref]` is the guarantee that such a
 *                        type is caught by the catalogue rather than drawn as a
 *                        bare div: it sweeps every published category for a
 *                        specimen that neither draws nor reports.
 *  - `not-previewable`   renderable, and not HERE — a write control may not exist
 * inside a preview frame ([internal ref] A3), or the type needs a
 *                        render position this surface cannot give it.
 *  - `needs-data-source` renderable, and only over records the confidentiality
 *                        bound does not permit fetching.
 *
 * ─── WHY IT IS NOT `specimenState`, AND NOT `refusalReason` EITHER ─────────
 *
 * Three fields, three jobs, and no two of them derivable from each other by any
 * config page. `drawable` is the BOOLEAN a `visibility.record` predicate gates a
 * canvas on. `specimenState` is `drawn | refused` — the binary. This is the
 * REASON as a machine value, which is what a card stamps into
 * `data-design-specimen-state`, and narrowing `drawn | refused` to it would
 * leave a drawn type with no value to stamp at all.
 *
 * `refusalReason` is the same fact as a SENTENCE, and it is the one field on
 * this contract that [internal ref] would refuse if it were being added today: a
 * sentence crossing the wire can never be translated. It is grandfathered
 * because the catalogue owns the prose and no config page could compose it —
 * but a page choosing between the two should reach for this one, and print its
 * own copy per state.
 */
export const componentTypeRefusalStateSchema = Schema.Literals([
  'no-renderer',
  'not-previewable',
  'needs-data-source',
]).annotate({
  identifier: 'ComponentTypeRefusalState',
  description:
    'Why this type is reported rather than drawn, as the catalogue’s own machine value — the literal a card stamps into `data-design-specimen-state`.',
})

export const componentTypeSummarySchema = Schema.Struct({
  type: Schema.String.annotate({
    description: 'The type literal, exactly as an author writes it in config',
    examples: ['button', 'table'],
  }),
  category: Schema.String.annotate({
    description: 'The published category slug the registry places this type in',
    examples: ['interactive', 'form-controls'],
  }),
  title: Schema.String.annotate({
    description:
      "Human-readable heading of this type's CATEGORY — the registry's only display string. Not a name for the type itself; the type literal is what an author writes.",
    examples: ['Interactive', 'Form controls'],
  }),
  // ─── THE ONE LINE THAT SAYS WHEN TO REACH FOR THIS TYPE ──────────────────
  //
  // Required and never empty, unlike every other prose field on this row. The
  // axis meta line it replaced was EMPTY on more than half the catalogue, which
  // is what made it a strip of blank space rather than a fact; a sentence that
  // is sometimes absent would reproduce exactly that. The catalogue's own test
  // refuses a missing line, a line under 24 characters and two types sharing
  // one, so an absent value cannot reach the wire in the first place.
  //
  // It is PROSE crossing the wire, which [internal ref] would refuse for a field a
  // config page composes itself — and it is here for the same reason
  // `refusalReason` beside it is: the catalogue owns the words, and no page
  // built from config could write eighty of them. A page choosing between the
  // two reaches for the machine value; this one has no machine value to reach
  // for, because "what is this for" is not a state.
  purpose: Schema.String.annotate({
    description:
      'What this type is FOR, in one line, from the catalogue’s own map. Never empty: every catalogued type has one, and the catalogue’s test refuses a missing, too-short or duplicated line.',
    examples: ['One action, stated as a verb. A link when href is set, a button otherwise.'],
  }),
  excludedReason: optionalField(
    Schema.String.annotate({
      description:
        'Why this type is named in the engine’s exclusion list, carrying that type’s own sentence. NOT the same question as `drawable`: a type may be excluded from what a `specimen` can be pointed at and still have a mode the catalogue draws. `refusalReason` is the field that always travels with a missing canvas.',
    })
  ),
  href: Schema.String.annotate({
    description:
      "Mount-relative route of this type's detail page in the console. Relative so a second admin mount links its own copy rather than the first one.",
    examples: ['/design-system/ui-kit/button'],
  }),
  // ─── THE AXIS COUNTS ARE FLAT SCALARS, DELIBERATELY ──────────────────────
  //
  // A card that says "only the axes this type actually has" needs the three
  // numbers on the ROW. They are not grouped under an `axes` object, and the
  // reason is mechanical rather than stylistic: a row template reads its data
  // through `$record.<field>`, whose grammar is `[a-zA-Z0-9_]+` and admits no
  // dots, so `$record.axes.variants` would resolve `$record.axes` and leave
  // `.variants` as literal text on the page. A nested group would be a shape no
  // config page could read — which is the same flatness constraint that put
  // `variants` / `sizes` on the detail as rows.
  //
  // Counts rather than the values themselves: the LIST is 85 rows and the card
  // only needs to know whether an axis exists and how wide it is. The values
  // live on the detail, where a page draws them.
  variantCount: Schema.Int.annotate({
    description:
      'How many values this type’s variant axis carries. `0` — never absent — for the large majority that declare none.',
  }),
  sizeCount: Schema.Int.annotate({
    description: 'How many values this type’s size axis carries; `0` when it declares none.',
  }),
  stateCount: Schema.Int.annotate({
    description:
      'How many states this type’s CATEGORY draws; `0` for the ten of twelve categories that draw none.',
  }),
  // ─── THE TWO COUNTS THAT ARE NOT AXES ────────────────────────────────────
  //
  // A card meta line reporting only the three axes above is EMPTY on the 47
  // types that have none of them, which is a blank strip under more than half
  // the grid. The two counts below are what make omitting an absent axis safe
  // instead: `propCount` answers for all 85 — every type has at least one field,
  // its own or from a shared module — and `pageCount` is the one figure about
  // the operator's own app that a catalogue card can carry.
  //
  // `pageCount` is a JOIN, done here because a config page cannot do it. A row
  // template binds ONE rows source, so a card reading the catalogue cannot also
  // read `/api/admin/design-system/usage` and match by name — the same flatness
  // constraint that put the axis counts on the row, one level up. The walk it
  // joins is the HOISTED one (`usageFacet` traverses the config once for every
  // subject), so the count arrives for the price the usage endpoint already
  // charges its own list read, and this endpoint replaces a second request
  // rather than adding one.
  propCount: Schema.Int.annotate({
    description:
      'How many fields an author may write on this type — its own plus the shared modules it spreads. Never `0`: every catalogued type has at least one.',
  }),
  pageCount: Schema.Int.annotate({
    description:
      'How many of the operator’s routes write this type anywhere in their component tree. `0` — never absent — for a type nobody uses.',
  }),
  // ─── WHETHER THE CARD CARRIES A CANVAS ───────────────────────────────────
  //
  // A kit card is a container wrapping a specimen, and for a type the catalogue
  // REPORTS rather than draws it must carry the reason instead. Both halves are
  // published because a page has neither a test nor a default: `drawable` is
  // what `visibility.record` gates the canvas on, and `specimenState` is what
  // the wrapper stamps into `data-design-specimen-state` verbatim.
  //
  // They are not redundant. `drawable` is the GATE, a boolean the row-level
  // predicate can read; `specimenState` is the printed VALUE. Deriving either
  // from the other needs an `if` no config page has.
  drawable: Schema.Boolean.annotate({
    description:
      'Whether the catalogue has a drawing for this type. `false` for a type it reports rather than draws, and for one a preview frame may never carry.',
  }),
  specimenState: Schema.Literals(['drawn', 'refused']).annotate({
    description:
      'The literal a card stamps into `data-design-specimen-state`. `drawn` when there is a canvas; `refused` when the card carries a reason in its place.',
  }),
  refusalReason: optionalField(
    Schema.String.annotate({
      description:
        'The catalogue’s own sentence for why this type is not drawn, when it has one on file. ABSENT for a drawn type, and absent for a refused one the catalogue has no sentence for — a card showing an empty reason would read as a rendering failure.',
    })
  ),
  // ABSENT rather than `undefined`-valued for a drawn type, and absent for the
  // five refused types the catalogue holds no refusal record for (the
  // design-console primitives, which are simply not drawn AS specimens). It
  // travels with `refusalReason`: both are read off the same `SpecimenRefusal`,
  // so a card carrying a state always has a sentence to put beside it.
  refusalState: optionalField(componentTypeRefusalStateSchema),
  // ─── WHERE A DRAWN SPECIMEN'S ROWS CAME FROM ─────────────────────────────
  //
  // Seven of the drawn types read ROWS — the data-bound ones — and every one of
  // them reads the catalogue's own fixture endpoint. None reads an operator
  // table, and that is a CONFIDENTIALITY bound rather than a convenience: a
  // catalogue describes what the engine can draw, never what this instance
  // holds. The specimen wrapper already records it by stamping
  // `data-design-fixture-source="platform"`; this publishes the same fact as a
  // ROW field, which is the only shape a card built from config can stamp from.
  //
  // A boolean rather than the provenance STRING, for the reason `drawable` sits
  // beside `specimenState`: the page needs a GATE — `fixtureBacked eq true`
  // decides whether the mark is stamped at all — and there is exactly one value
  // to stamp when it fires, so publishing `'platform'` as data would be
  // publishing a constant. Should a second provenance ever exist, the value
  // becomes a literal union beside this gate rather than replacing it.
  //
  // `false` — never absent — for the other 84. A card asking "did this read
  // rows" of a type that reads none needs an answer, not a missing key: a
  // `visibility.record` predicate over an absent field does not fire, so the
  // mark would silently never appear and look exactly like a correct render.
  fixtureBacked: Schema.Boolean.annotate({
    description:
      'Whether this type’s specimen draws PLATFORM FIXTURE ROWS. `true` for the data-bound types the catalogue draws, each of which reads the catalogue’s own fixture endpoint and never an operator table; `false` — never absent — for every other type.',
  }),
}).annotate({
  strictKeys: true,
  title: 'sovrium:strict-keys',
  identifier: 'ComponentTypeSummary',
})

/**
 * The catalogue listing.
 *
 * `{ items, total }` is the shared rows envelope, not a shape invented here —
 * see the module header. `total` is the count of `items` in this response and
 * not a page count: the catalogue is not paginated, because it is bounded by
 * the schema rather than by data and a console that hid part of it would be
 * lying about what the engine draws.
 */
export const componentTypeCategorySchema = Schema.Struct({
  slug: Schema.String.annotate({
    description: 'The category key, exactly as a row’s `category` field carries it',
    examples: ['interactive', 'form-controls'],
  }),
  title: Schema.String.annotate({
    description: 'The registry’s own heading for this category — the string the kit index draws',
    examples: ['Interactive', 'Form controls'],
  }),
  count: Schema.Int.annotate({
    description:
      'How many types this category holds in THIS response. The counts sum to `total`, so a nav can print them without re-deriving a number the registry already knows.',
  }),
}).annotate({
  strictKeys: true,
  title: 'sovrium:strict-keys',
  identifier: 'ComponentTypeCategory',
})

export const componentTypeListResponseSchema = Schema.Struct({
  items: Schema.Array(componentTypeSummarySchema).annotate({
    description: 'Every component type the registry publishes, in category order',
  }),
  total: Schema.Int.annotate({
    description: 'How many types this response carries — the whole catalogue, never a page of it',
  }),
  // ─── COUNTED HERE BECAUSE EVERY CONSUMER WOULD OTHERWISE COUNT ───────────
  //
  // The console's kit index draws a category nav with a count beside each
  // heading. A config page cannot group its own rows — `rowsKey` hands a
  // template a flat list — so counting client-side means every consumer
  // re-deriving a number the registry already knows, and disagreeing with the
  // listing the first time a type moves category.
  categories: Schema.Array(componentTypeCategorySchema).annotate({
    description: 'One entry per category in this response, in the registry’s own order',
  }),
  // ─── THE SAME FIGURES, IN THE SHAPE A DOT PATH CAN ADDRESS ───────────────
  //
  // `categories` above is the readable shape and it is unbindable. A sidebar
  // badge is `{ endpoint, valuePath }` where `valuePath` is a DOT PATH into
  // this envelope (`layout/sidebar.ts`), and a dot path cannot index an array
  // by a member's field — so the console's navigation column, which draws one
  // count per category, could reach none of the twelve figures sitting right
  // there.
  //
  // Publishing the same count twice is deliberate and it is not a second
  // source: both projections come from ONE `componentTypeCategories(items)`
  // call, so they cannot disagree. `usageRowSchema` already made this exact
  // move for the same reason — `routes` for a caller, `routeRows` for a config
  // page — and says so on the field.
  //
  // Keyed by slug, which is why no slug may contain a `.`: a dot inside a key
  // would split into two hops and resolve nothing, silently.
  categoryCounts: Schema.Record(Schema.String, Schema.Int).annotate({
    description:
      'The same per-category figures as `categories[].count`, keyed by slug — the shape a dot path can address. Derived from the same count, so the two can never disagree.',
    examples: [{ interactive: 6, 'form-controls': 15 }],
  }),
}).annotate({
  strictKeys: true,
  title: 'sovrium:strict-keys',
  identifier: 'ComponentTypeListResponse',
})

/** @public */
export type ComponentTypeSummary = typeof componentTypeSummarySchema.Type
/** @public */
export type ComponentTypeListResponse = typeof componentTypeListResponseSchema.Type

export type ComponentTypeCategory = typeof componentTypeCategorySchema.Type

/** @public */
export type ComponentTypeRefusalState = typeof componentTypeRefusalStateSchema.Type
