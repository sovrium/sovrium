/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Which component-type categories the catalog publishes, and which it refuses.
 *
 * ─── THE TYPE LISTS ARE DERIVED, NOT COPIED ────────────────────────────────
 *
 * Each category's membership is read from the domain's OWN per-category barrel
 * (`component-types/<category>/index.ts`) by pulling every `*TypeLiteral`
 * export and reading its literal. A category therefore gains a type the moment
 * the domain does, and {@link catalogedTypesOf} reports any type in a
 * published category that has no specimen — so a new component-type surfaces
 * on the page as a gap rather than silently not existing.
 *
 * The brief asked for `allComponents` (`component-types/index.ts`) to be
 * exported for this. It was tried and rejected on measurement: `allComponents`
 * is a FLAT list whose only category information is source comments, so it
 * cannot answer "what is in `form-controls`" — the one question a per-category
 * route has to ask. The per-category barrels are already public, carry the
 * partition, and are read the same one-hop way (`.ast.literal`, no union
 * walk). Measured equal to `allComponents`' own comment blocks: layout 10,
 * form-controls 11, data 10, structural 2, editors 4. Exporting `allComponents`
 * with no consumer would also have failed Knip.
 *
 * ─── TWO REFUSALS, BOTH SAFETY PROPERTIES ──────────────────────────────────
 *
 * See {@link EXCLUDED_CATEGORIES} and {@link EXCLUDED_TYPES}. Neither is a
 * filter that may be generalised away: each exists because rendering the thing
 * would break [internal ref] A3's specimen bound inside a preview frame.
 */

import * as dataTypes from '@/domain/models/app/pages/components/component-types/data'
import * as formControlTypes from '@/domain/models/app/pages/components/component-types/form-controls'
import * as layoutTypes from '@/domain/models/app/pages/components/component-types/layout'
import * as structuralTypes from '@/domain/models/app/pages/components/component-types/structural'

/**
 * The component-type categories this phase publishes a route for.
 *
 * ─── `editors` IS ABSENT PERMANENTLY, AND THAT IS A SAFETY PROPERTY ────────
 *
 * `schema-json-editor`, `schema-yaml-editor`, `schema-form-editor` and
 * `schema-ai-agent` are schema-accepted and renderer-backed, and their SSR
 * placeholders ship a live Submit button and a textbox whose island POSTs into
 * the records API. Publishing that category would break [internal ref] A3 clause 2 on
 * the markup and clause 3 on the wire, and would re-admit through a door
 * marked "design" exactly the config-editing plane [internal ref] D3 relocated to
 * paid Cloud. It is a refusal, not a backlog item — `[internal ref]`
 * asserts the 404, because a comment does not fail.
 *
 * Every OTHER unlisted category is merely unbuilt, and adding one is the
 * mechanical repetition the user story describes. Adding `editors` is not.
 */
export const CATALOG_COMPONENT_CATEGORIES = [
  'form-controls',
  'data',
  'structural',
  'layout',
] as const

/** One of the published component-type categories. */
export type CatalogComponentCategory = (typeof CATALOG_COMPONENT_CATEGORIES)[number]

/**
 * Types inside a PUBLISHED category that the catalog reports rather than draws.
 *
 * `form` / `data-form` (category `data`) — both emit `<button type="submit">`
 * unconditionally (`crud-form-renderer.tsx`, create AND update branches), and
 * `data` is a route `[internal ref]` sweeps for A3 clause 2. Drawing
 * either would put a live write control inside a preview frame. Same class as
 * `editors` above: a safety exclusion. Do not delete this as dead weight — the
 * catalog would go red on 022, but only after someone had shipped a submit
 * button into the console.
 */
export const EXCLUDED_TYPES: Readonly<Record<string, string>> = {
  form: 'Renders a live submit control; a preview frame may carry no write path (ADR-022 A3 clause 2).',
  'data-form':
    'Renders a live submit control; a preview frame may carry no write path (ADR-022 A3 clause 2).',
}

/** Human-readable heading for each published category. */
export const CATALOG_CATEGORY_TITLES: Readonly<Record<CatalogComponentCategory, string>> = {
  'form-controls': 'Form controls',
  data: 'Data',
  structural: 'Structural',
  layout: 'Layout',
}

/** One line under each category heading, saying what the category is for. */
export const CATALOG_CATEGORY_SUMMARIES: Readonly<Record<CatalogComponentCategory, string>> = {
  'form-controls':
    'Every control an author can put on a page, drawn by the same renderer your own pages use.',
  data: 'The components that read records, shown over rows this platform ships — never over yours.',
  structural: 'The spacing and separation primitives, at the geometry they actually occupy.',
  layout:
    'The containers a page is composed from, and the one type that has no renderer behind it.',
}

/** A schema module namespace, as imported above. */
type TypeLiteralModule = Readonly<Record<string, unknown>>

/** Read the string a `Schema.Literal('x')` accepts, or `undefined`. */
function literalOf(value: unknown): string | undefined {
  const ast = (value as { ast?: { literal?: unknown } } | undefined)?.ast
  return typeof ast?.literal === 'string' ? ast.literal : undefined
}

/**
 * Every component-type literal a category's barrel exports.
 *
 * Sorted so the page order is stable across builds; the SPECIMEN order is
 * owned by the specimen table, which is where reading order belongs.
 */
function typeLiteralsOf(module: TypeLiteralModule): readonly string[] {
  return Object.entries(module)
    .filter(([name]) => name.endsWith('TypeLiteral'))
    .map(([, value]) => literalOf(value))
    .filter((literal): literal is string => literal !== undefined)
    .toSorted((a, b) => a.localeCompare(b))
}

const CATEGORY_MODULES: Readonly<Record<CatalogComponentCategory, TypeLiteralModule>> = {
  'form-controls': formControlTypes,
  data: dataTypes,
  structural: structuralTypes,
  layout: layoutTypes,
}

/** Every component-type the domain places in a published category. */
export function catalogedTypesOf(category: CatalogComponentCategory): readonly string[] {
  return typeLiteralsOf(CATEGORY_MODULES[category])
}

/** Whether a string names a published component-type category. */
export const isCatalogComponentCategory = (value: string): value is CatalogComponentCategory =>
  (CATALOG_COMPONENT_CATEGORIES as readonly string[]).includes(value)
