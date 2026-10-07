/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The three SCHEMA projections the design-system console reads over the wire:
 * the component-type catalogue, one type's fields, and the token document
 * flattened to rows. This file holds the catalogue listing and the helpers the
 * other two share; the detail read lives in `design-system-component-detail.ts`,
 * the options read in `design-system-component-options.ts`, and the token rows
 * in `design-system-token-rows.ts`.
 *
 * ─── EVERY ANSWER IS DERIVED, NEVER LISTED ─────────────────────────────────
 *
 * The catalogue comes from `component-types/catalog.ts`, which reads the
 * per-category barrels; the per-type fields come from
 * `domain/services/design-system/type-introspection.ts`, which reads the AST;
 * the token rows come from the SAME `buildDesignSystem(app)` document the
 * export serves. Nothing here maintains a parallel list, so a component type
 * added to the schema appears on the console the moment it exists — which is
 * the whole reason these are projections rather than builders.
 *
 * ─── AND NOTHING HERE DECIDES ANYTHING ABOUT A SURFACE ─────────────────────
 *
 * No titles are invented, no ordering is imposed beyond the registry's own, and
 * a refused type is REPORTED with its own sentence rather than filtered out.
 * The console decides how to draw a refusal; this decides only that it is one.
 *
 * ─── WHY CLASS PROVENANCE IS NOT HERE ──────────────────────────────────────
 *
 * It resolves `design.components` through the RENDERER's precedence rules,
 * which live in `presentation/utils/design/` — a layer the application may not
 * import, and rightly: those rules are how a class list reaches an element, not
 * a fact about the config. The provenance read composes them in the route,
 * through the one helper both it and the `specimen` renderer share
 * (`presentation/utils/design/class-provenance-report.ts`), so the endpoint and
 * the badge beside the drawn component cannot answer differently.
 *
 * @see src/domain/models/api/admin/design-system/component-types.ts
 */

import {
  catalogSpecimenComponent,
  catalogSpecimenRefusal,
} from '@/domain/models/app/design/catalog-specimens'
// ONE serialiser, imported rather than restated: the snippet and the drawn
// control are two projections of one component definition, and a second
// serialiser beside the first is exactly the drift that pairing exists to
// prevent. It sat under `dashboard-surfaces/` while a console page printed it
// and moved into the domain when that page became config — the caller is an
// endpoint now, and a page BUILDER is not a place an endpoint can import from.
import { catalogSpecimenIsFixtureBacked } from '@/domain/models/app/design/catalog-specimens/provenance'
import { statesOfType } from '@/domain/models/app/design/state-vocabulary'
import { introspectType } from '@/domain/models/app/design/type-introspection'
import {
  CATALOG_CATEGORY_TITLES,
  CATALOG_COMPONENT_CATEGORIES,
  EXCLUDED_TYPES,
  catalogedTypesOf,
  purposeOfComponentType,
} from '@/domain/models/app/pages/components/component-types/catalog'
import {
  FIELD_TYPE_CATEGORIES,
  fieldTypeSampleValue,
  isReadOnlyFieldType,
} from '@/domain/models/app/tables/fields/field-types/catalog'
import { usageFacet } from './design-system-usage-facet'
import type {
  ComponentTypeAxisValue,
  ComponentTypeCategory,
  ComponentTypeField,
  ComponentTypeSummary,
} from '@/domain/models/api/admin/design-system/component-types'
import type { FieldTypeSummary } from '@/domain/models/api/admin/design-system/field-types'
import type { App } from '@/domain/models/app'
import type { TypeField } from '@/domain/models/app/design/type-introspection'

/**
 * Where a type's own page lives in the console, MOUNT-RELATIVE.
 *
 * Relative because the same page is served in two worlds: standalone at the
 * site root under `bun run app:admin`, and under `/_admin` inside an operator's
 * app. An absolute `/_admin/...` would be wrong in the first and redundant in
 * the second — the mount walk prefixes the relative form at render time, which
 * is correct in both.
 */
export const detailHref = (type: string): string => `/design-system/ui-kit/${type}`

/**
 * The values of one lifted axis, as rows.
 *
 * Empty for a type that declares no such axis, and empty for one whose field is
 * not a closed union — `qr-code.size` is a NUMBER, and publishing it as a size
 * axis would put a sizes row on a card that has no sizes to show.
 */
export const axisValues = (
  field: { readonly name: string; readonly members?: readonly string[] } | undefined
): readonly ComponentTypeAxisValue[] =>
  (field?.members ?? []).map((value) => ({ value, field: field?.name ?? '' }))

/**
 * One introspected field, projected onto the wire contract.
 *
 * The whole projection is the `hasDefault` line. The domain's `TypeField`
 * reports a default by PRESENCE, which is the natural shape for TypeScript and
 * the unusable one for a config page: `visibility.record` has nine value
 * comparisons and no presence operator, so a page cannot ask whether the key
 * arrived. It can only compare a value it was given.
 *
 * So the presence is restated as a value here, once, in the layer that owns the
 * wire shape — not on `TypeField`, which is a domain type with no config page
 * anywhere near it, and not on the page, which cannot compute it at all.
 *
 * Everything else is carried through unchanged: `strictKeys` on the contract
 * refuses anything the introspector grows that nobody decided to publish, so a
 * spread would fail the encode rather than leak.
 */
export const publishedField = (field: TypeField): ComponentTypeField => ({
  name: field.name,
  accepts: field.accepts,
  ...(field.description === undefined ? {} : { description: field.description }),
  ...(field.defaultValue === undefined ? {} : { defaultValue: field.defaultValue }),
  ...(field.members === undefined ? {} : { members: field.members }),
  ...(field.title === undefined ? {} : { title: field.title }),
  hasDefault: field.defaultValue !== undefined,
})

/**
 * Every FIELD type the schema registers, in category reading order.
 *
 * ─── A BUILD CONSTANT, AND IT TAKES NO `app` TO PROVE IT ──────────────────
 *
 * Unlike {@link listComponentTypes}, which joins the operator's own usage onto
 * every row, this reads the schema and nothing else. It takes no argument, and
 * that is the contract rather than an omission: the catalogue describes what a
 * table MAY declare, never what this instance's tables do, so two instances on
 * the same build answer identically. A signature accepting an `App` would
 * invite a join that would quietly make it a config read.
 *
 * ─── `firstInCategory` IS COMPUTED HERE BECAUSE NOTHING ELSE CAN ──────────
 *
 * The composed form is ONE rows binding drawing every control and heading each
 * category once. A row template sees only its own row — no previous row, no
 * comparison across rows — so the group boundary has to arrive as a fact. It is
 * derived from the flattening itself rather than from a parallel list, so the
 * `true` row and the first row of a category cannot come apart.
 */
export const listFieldTypes = (): readonly FieldTypeSummary[] =>
  FIELD_TYPE_CATEGORIES.flatMap((entry) =>
    entry.types.map((type, index) => ({
      type,
      category: entry.category,
      categoryTitle: entry.title,
      firstInCategory: index === 0,
      // Both are the registry's OWN derivations rather than a table written out
      // here. That is what makes the fiftieth field type arrive already
      // carrying a value for a control to hold and a decision about whether an
      // author types into it, instead of arriving blank until someone
      // remembers a second list.
      sampleValue: fieldTypeSampleValue(type, entry.category),
      readOnly: isReadOnlyFieldType(type, entry.category),
    }))
  )

/**
 * The one line saying what a type is for, or a THROW.
 *
 * Total by contract rather than by fallback. `catalog.test.ts` asserts the key
 * set of `COMPONENT_TYPE_PURPOSES` EQUALS the published type list in both
 * directions, so every type this projection walks has a line; a `?? ''` here
 * would trade that guarantee for a blank cell nobody would notice until a
 * reader met it, which is precisely how the axis meta line this field replaced
 * came to be empty on more than half the catalogue.
 *
 * The failure is deterministic per build — the catalogue is a build constant,
 * so this either always throws or never does — which makes a throw safe in a
 * way it would not be on a config-dependent read.
 */
export const purposeOf = (type: string): string => {
  const purpose = purposeOfComponentType(type)
  if (purpose === undefined)
    // eslint-disable-next-line functional/no-throw-statements -- a build-constant invariant the catalogue's own test pins; the alternative is publishing '' on the one field whose contract is that it is never empty
    throw new Error(
      `Component type "${type}" is catalogued but carries no purpose line — ` +
        `COMPONENT_TYPE_PURPOSES and the component-type barrels have come apart. ` +
        `Add the line in src/domain/models/app/pages/components/component-types/catalog.ts.`
    )
  return purpose
}

/**
 * The `EXCLUDED_TYPES` sentence, published only while there is no drawing.
 *
 * ─── TWO EXCLUSIONS, NOT ONE SET ───────────────────────────────────────────
 *
 * `EXCLUDED_TYPES` is the DECLARATION-time exclusion — the types an author may
 * not point a `specimen` at, mirrored by `SPECIMEN_REFUSED_TYPES` — while the
 * catalogue owns what is DRAWN. The two agree wherever a type has only one
 * answer.
 *
 * `form` makes them differ. Its bound modes emit a live submit control and stay
 * undeclarable inside a preview frame; its BARE mode carries no action and no
 * submit path, which is the shape [internal ref] A3 clause 1 names in so many words,
 * so the catalogue draws it. Publishing the exclusion's sentence anyway would
 * hand one card `drawable: true` and a reason explaining why nothing was drawn
 * — the two halves of one record disagreeing, which is exactly what
 * an admin design system schema spec asserts cannot happen.
 *
 * So the catalogue's own refusal still wins where it exists, and this fallback
 * speaks only for a type nothing draws.
 */
export const undrawnReason = (
  drawable: boolean,
  excludedReason: string | undefined
): string | undefined => (drawable ? undefined : excludedReason)

/**
 * Every component type the registry publishes, in category order.
 *
 * A REFUSED type is listed with its reason rather than hidden: absence would
 * read as "this type does not exist", which is false and leaves an author
 * nothing to act on. Its detail page is served too, carrying the reason where
 * the canvas would be — see {@link componentTypeDetail}.
 */
export const listComponentTypes = (app: App): readonly ComponentTypeSummary[] => {
  // ONE walk of the config for all 85 types, not one per card. `usageFacet`
  // hoists the traversal precisely so a caller asking for every subject pays for
  // it once — asking per type would re-walk a sixty-seven-page app eighty-five
  // times. Joining here is what lets a card carry the figure at all: a row
  // template binds one rows source and cannot match this against the catalogue
  // by name.
  const routesUsing = new Map(
    usageFacet(app, 'type').items.map((row) => [row.name, row.count] as const)
  )
  return CATALOG_COMPONENT_CATEGORIES.flatMap((category) =>
    catalogedTypesOf(category).map((type): ComponentTypeSummary => {
      const excludedReason = EXCLUDED_TYPES[type]
      // A REFUSED type is introspected too: it is listed, and a card saying
      // "no axes" about a type nobody measured would be a guess rather than a
      // count. The walk is over the schema AST, which is a build constant.
      const introspection = introspectType(type)
      // A card is a container wrapping a specimen, and it needs to know whether
      // to carry a canvas at all BEFORE it draws one. `drawable` is the gate a
      // row-level predicate reads; `specimenState` is the literal the wrapper
      // stamps. The reason, when the catalogue has one, replaces the canvas.
      const drawable = catalogSpecimenComponent(type) !== undefined
      const refusal = catalogSpecimenRefusal(type)
      const refusalReason = refusal?.note ?? undrawnReason(drawable, excludedReason)
      const refusalState = refusal?.state
      return {
        type,
        category,
        title: CATALOG_CATEGORY_TITLES[category],
        // Required on the wire and never empty, so an absent line THROWS rather
        // than publishing `''`. The catalogue's own test pins exactly one
        // sentence per published type, so `undefined` here cannot be a data
        // gap — it means `COMPONENT_TYPE_PURPOSES` and the type barrels have
        // come apart, which is a BUILD fact identical on every instance and
        // caught by `bun test:unit` in seconds. A `?? ''` fallback would ship
        // a blank strip under the card, on the one field
        // whose whole point is that it is always there.
        purpose: purposeOf(type),
        href: detailHref(type),
        variantCount: axisValues(introspection.variant).length,
        sizeCount: axisValues(introspection.size).length,
        stateCount: statesOfType(type, category).length,
        // Own fields plus the shared modules spread onto them — the figure that
        // is available for all 85, which is what makes omitting an absent axis
        // safe rather than leaving a blank strip under a third of the grid.
        propCount: introspection.own.length + introspection.shared.length,
        pageCount: routesUsing.get(type) ?? 0,
        drawable,
        specimenState: drawable ? ('drawn' as const) : ('refused' as const),
        // Read from the catalogue's own wrapper marker rather than from a list
        // of type names kept here: the card stamps the provenance the specimen
        // actually carries, so the two cannot come to disagree.
        fixtureBacked: catalogSpecimenIsFixtureBacked(type),
        ...(refusalReason === undefined ? {} : { refusalReason }),
        // The REASON as a machine value, which is what a card stamps. Read off
        // the same `SpecimenRefusal` the sentence comes from, so a card carrying
        // a state always has a sentence beside it — and absent for the five
        // refused types the catalogue holds no refusal record for.
        ...(refusalState === undefined ? {} : { refusalState }),
        ...(excludedReason === undefined ? {} : { excludedReason }),
      }
    })
  )
}

/** The published category a type belongs to, or `undefined` if it is not one. */
export const categoryOf = (
  type: string
): (typeof CATALOG_COMPONENT_CATEGORIES)[number] | undefined =>
  CATALOG_COMPONENT_CATEGORIES.find((category) => catalogedTypesOf(category).includes(type))

/**
 * The categories of a catalogue LISTING, counted from the listing itself.
 *
 * Derived from the rows rather than from the registry, which is what makes the
 * counts sum to `total` by construction instead of by intent: a second walk of
 * `CATALOG_COMPONENT_CATEGORIES` could disagree with the response it ships
 * inside the first time a type moves category, and the nav would print a number
 * the grid beneath it contradicts.
 *
 * The registry's ORDER is still the registry's — the categories come out in the
 * order it declares them, filtered to those this response actually carries.
 */
export const componentTypeCategories = (
  items: readonly ComponentTypeSummary[]
): readonly ComponentTypeCategory[] =>
  CATALOG_COMPONENT_CATEGORIES.filter((category) =>
    items.some((item) => item.category === category)
  ).map((category) => ({
    slug: category,
    title: CATALOG_CATEGORY_TITLES[category],
    count: items.filter((item) => item.category === category).length,
  }))
