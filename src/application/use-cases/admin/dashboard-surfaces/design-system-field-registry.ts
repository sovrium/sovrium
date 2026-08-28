/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Which FIELD-type categories the catalog publishes, and how it reads them.
 *
 * ─── THE TYPE LIST IS DERIVED, NOT COPIED ──────────────────────────────────
 *
 * Membership is read from the domain's own per-category field barrel
 * (`tables/fields/field-types/<category>/index.ts`), so the category gains a
 * field type the moment the domain does and the catalog reports it as a NAMED
 * GAP rather than silently not existing. This is the same property
 * `catalogedTypesOf` gives the component catalog, and it is worth the AST poke:
 * a hand-written second list of field types is exactly the drift the catalog
 * exists to disprove.
 *
 * ─── WHY THE EXTRACTION DIFFERS FROM THE COMPONENT ONE ─────────────────────
 *
 * A component-type barrel exports bare `Schema.Literal`s, so the component
 * registry reads `.ast.literal` in one hop. A field barrel exports whole
 * `Schema.Struct`s (`RichTextFieldSchema`), and the discriminator sits on the
 * struct's `type` property: `.ast.propertySignatures[name='type'].type.literal`.
 * Measured on this tree — the property signature's `type` IS the AST node, so
 * there is no second `.ast` hop, and reaching for one silently yields
 * `undefined` and an empty category.
 *
 * Both readers are defensive by construction: an unreadable shape drops out of
 * the list rather than throwing, and the catalog then shows a short category —
 * visible, which is the point.
 */

import * as textFieldTypes from '@/domain/models/app/tables/fields/field-types/text'

/**
 * The field-type categories this phase publishes a route for.
 *
 * `text` alone today. The other eight (`numeric`, `date-time`, `selection`,
 * `relational`, `media`, `user`, `advanced`, `ai`) are the mechanical
 * repetition the user story describes, not a refusal — nothing about them is
 * unsafe to draw. Adding one is a line here plus its title and summary.
 *
 * `advanced` is worth a word before someone adds it: it holds `code`, whose
 * control emits NO name-bearing element in either its loading or its loaded
 * state (measured — see the fidelity table in
 * `@docs/architecture/patterns/render-time-component-expansion.md`). A `code`
 * specimen can be shown but not mechanically compared against a real form, so
 * whoever publishes `advanced` inherits that limit and should state it rather
 * than discover it in a red oracle.
 */
export const CATALOG_FIELD_CATEGORIES = ['text'] as const

/** One of the published field-type categories. */
export type CatalogFieldCategory = (typeof CATALOG_FIELD_CATEGORIES)[number]

/** Human-readable heading for each published field category. */
export const CATALOG_FIELD_CATEGORY_TITLES: Readonly<Record<CatalogFieldCategory, string>> = {
  text: 'Text fields',
}

/** One line under each category heading, saying what the category is for. */
export const CATALOG_FIELD_CATEGORY_SUMMARIES: Readonly<Record<CatalogFieldCategory, string>> = {
  text: 'The field types that hold words, each drawn as the crud form draws it.',
}

/** A schema module namespace, as imported above. */
type FieldSchemaModule = Readonly<Record<string, unknown>>

/** One entry of a struct AST's property signature list. */
interface PropertySignatureLike {
  readonly name?: unknown
  readonly type?: { readonly literal?: unknown }
}

/**
 * Read the `type` discriminator a field schema accepts, or `undefined`.
 *
 * `undefined` for anything that is not a struct carrying a literal `type` —
 * which includes every non-schema export a barrel happens to have.
 */
function fieldTypeLiteralOf(value: unknown): string | undefined {
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
 * Sorted so the page order is stable across builds; the SPECIMEN order is
 * owned by the specimen table, which is where reading order belongs.
 */
function fieldTypeLiteralsOf(module: FieldSchemaModule): readonly string[] {
  return Object.entries(module)
    .filter(([name]) => name.endsWith('FieldSchema'))
    .map(([, value]) => fieldTypeLiteralOf(value))
    .filter((literal): literal is string => literal !== undefined)
    .toSorted((a, b) => a.localeCompare(b))
}

const FIELD_CATEGORY_MODULES: Readonly<Record<CatalogFieldCategory, FieldSchemaModule>> = {
  text: textFieldTypes,
}

/** Every field-type the domain places in a published category. */
export function catalogedFieldTypesOf(category: CatalogFieldCategory): readonly string[] {
  return fieldTypeLiteralsOf(FIELD_CATEGORY_MODULES[category])
}

/** Whether a string names a published field-type category. */
export const isCatalogFieldCategory = (value: string): value is CatalogFieldCategory =>
  (CATALOG_FIELD_CATEGORIES as readonly string[]).includes(value)
