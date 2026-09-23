/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { fieldBagOf, isSpread } from '@/domain/models/app/design/type-introspection'
import {
  CATALOG_COMPONENT_CATEGORIES,
  catalogedTypesOf,
} from '@/domain/models/app/pages/components/component-types/catalog'

/**
 * `sovrium:options` targets for the COMPONENT TYPES, which are field bags.
 *
 * ─── WHY THIS MODULE HAS TO EXIST AT ALL ───────────────────────────────────
 *
 * Everywhere else in the manual a directive names an exported schema:
 * `<!-- sovrium:options DataTableSchema -->` resolves to a value the section
 * manifest imports, and deleting that export fails `tsc`. The ninety
 * catalogued component types cannot be addressed that way, because none of
 * them is an exported schema. A type is a BAG of fields — `buttonFields`,
 * `textFields` — and the `Schema.Struct` that holds it is assembled inside
 * `buildComponentUnion` and never given a name. Measured: the whole
 * `component-types` tree exports forty-three `*Schema` consts, and only nine
 * of them publish any option at all; the rest are scalar enums like
 * `TextElementSchema` and `AvatarSizeSchema`, which render an EMPTY table and
 * are refused by the engine. Every per-type property table in the corpus
 * would have stayed hand-written.
 *
 * So the directive addresses the CATALOGUED TYPE instead, and this module is
 * what a type name resolves to. {@link componentType} rebuilds the same struct
 * the design-system console walks — which is why the reader gets the console's
 * answer rather than a second one.
 *
 * ─── THE SPREADS ARE SUBTRACTED, AND THAT IS THE WHOLE POINT ───────────────
 *
 * A bag holds the type's own fields PLUS the shared modules it spreads in —
 * `coreFields`, `responsiveFields`, `visibilityFields` and the rest. Walking
 * the bag whole gives `button` two hundred and six rows, of which thirteen are
 * about a button; the other hundred and ninety-three are the shared modules,
 * repeated on all ninety types. `schemaOptionTree(type)` drops them with
 * `isSpread` and so does this, so the two agree row for row — asserted across
 * the catalogue in `docs-structure.test.ts`. The shared modules are documented
 * once, in their own article.
 *
 * ─── ONE FUNCTION DECIDES THE KEY SPELLING ─────────────────────────────────
 *
 * A key names its type as the CATALOGUE spells it: `type:record-field`. That
 * costs the engine's directive parser a character class admitting `:` and `-`
 * (`docs-markdown.ts`), which it now has. Before it did, the same keys were
 * written `type.record_field` — the closest legal form under the identifier
 * class, because a directive reading `type:record-field` did not fail loudly:
 * it parsed as the identifier `type`, missed the registry and reported THAT
 * name, sending the author looking for the wrong mistake.
 *
 * {@link componentTypeDirectiveKey} stays the only place the spelling is
 * decided, which is what made that migration one edit plus a mechanical sweep
 * of the fragments rather than a judgement call per directive.
 */

/** Prefix that marks a directive key as naming a catalogued component type. */
export const COMPONENT_TYPE_KEY_PREFIX = 'type:'

/** The directive key for a catalogued type — `record-field` → `type:record-field`. */
export const componentTypeDirectiveKey = (type: string): string =>
  `${COMPONENT_TYPE_KEY_PREFIX}${type}`

/** Every catalogued type name, across every category, sorted. */
export const catalogedComponentTypes = (): readonly string[] =>
  CATALOG_COMPONENT_CATEGORIES.flatMap((category) => catalogedTypesOf(category)).toSorted()

/**
 * The type a directive key names, or `undefined` when the key is not one.
 *
 * Looked up against the catalogue rather than computed by stripping the
 * prefix, so an uncatalogued name answers `undefined` instead of round-tripping
 * to itself — which is what lets `docs-structure.test.ts` reject a directive
 * naming a type nobody registered.
 */
export const componentTypeOfDirectiveKey = (key: string): string | undefined =>
  key.startsWith(COMPONENT_TYPE_KEY_PREFIX)
    ? catalogedComponentTypes().find((type) => componentTypeDirectiveKey(type) === key)
    : undefined

/**
 * The schema a `type:<name>` directive expands: one catalogued type's OWN options.
 *
 * Listed in an article's `documents`, at the position of the directive that
 * names it, exactly as an imported `*Schema` would be. It is a value rather
 * than a name so the manifest carries one kind of thing, and it throws on a
 * type the catalogue does not hold so that a typo fails when the manifest is
 * imported — by the structure test, by the build, by anything that reads it —
 * rather than expanding to nothing at the moment a reader asks for the page.
 *
 * @param type - A catalogued component type, spelled as the catalogue spells it.
 * @throws When the type is not catalogued, or declares no fields of its own.
 */
export const componentType = (type: string): unknown => {
  const bag = fieldBagOf(type)
  if (bag === undefined)
    // eslint-disable-next-line functional/no-throw-statements -- a directive aimed at a type the catalogue does not hold is a broken article; silence here ships a page promising a table it cannot draw
    throw new Error(
      `No catalogued component type "${type}". The catalogue holds: ${catalogedComponentTypes().join(', ')}.`
    )

  const own = Object.fromEntries(
    Object.entries(bag).filter(([name, value]) => !isSpread(name, value))
  )
  return Schema.Struct(own as Schema.Struct.Fields)
}
