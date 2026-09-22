/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Every FIELD type the schema registers, under the category the domain places
 * it in.
 *
 * ─── WHY THIS EXISTS BESIDE THE COMPONENT CATALOGUE, AND IS NOT IT ─────────
 *
 * A field type is a table COLUMN type, not a page component. It has no renderer
 * of its own, no variant axis, no state vocabulary, and no `href` — none of the
 * five things `component-types/catalog.ts` publishes about a component type
 * applies. What a reader wants from it is one question, "what does a
 * `single-select` look like", and the answer is drawn by whichever surface
 * happens to be showing it.
 *
 * So the two catalogues answer different questions and are deliberately not one
 * function with a flag.
 *
 * ─── MEMBERSHIP IS DERIVED, NEVER COPIED ───────────────────────────────────
 *
 * Read from the domain's own per-category barrels
 * (`tables/fields/field-types/<category>/index.ts`), so a field type added to
 * the schema appears here on the next boot with no edit — the same property
 * `catalogedTypesOf` gives the component catalogue, and the reason both are
 * derivations rather than lists. A hand-written second list of field types is
 * exactly the drift a catalogue exists to disprove.
 *
 * ─── WHY THE EXTRACTION DIFFERS FROM THE COMPONENT ONE ─────────────────────
 *
 * A component-type barrel exports bare `Schema.Literal`s, so that reader takes
 * `.ast.literal` in one hop. A field barrel exports whole `Schema.Struct`s
 * (`RichTextFieldSchema`), and the discriminator sits on the struct's `type`
 * property: `.ast.propertySignatures[name='type'].type.literal`. Measured on
 * this tree — the property signature's `type` IS the AST node, so there is no
 * second `.ast` hop, and reaching for one silently yields `undefined` and an
 * empty category.
 *
 * The reader is defensive by construction: an unreadable export drops out of
 * the list rather than throwing, and the catalogue then shows a short
 * category — visible, which is the point.
 *
 * ─── THE ORDER IS A PUBLISHED FACT, NOT AN INCIDENTAL ──────────────────────
 *
 * {@link FIELD_TYPE_CATEGORIES} is the reading order a reader meets, and the
 * types inside a category are sorted so a build cannot reorder them. Both
 * matter downstream: the console's composed form draws these rows in sequence
 * and heads each category once, which is only expressible if the sequence is
 * stable and the category boundary is knowable. See `firstInCategory` on the
 * wire contract for why the boundary is published rather than derived.
 *
 * ─── AND WHY IT LIVES BESIDE THE BARRELS IT READS ──────────────────────────
 *
 * Beside the barrels it reads, mirroring `component-types/catalog.ts` exactly.
 * That is not symmetry for its own sake: the decode-time rule that refuses an
 * uncatalogued `field-specimen.fieldType` lives in
 * `design-console-component-validation.ts`, so the catalogue that rule consults
 * has to be reachable from a file that runs at decode time. A catalogue it
 * could not import would push the check to render time for no reason but an
 * address.
 *
 * That was once a LAYER argument — `domain/models/` may not import
 * `domain/services/` (`boundaries/dependencies`) — and the layout programme
 * dissolved `domain/services/`, so the constraint it named is gone. The
 * conclusion outlived the argument: a catalogue belongs beside what it
 * catalogues.
 *
 * The same wave moved the schema INTROSPECTOR and the state vocabulary into the
 * `design` slug, so the reason `catalogedTypesOf` was legal in that validator
 * while those two were not has expired with it. The axis checks they answer are
 * STILL deferred to row expansion — see the docblock in
 * `design-console-component-validation.ts`, which records that the deferral now
 * rests on something other than the argument it was decided on.
 *
 * @see src/domain/models/app/pages/components/component-types/catalog.ts — the component sibling
 * @see src/domain/models/api/admin/design-system/field-types.ts — the wire contract
 */

import { READONLY_COMPUTED_FIELD_TYPES } from '..'
import * as advancedFieldTypes from './advanced'
import * as aiFieldTypes from './ai'
import * as dateTimeFieldTypes from './date-time'
import * as mediaFieldTypes from './media'
import * as numericFieldTypes from './numeric'
import * as relationalFieldTypes from './relational'
import * as selectionFieldTypes from './selection'
import * as textFieldTypes from './text'
import * as userFieldTypes from './user'

/** A schema module namespace, as imported above. */
type FieldSchemaModule = Readonly<Record<string, unknown>>

/** One entry of a struct AST's property signature list. */
interface PropertySignatureLike {
  readonly name?: unknown
  readonly type?: { readonly literal?: unknown }
}

/**
 * Every field-type category the domain registers, in READING order, each with
 * its display heading and its barrel.
 *
 * The order is the one a reader meets on the console's composed form: the text
 * types first because they are what most tables are made of, then the shapes
 * that are still one value (numeric, dates, choices), then the ones that reach
 * outside the row (relations, files, people), and the two specialist groups
 * last. Alphabetical would put `advanced` and `ai` first, which is exactly
 * backwards for someone reading to learn what a field can be.
 *
 * The TITLE is the registry's own display string, and it is the only editorial
 * value this module holds. It is published for the same reason
 * `componentTypeSummary.title` is: a reader needs a heading, the registry is
 * where headings for registry groups belong, and a console inventing its own
 * would be a second name for one concept.
 */
const FIELD_TYPE_CATEGORY_MODULES: readonly (readonly [string, string, FieldSchemaModule])[] = [
  ['text', 'Text fields', textFieldTypes],
  ['numeric', 'Numeric fields', numericFieldTypes],
  ['date-time', 'Date and time fields', dateTimeFieldTypes],
  ['selection', 'Selection fields', selectionFieldTypes],
  ['relational', 'Relational fields', relationalFieldTypes],
  ['media', 'Media fields', mediaFieldTypes],
  ['user', 'User fields', userFieldTypes],
  ['advanced', 'Advanced fields', advancedFieldTypes],
  ['ai', 'AI fields', aiFieldTypes],
]

/**
 * Read the `type` discriminator a field schema accepts, or `undefined`.
 *
 * `undefined` for anything that is not a struct carrying a literal `type`,
 * which includes every non-schema export a barrel happens to have.
 */
const fieldTypeLiteralOf = (value: unknown): string | undefined => {
  const signatures = (
    value as { readonly ast?: { readonly propertySignatures?: readonly PropertySignatureLike[] } }
  )?.ast?.propertySignatures
  if (!Array.isArray(signatures)) return undefined
  const discriminator = signatures.find((signature) => signature.name === 'type')
  const literal = discriminator?.type?.literal
  return typeof literal === 'string' ? literal : undefined
}

/**
 * Every field-type literal a category's barrel exports.
 *
 * Sorted so the order is stable across builds: a category whose members moved
 * because a bundler reordered exports would move the composed form's controls
 * under a reader between two deploys.
 */
const fieldTypeLiteralsOf = (module: FieldSchemaModule): readonly string[] =>
  Object.entries(module)
    .filter(([name]) => name.endsWith('FieldSchema'))
    .map(([, value]) => fieldTypeLiteralOf(value))
    .filter((literal): literal is string => literal !== undefined)
    .toSorted((a, b) => a.localeCompare(b))

/** One field-type category: its slug, its heading, and the types in it. */
export interface FieldTypeCategory {
  /** The registry slug, as the domain directory names it. */
  readonly category: string
  /** The heading a reader meets above this group. */
  readonly title: string
  /** The category's field types, in stable order. */
  readonly types: readonly string[]
}

/**
 * Every field-type category the domain registers, in reading order, each with
 * its own types.
 *
 * A category with no readable export answers with an EMPTY `types` rather than
 * dropping out: "this category holds nothing today" and "nobody published this
 * category" are different facts, and only the first can be true here.
 */
export const FIELD_TYPE_CATEGORIES: readonly FieldTypeCategory[] = FIELD_TYPE_CATEGORY_MODULES.map(
  ([category, title, module]) => ({
    category,
    title,
    types: fieldTypeLiteralsOf(module),
  })
)

/** Every field type the domain registers, flattened in reading order. */
export const catalogedFieldTypes = (): readonly string[] =>
  FIELD_TYPE_CATEGORIES.flatMap((entry) => entry.types)

/** Whether a string names a field type the domain registers. */
export const isCatalogedFieldType = (value: string): boolean =>
  catalogedFieldTypes().includes(value)

/**
 * The `name` a drawn control carries for a field type.
 *
 * Underscored because `FieldNameSchema` rejects a hyphen outright — *"start
 * with a letter, contain only lowercase letters, numbers, and underscores"* —
 * so the type literal and the control name are NOT derivable from one another
 * by a reader, and a config page has no string operations with which to derive
 * one anyway.
 *
 * Deterministic, so the default is the same value a caller would have chosen,
 * and so a specimen and the real form it is compared against agree on the
 * anchor without either side writing it down.
 */
export const fieldControlName = (fieldType: string): string => fieldType.replaceAll('-', '_')

// ─── WHAT A CATALOGUE ROW NEEDS BEYOND ITS NAME ─────────────────────────────
//
// A catalogue that lists forty-nine type literals tells a reader what the
// schema accepts and nothing about what any of them LOOKS like. Drawing them
// needs two facts neither the console nor the page can compute: whether an
// author types into this type at all, and something for the control to hold.
//
// Both are registry knowledge, and both are published for the same reason
// `categoryTitle` is: a console inventing its own would be a second set for one
// concept, hand-written forty-nine times, drifting from the day it was typed.

/**
 * Field types the PLATFORM stamps, never the caller.
 *
 * Deliberately NOT folded into {@link READONLY_COMPUTED_FIELD_TYPES}, which
 * lives in `tables/fields/index.ts` and answers a different question: *does a
 * direct write get a clean 4xx?* For these six the answer is no — a supplied
 * value is silently ignored by the authorship and soft-delete pipelines and the
 * request returns 201. That difference is load-bearing on the write path and
 * the two sets must not be unified there.
 *
 * The question THIS set answers is presentational: does an author type into a
 * control of this type? For a stamped field they do not, whatever the write
 * path does with a value they send.
 */
export const SYSTEM_STAMPED_FIELD_TYPES: ReadonlySet<string> = new Set([
  'created-at',
  'updated-at',
  'deleted-at',
  'created-by',
  'updated-by',
  'deleted-by',
])

/**
 * Whether a field of this type is drawn read-only in a record form.
 *
 * Three families, and only the third is a literal list:
 *  - COMPUTED — derived from other columns, read off
 *    {@link READONLY_COMPUTED_FIELD_TYPES}, the write pipeline's own set. A
 *    sixth computed type added there is read-only here for free.
 *  - AI — every type in the `ai` category, by CATEGORY rather than by name. A
 *    model produces the value; an author does not type it. An eighth AI type
 *    is read-only here for free.
 *  - STAMPED — {@link SYSTEM_STAMPED_FIELD_TYPES}, the one family that has to
 *    be named, because there is no structural mark distinguishing
 *    `created-at` from `date`. A seventh stamped type is the one case needing
 *    an edit here, and that is the honest limit of the derivation.
 */
export const isReadOnlyFieldType = (fieldType: string, category: string): boolean =>
  category === 'ai' ||
  SYSTEM_STAMPED_FIELD_TYPES.has(fieldType) ||
  READONLY_COMPUTED_FIELD_TYPES.has(fieldType)

/**
 * One value per FAMILY, for a control that has no record behind it.
 *
 * The fallback, so a fiftieth type in an existing category draws something
 * without an edit. A new CATEGORY is the case that needs one — which is the
 * same limit {@link FIELD_TYPE_CATEGORY_MODULES} already has, and visible for
 * the same reason: the category would otherwise draw blank controls rather than
 * disappear.
 */
const FIELD_TYPE_SAMPLE_BY_CATEGORY: Readonly<Record<string, string>> = {
  text: 'Sample text',
  numeric: '42',
  'date-time': '2026-03-05',
  selection: 'In progress',
  relational: 'Acme Corporation',
  media: 'contract.pdf',
  user: 'Ada Lovelace',
  advanced: 'Sample value',
  ai: 'Generated value',
}

/**
 * The types whose family default would not PARSE, and what they take instead.
 *
 * That is the whole admission rule, and it is deliberately narrow: an entry
 * belongs here when the family default would make the control draw WRONG or
 * refuse the value — an email control given `Sample text`, a date control given
 * a sentence, a checkbox given anything that is not a boolean. It does NOT
 * belong here because a more evocative value could be chosen. Prettiness is how
 * a derived table becomes a hand-written one.
 *
 * Every value is neutral data with nothing to say: a place, a document name, a
 * number. None of it is copy, which is why publishing it does not make the
 * registry an editor.
 */
const FIELD_TYPE_SAMPLE_OVERRIDES: Readonly<Record<string, string>> = {
  // text — three of the six carry a format the control validates
  email: 'ada@example.com',
  url: 'https://example.com',
  'phone-number': '+33 1 23 45 67 89',
  // numeric — the family default is an integer; four types are not
  currency: '1250.00',
  decimal: '3.14',
  percentage: '75',
  rating: '4',
  progress: '60',
  // date-time — the family default is a date; four types are not
  datetime: '2026-03-05T09:30:00Z',
  'created-at': '2026-03-05T09:30:00Z',
  'updated-at': '2026-03-05T09:30:00Z',
  'deleted-at': '2026-03-05T09:30:00Z',
  time: '09:30',
  duration: '01:30',
  // selection — a checkbox holds a boolean, not a label
  checkbox: 'true',
  // relational — a rollup holds the aggregate, not the related row's name
  rollup: '12',
  lookup: 'Paris',
  // media — a barcode is a code
  barcode: '5901234123457',
  // advanced — the family default says nothing any of these controls can draw
  array: 'alpha',
  autonumber: '1042',
  button: 'Run',
  code: 'const total = 42',
  color: '#3B82F6',
  count: '12',
  formula: '1250.00',
  geolocation: '48.8566, 2.3522',
  json: '{ "key": "value" }',
}

/**
 * A deterministic value for a control of this field type to hold.
 *
 * Deterministic because two surfaces compare against each other: a specimen and
 * the real form it is checked against agree on the value without either side
 * writing it down, exactly as {@link fieldControlName} makes them agree on the
 * anchor.
 */
export const fieldTypeSampleValue = (fieldType: string, category: string): string =>
  FIELD_TYPE_SAMPLE_OVERRIDES[fieldType] ??
  FIELD_TYPE_SAMPLE_BY_CATEGORY[category] ??
  'Sample value'
