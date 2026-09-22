/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { optionalField } from '@/domain/models/api/combinators/optional-field'

// ---------------------------------------------------------------------------
// One type's fields
// ---------------------------------------------------------------------------

/**
 * One field of a type's schema, as the props table renders it.
 *
 * Mirrors the domain's `TypeField` exactly, field for field. It is re-declared
 * here rather than derived because this is the WIRE contract and that is a
 * domain type: deriving would publish whatever the introspector happens to
 * carry next, which is precisely the drift a closed response object exists to
 * refuse.
 *
 * Every member but `name` and `accepts` is optional, and each absence is a
 * real state rather than a gap:
 *
 *  - `description` — the schema's own words, resolved through indirection.
 *    Absent when the schema declares none; never invented.
 *  - `defaultValue` — what the DECODER produces when the field is omitted,
 *    asked of the decoder rather than reconstructed from the AST. Exactly one
 *    field in the whole catalogue answers, which is also why the column is
 *    worth having: it is the only place that fact is stated at all.
 *  - `members` — present only for a closed literal union, which is the one
 *    thing an author cannot obtain without opening the schema.
 *  - `title` — the resolved schema's own title, which is what identifies a
 *    variant axis.
 */
export const componentTypeFieldSchema = Schema.Struct({
  name: Schema.String.annotate({
    description: 'The property name, as an author writes it',
    examples: ['variant', 'size'],
  }),
  accepts: Schema.String.annotate({
    description:
      "What the field accepts, in an author's vocabulary: a closed union's members joined, or the primitive's name",
    examples: ['default | destructive | outline', 'string'],
  }),
  description: optionalField(
    Schema.String.annotate({
      description: "The schema's own description, resolved through indirection. Never invented.",
    })
  ),
  defaultValue: optionalField(
    Schema.String.annotate({
      description: 'What the decoder produces when this field is omitted, when it declares one',
    })
  ),
  members: optionalField(
    Schema.Array(Schema.String).annotate({
      description: "The closed union's members. Absent, never empty, when the field is not one.",
    })
  ),
  title: optionalField(
    Schema.String.annotate({
      description: "The resolved schema's title — what identifies a variant axis",
      examples: ['Button Variant'],
    })
  ),
  // ─── THE GATE BESIDE `defaultValue`, AND WHY IT IS NOT REDUNDANT ─────────
  //
  // The props table prints one of exactly two things in its Default column: a
  // real schema default, or the console's own word for an absence. A config
  // page cannot choose between them from `defaultValue` alone — the field is
  // ABSENT when there is none, and `visibility.record` carries the nine value
  // comparisons and NO presence operator. So the cell is two sibling nodes,
  // one gated `hasDefault eq true` printing `$record.defaultValue`, one gated
  // `hasDefault eq false` printing the literal.
  //
  // Exactly the split the summary row already carries as `drawable` beside
  // `specimenState`: a boolean the predicate can read, beside the value it
  // selects. Deriving either from the other needs an `if` no config page has.
  //
  // The WORD is deliberately not published. Which noun stands for "no default"
  // is the console's wording, which is the editorial half [internal ref] refuses; the
  // page holds the literal and the API holds only the fact. `required` is
  // likewise never published — no catalogued field is required, and printing it
  // would state a constraint the decoder does not enforce.
  hasDefault: Schema.Boolean.annotate({
    description:
      'Whether this field declares a decoding default — `true` exactly when `defaultValue` is present. The gate a page reads to choose between printing that value and printing its own word for an absence.',
  }),
}).annotate({
  strictKeys: true,
  title: 'sovrium:strict-keys',
  identifier: 'ComponentTypeField',
})

/**
 * One shared field module a type spreads.
 *
 * ─── A ROW CARRYING ONE STRING, FOR THE REASON EVERY ARRAY HERE IS ONE ─────
 *
 * `shared` was a `readonly string[]`, and a bare string array is UNBINDABLE
 * from a config page: `rowsKey` is a flat `body[key]` lookup that hands a row
 * template a RECORD, and `$record.<field>` addresses a field of one. Strings
 * expand into rows with no fields at all, so every reference in the template
 * resolves to nothing and the module names arrive unprintable.
 *
 * The same fix already applied to `variants`, `sizes`, `routes` and `siblings`.
 * This was the last bare array left on the contract.
 *
 * It stays module NAMES rather than their fields, which is the split the detail
 * header argues: the module documents itself once, and repeating its fields
 * under every type that spreads it would be one sentence eighty-five times.
 */
export const componentTypeSharedModuleSchema = Schema.Struct({
  name: Schema.String.annotate({
    description: 'The shared field module this type spreads, as the module names itself',
    examples: ['props', 'visibility'],
  }),
}).annotate({
  strictKeys: true,
  title: 'sovrium:strict-keys',
  identifier: 'ComponentTypeSharedModule',
})

/**
 * Everything the per-type page reads out of one type's schema.
 *
 * ─── `own` AND `shared` ARE A SPLIT, NOT A DUPLICATION ────────────────────
 *
 * Composition is object spread, so by the time the schema exists a field from
 * a shared module is indistinguishable from one declared inline. The split is
 * computed by subtracting the shared modules BY REFERENCE — a type that
 * re-declares a shared key after its spread keeps its own field in its own
 * table, which two types actually do. `shared` therefore carries module NAMES,
 * not fields: the module documents itself once, and repeating its fields under
 * every type that spreads it would be the same sentence eighty-five times.
 *
 * `variant` and `size` are lifted OUT of `own` rather than removed from it: the
 * page draws a variants matrix and a sizes row from them, and a reader
 * scanning the props table still needs to see that the property exists.
 */
/**
 * One state a type's category draws, and where the drawing comes from.
 *
 * The distinction is the honest half and is published rather than inferred: a
 * `rendered` state is reached through a real attribute the renderer reads, so
 * the element IS in that state; a `depicted` one is a drawing, because
 * `:hover` and `:focus-visible` cannot be forced from markup. A page that hid
 * the difference would teach a reader that a hover row is as trustworthy as a
 * disabled one.
 *
 * The vocabulary itself is `domain/models/app/design/state-vocabulary.ts`,
 * NOT restated here: it is a closed table where ten of the twelve categories
 * draw nothing, and a second copy would invent states on the day the first one
 * grew.
 */
/**
 * One value of a type's variant or size axis.
 *
 * ─── WHY A ROW AND NOT A BARE STRING ───────────────────────────────────────
 *
 * A row template reaches its data through `$record.<field>`, whose grammar is
 * `[a-zA-Z0-9_]+` and admits NO dots — and `SystemRowsFetcher` hands the
 * expansion `Record<string, unknown>[]`. A `string[]` at `body[rowsKey]` would
 * therefore expand into rows with no fields at all, and every `$record.` in the
 * template would resolve to nothing. The axis is published as rows of objects
 * for exactly that reason, not for symmetry.
 *
 * `field` rides along because the axis is not always spelled `variant`: the
 * introspector LIFTS whichever field carries a closed union, and a page that
 * assumed the name would print the wrong config for a type that spells it
 * otherwise.
 */
export const componentTypeAxisValueSchema = Schema.Struct({
  value: Schema.String.annotate({
    description: 'The value an author writes in config',
    examples: ['destructive', 'sm'],
  }),
  field: Schema.String.annotate({
    description: 'The field this value is written on — lifted from the schema, not assumed',
    examples: ['variant', 'size'],
  }),
}).annotate({
  strictKeys: true,
  title: 'sovrium:strict-keys',
  identifier: 'ComponentTypeAxisValue',
})

/**
 * What a state applies TO — the whole component, or one row inside it.
 *
 * ─── WHY IT IS A SECOND AXIS AND NOT A FLAVOUR OF `source` ─────────────────
 *
 * A recipe's `props` and `style` are merged into the COMPONENT. So without a
 * scope, a consumer reads "a row is selected" as "the table is selected", and a
 * `style` recipe written for it would paint the whole table rather than one
 * row. Scope is ORTHOGONAL to `source`: a row state can be genuinely reached
 * (selection is a binding) or only depicted (hover is a pointer state), and
 * collapsing the two axes into one would lose whichever the name did not carry.
 */
export const componentTypeStateScopeSchema = Schema.Literals(['component', 'row']).annotate({
  description:
    '`component` — the state applies to the whole component. `row` — it applies to one row INSIDE it, so a consumer does not read a selected row as a selected table.',
})

export const componentTypeStateSchema = Schema.Struct({
  state: Schema.String.annotate({
    description: 'The state’s name, in a reader’s words',
    examples: ['hover', 'disabled'],
  }),
  source: Schema.Literals(['rendered', 'depicted']).annotate({
    description:
      '`rendered` — the element IS in this state, reached through an attribute the renderer reads. `depicted` — the state is drawn, because a browser pseudo-class cannot be forced from markup.',
  }),
  // OPTIONAL on the contract and ALWAYS set by the producer, which is not a
  // contradiction: this struct is `strictKeys`, so a producer emitting a key the
  // schema has not declared fails to ENCODE and the endpoint 500s — and a schema
  // demanding a key no producer sets yet 500s from the other side. Optional is
  // the only shape that admits both halves landing, in either order. The SPEC
  // demands it is present; the schema merely permits it.
  scope: optionalField(componentTypeStateScopeSchema),
}).annotate({
  strictKeys: true,
  title: 'sovrium:strict-keys',
  identifier: 'ComponentTypeState',
})

/**
 * One addressable cell of the variants × states matrix.
 *
 * ─── WHY BOTH AXES RIDE ON ONE ROW ─────────────────────────────────────────
 *
 * The cell's identifier is `design-system-specimen-<type>-<variant>-<state>`,
 * composed from BOTH axes — and no nesting of the `variants` and `states`
 * arrays can produce a row that names both.
 *
 * That is pinned by a GREEN spec rather than by an implementation detail:
 * `[internal ref]` says in as many words that inside an
 * inner template the inner record REPLACES the outer rather than merging with
 * it. `expandTemplate` implements exactly that — at depth 1 the outer row is
 * substituted into the inner node's own props and `dataSource` while its
 * CHILDREN are deliberately withheld, having not met their own rows yet; at
 * depth 2 those children are substituted against the inner row alone. So a
 * per-row cell beneath a nested binding can name the inner axis or the outer
 * one, never both, and the outer value survives only on the inner CONTAINER.
 *
 * Flat, the matrix is ONE rows binding with no nesting at all.
 *
 * `source` rides on the cell rather than being left on the `states` array
 * beside it, because the cell is what a page renders and a page cannot join two
 * arrays. Without it a matrix would present a depicted `hover` exactly as it
 * presents a rendered `disabled` — the claim `state-vocabulary.ts` exists to
 * refuse.
 *
 * `exhibit` rides on it for the harder version of the same reason: it is not a
 * fact about the cell at all but about its POSITION, and position is the one
 * thing a config page cannot recover. See the field's own note.
 */
export const componentTypeCellSchema = Schema.Struct({
  variant: Schema.String.annotate({
    description: 'The variant axis value this cell draws, as an author writes it in config',
    examples: ['destructive'],
  }),
  state: Schema.String.annotate({
    description: 'The state this cell draws, in a reader’s words',
    examples: ['disabled'],
  }),
  source: Schema.Literals(['rendered', 'depicted']).annotate({
    description:
      'Read exactly as `states[].source` — carried onto the cell because a page renders cells and cannot join two arrays.',
  }),
  // Rides the cell for the SAME reason `source` does, and it is the same
  // sentence: a page renders cells and cannot join two arrays, so a cell that
  // did not carry its scope could not tell a row state from a component one —
  // and would draw a row-scoped paint across the whole specimen.
  scope: optionalField(componentTypeStateScopeSchema),
  // ─── A ROW CANNOT KNOW IT IS THE FIRST ROW ───────────────────────────────
  //
  // `data-design-state` answers "which states does this type have", and
  // `[internal ref]` pins each answer at `toHaveCount(1)`. It is
  // therefore carried by ONE variant row — the drawing side writes
  // `exhibit: index === 0` in `variantMatrix` — and a page stamping every cell
  // reports `button`'s four states seven times each.
  //
  // A config page has no operator that could reproduce that: `visibility.record`
  // compares one named field against a literal, with nothing positional and no
  // cross-row predicate, and the row-expansion runtime injects no implicit index
  // (checked in `system-rows-template-resolver.ts` and `data-source-resolver.ts`).
  // So the producer says it, on the row, exactly as `source` is said on the row.
  //
  // NOT `variant eq 'default'` at the reading end. All three catalogued types
  // carrying both axes spell their first variant `default` today, so that gate
  // is green now and marks NOTHING the day an interactive type spells its first
  // variant otherwise — silently, since a page marking zero cells still renders.
  //
  // Admitted under [internal ref] on `cells`' own terms: a mechanical projection of the
  // published `variants` order, carrying no word, no label and no sentence.
  exhibit: Schema.Boolean.annotate({
    description:
      'Whether this cell belongs to the row that exhibits the state vocabulary — `true` exactly where the cell’s variant is `variants[0]`. A page marks its state cells from this; without it, "which states does this type have" has one answer per variant.',
  }),
}).annotate({
  strictKeys: true,
  title: 'sovrium:strict-keys',
  identifier: 'ComponentTypeCell',
})

/**
 * One route of the operator's own app that writes this type.
 *
 * A ROW carrying one string, and not a `readonly string[]`, for the mechanical
 * reason every array on this contract is one: `rowsKey` is a flat `body[key]`
 * lookup handing a row template a RECORD, and `$record.` addresses a field of
 * it. A bare string array yields rows that are strings, which no `$record.<name>`
 * can name — so the routes would arrive and be unprintable. Same fix already
 * applied to `variants` and `sizes`.
 */
export const componentTypeRouteSchema = Schema.Struct({
  route: Schema.String.annotate({
    description: 'A route of the operator’s app whose component tree writes this type',
    examples: ['/pricing'],
  }),
}).annotate({
  strictKeys: true,
  title: 'sovrium:strict-keys',
  identifier: 'ComponentTypeRoute',
})

/**
 * Another catalogued type in the same category — the "related" rail.
 *
 * EVERY sibling, in category order, never a prev/next pair. The page draws them
 * as a list of links rather than as two arrows, and a pair would make the
 * section's meaning depend on where the reader entered it.
 *
 * `href` rides along rather than being composed from `type`, because composing
 * it is a string operation and a config page has none: a template writing
 * `/design-system/ui-kit/$record.type` would work only while the console keeps
 * that exact shape, which is the coupling `href` on the summary row already
 * exists to remove.
 *
 * The type ITSELF is excluded. A "related" list that includes the page you are
 * on documents a relationship a reader cannot use, and the exclusion is a
 * filter no config page can apply — `visibility.record` compares a row field
 * against a LITERAL, and the literal here is the page's own parameter.
 */
export const componentTypeSiblingSchema = Schema.Struct({
  type: Schema.String.annotate({
    description: 'The sibling type literal, exactly as an author writes it in config',
    examples: ['checkbox'],
  }),
  href: Schema.String.annotate({
    description:
      'Mount-relative route of that sibling’s own page, carried rather than composed — a config page has no string operations.',
    examples: ['/design-system/ui-kit/checkbox'],
  }),
}).annotate({
  strictKeys: true,
  title: 'sovrium:strict-keys',
  identifier: 'ComponentTypeSibling',
})

/** @public */
export type ComponentTypeField = typeof componentTypeFieldSchema.Type
/** @public */
export type ComponentTypeSharedModule = typeof componentTypeSharedModuleSchema.Type
/** @public */
export type ComponentTypeAxisValue = typeof componentTypeAxisValueSchema.Type
/** @public */
export type ComponentTypeRoute = typeof componentTypeRouteSchema.Type
/** @public */
export type ComponentTypeSibling = typeof componentTypeSiblingSchema.Type
/** @public */
export type ComponentTypeCell = typeof componentTypeCellSchema.Type
