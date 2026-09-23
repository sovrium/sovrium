/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The three SCHEMA projections the design-system console reads over the wire:
 * the component-type catalogue, one type's fields, and the token document
 * flattened to rows.
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
import {
  schemaOptionGroupRows,
  schemaOptionTree,
} from '@/domain/models/app/design/schema-option-tree'
import { drawnPropsOf, specimenSnippet } from '@/domain/models/app/design/specimen-snippet'
import { statesOfType } from '@/domain/models/app/design/state-vocabulary'
import { introspectType } from '@/domain/models/app/design/type-introspection'
import { variantStateCells } from '@/domain/models/app/design/variant-state-cells'
import { ENGINE_COMPONENT_TYPES } from '@/domain/models/app/engine-component-types'
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
  ComponentTypeDetail,
  ComponentTypeField,
  ComponentTypeOptionsResponse,
  ComponentTypeRefusalState,
  ComponentTypeRoute,
  ComponentTypeSharedModule,
  ComponentTypeSibling,
  ComponentTypeSummary,
  FlatTokenRow,
} from '@/domain/models/api/admin/design-system/component-types'
import type { FieldTypeSummary } from '@/domain/models/api/admin/design-system/field-types'
import type { App } from '@/domain/models/app'
import type { SchemaOption, SchemaOptionGroup } from '@/domain/models/app/design/schema-option-tree'
import type { TypeField } from '@/domain/models/app/design/type-introspection'
import type { Component } from '@/domain/models/app/pages/components'

/**
 * Where a type's own page lives in the console, MOUNT-RELATIVE.
 *
 * Relative because the same page is served in two worlds: standalone at the
 * site root under `bun run app:admin`, and under `/_admin` inside an operator's
 * app. An absolute `/_admin/...` would be wrong in the first and redundant in
 * the second — the mount walk prefixes the relative form at render time, which
 * is correct in both.
 */
const detailHref = (type: string): string => `/design-system/ui-kit/${type}`

/**
 * Every component type the registry publishes, in category order.
 *
 * A REFUSED type is listed with its reason rather than hidden: absence would
 * read as "this type does not exist", which is false and leaves an author
 * nothing to act on. Its detail page is served too, carrying the reason where
 * the canvas would be — see {@link componentTypeDetail}.
 */
/**
 * The values of one lifted axis, as rows.
 *
 * Empty for a type that declares no such axis, and empty for one whose field is
 * not a closed union — `qr-code.size` is a NUMBER, and publishing it as a size
 * axis would put a sizes row on a card that has no sizes to show.
 */
const axisValues = (
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
const publishedField = (field: TypeField): ComponentTypeField => ({
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
const purposeOf = (type: string): string => {
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
 * ─── TWO EXCLUSIONS THAT USED TO BE ONE SET ────────────────────────────────
 *
 * `EXCLUDED_TYPES` is the DECLARATION-time exclusion — the types an author may
 * not point a `specimen` at, mirrored by `SPECIMEN_REFUSED_TYPES` — while the
 * catalogue owns what is DRAWN. The two named the same type for as long as
 * there was only one answer per type.
 *
 * `form` made them differ. Its bound modes emit a live submit control and stay
 * undeclarable inside a preview frame; its BARE mode carries no action and no
 * submit path, which is the shape [internal ref] A3 clause 1 names in so many words,
 * so the catalogue draws it. Publishing the exclusion's sentence anyway would
 * hand one card `drawable: true` and a reason explaining why nothing was drawn
 * — the two halves of one record disagreeing, which is exactly what
 * `[internal ref]` asserts cannot happen.
 *
 * So the catalogue's own refusal still wins where it exists, and this fallback
 * speaks only for a type nothing draws.
 */
const undrawnReason = (
  drawable: boolean,
  excludedReason: string | undefined
): string | undefined => (drawable ? undefined : excludedReason)

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
        // the blank strip the axis meta line was retired for, on the one field
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
const categoryOf = (type: string): (typeof CATALOG_COMPONENT_CATEGORIES)[number] | undefined =>
  CATALOG_COMPONENT_CATEGORIES.find((category) => catalogedTypesOf(category).includes(type))

/**
 * One type's fields, or `undefined` when this name is not a catalogued type.
 *
 * ─── [internal ref]: CATALOGUED IS THE LINE, DRAWABLE IS NOT ──────────────────────
 *
 * `undefined` — the caller's 404 — now covers one case: a name the catalogue
 * does not publish. That includes the four `editors` types, whose whole
 * category is withheld permanently because their SSR placeholders ship a live
 * write path ([internal ref] A3 clauses 2-3); the 404 there is the safety property and
 * `[internal ref]` asserts it.
 *
 * A type the catalogue LISTS but refuses to draw — `form` — is
 * served, with `drawable: false` and the reason in place of the canvas. Three
 * things forced the change:
 *
 *   - The catalogued names are already public vocabulary. The listing publishes
 *     every one of them with its refusal sentence, by design ("hiding it would
 *     read as 'this type does not exist', which is false"), so the detail 404
 *     withheld nothing a caller could not read one request earlier. It was
 *     anti-enumeration protecting a set that is not secret.
 *   - The refusal is about the preview FRAME, not about the schema. `form`'s
 *     fields are exactly as real as `button`'s and an author writing one needs
 *     them documented more than most; 404 said the documentation does not
 *     exist.
 * - `[internal ref]` requires a page for every catalogued type
 *     INCLUDING the refused ones, and a config page cannot 404 one segment of
 *     a set its own `page.params` vouched for.
 *
 * What is NOT relaxed: nothing draws. `drawable` is `false`, no specimen is
 * composed, and the page carries the sentence where the canvas would be — so
 * the preview frame the refusal exists to prevent is still prevented, which was
 * always the actual bound.
 */
export const componentTypeDetail = (
  type: string,
  app: App,
  routesLimit?: number
): ComponentTypeDetail | undefined => {
  const category = categoryOf(type)
  if (category === undefined) return undefined

  const introspection = introspectType(type)
  // Read exactly as the summary row reads them, from the same two functions, so
  // a card and the page it links to cannot disagree about whether a type draws.
  const specimen = catalogSpecimenComponent(type)
  const drawable = specimen !== undefined
  const refusal = catalogSpecimenRefusal(type)
  const refusalReason = refusal?.note ?? undrawnReason(drawable, EXCLUDED_TYPES[type])

  const usage = detailUsage(type, app, routesLimit)

  // Every OTHER type in the category, in category order. The page cannot apply
  // this exclusion itself: `visibility.record` compares a row field against a
  // literal, and the literal here is the page's own route parameter.
  const siblings: readonly ComponentTypeSibling[] = catalogedTypesOf(category)
    .filter((sibling) => sibling !== type)
    .map((sibling) => ({ type: sibling, href: detailHref(sibling) }))

  const variants = axisValues(introspection.variant)
  const sizes = axisValues(introspection.size)
  const states = statesOfType(type, category)
  const styleable = STYLEABLE_TYPES.has(type)
  return {
    ...detailRefusal(refusalReason, refusal?.state, specimen, type),
    type,
    category,
    title: CATALOG_CATEGORY_TITLES[category],
    purpose: purposeOf(type),
    href: detailHref(type),
    own: introspection.own.map(publishedField),
    // ROWS, not the introspector's bare `string[]`: `rowsKey` hands a template a
    // record and `$record.` names a field of one, so module names arrive
    // unprintable as strings. Same fix `variants`, `sizes`, `routes` and
    // `siblings` already carry.
    shared: introspection.shared.map((name): ComponentTypeSharedModule => ({ name })),
    ...(introspection.variant === undefined
      ? {}
      : { variant: publishedField(introspection.variant) }),
    ...(introspection.size === undefined ? {} : { size: publishedField(introspection.size) }),
    // FLAT copies of the two axes. The members are already reachable under
    // `variant.members`, but `rowsKey` is a flat `body[key]` lookup and
    // `$record.` cannot walk a path, so the nested form is unbindable from a
    // row template — which is what a variant matrix and a sizes row are.
    variants,
    sizes,
    // Read from the domain vocabulary rather than from the console builder that
    // used to own it: the type page is not the only caller that needs to know
    // which states a type has, and a page BUILDER is not a place another caller
    // can import from.
    // PROJECTED to the two published fields, never spread. `CategoryState` also
    // carries the RENDERING recipe — the props to merge, the paint to force —
    // and those are internals a page never sees: the contract publishes which
    // states exist and how each is reached, and `strictKeys` refuses the rest.
    // `scope` joins the projection for the same reason `source` is in it: both
    // say how to READ the state, and a consumer without the scope takes "a row
    // is selected" for "the table is selected". Published on EVERY state rather
    // than only on row-scoped ones — component scope is the common case, so
    // absence would be indistinguishable from an endpoint that models no scope
    // at all.
    states: states.map(({ state, source, scope }) => ({ state, source, scope })),
    // The matrix the two arrays above DESCRIBE but cannot be bound into: a
    // nested row template replaces the outer row with the inner rather than
    // merging them, so a cell beneath one can name a variant or a state and
    // never both — while its identifier is composed from both. The contract
    // carries the spec that pins it and the shapes that were measured against
    // it.
    //
    // Built from `variants` and `states` themselves, not from a second read of
    // `introspectType` / `statesOfCategory`, which is what makes
    // `cells.length === variantCount * stateCount` true by construction rather
    // than by intent. One computation, in the domain, because the drawing side
    // needs the same product and a page BUILDER is not a place a projection can
    // import from.
    cells: variantStateCells(variants, states),
    drawable,
    // The three counts a page reads to OMIT a section. Derivable from the arrays
    // beside them by anything but a config page: `visibility.record` compares a
    // field against a scalar and has neither a length nor a presence operator,
    // so `variants.length` is unreachable where `variantCount gt 0` is not.
    variantCount: variants.length,
    sizeCount: sizes.length,
    stateCount: states.length,
    // How many of those states can actually be PAINTED, which is the count a
    // page needs to decide whether the States section is worth drawing at all.
    //
    // Keyed on the refusal the catalogue holds rather than on `drawable`, and
    // read from the same `refusal` the sentence beside it comes from — so the
    // gate and the sentence can never come apart: a type that draws a refusal
    // note in every cell reports zero drawable states in the same breath.
    drawableStateCount: refusal === undefined ? states.length : 0,
    // The one gate that is a DISJUNCTION rather than a count — see the contract
    // for the census that makes it a field instead of two sibling rail entries.
    // Read off the two counts beside it, here, because a config page has no
    // `or`: `visibility.record` ANDs its operators over one field.
    hasVariantsOrStates: variants.length > 0 || states.length > 0,
    // The one field on this response about the READER's config rather than
    // about the engine — see {@link isRestyled}.
    //
    // CONJUNCTIVE, so the contract's "always false where `styleable` is false"
    // holds by construction rather than by the schema happening to refuse the
    // key. `design.components` is a closed struct, so a config naming
    // `customHTML` cannot survive a decode — but not every App reaching this
    // function came through one (the embedded preset is built in code), and a
    // response claiming a restyle the engine can never apply is worse than the
    // one branch it costs to prevent.
    configured: styleable && isRestyled(type, app),
    // And whether that answer is a GAP or a NON-QUESTION: a type with no key
    // under `design.components` cannot be configured, and must not be offered
    // the key. Derived from the registry, never from a list restated here.
    styleable,
    ...usage,
    siblings,
    // The exact parity `pageCount` has beside `routes`, and it is read off the
    // array rather than recomputed: the count and the list cannot disagree
    // about whether this type has company in its category.
    siblingCount: siblings.length,
  }
}

/**
 * One option row, narrowed to the fields the response contract publishes.
 *
 * Projected FIELD BY FIELD rather than spread, which is {@link publishedField}
 * one endpoint over and the same reasoning: the walker's row is a DOMAIN value
 * that legitimately carries more than this endpoint publishes, and `strictKeys`
 * on the response refuses the excess — so a spread makes every field a future
 * reader adds to `SchemaOption` a 500 here, on whichever types happen to reach
 * it.
 *
 * `publishedField` states that as "a spread would fail the encode rather than
 * leak", and treats failing loudly as the safe half of the trade. It is only the
 * safe half where the projection is explicit: the same `strictKeys` that refuses
 * a smuggled field is what turns an unprojected one into an outage.
 *
 * That is not hypothetical. `defaultNote` and `howTo` were added to the walk for
 * the `sovrium docs` manual — a schema-STATED fallback no decode can surface —
 * and reached this response by the spread that used to stand here. The result
 * was a 500 on 14 of the 90 catalogued types and a clean 200 on the other 76,
 * because the failure needs a type whose option tree descends into an annotated
 * node: `button` never does, `table` and `form` do.
 *
 * Each optional field is OMITTED rather than set to `undefined`, because absence
 * is the contract for all four — `truncated` absent means the walk reached the
 * row in full — and `optionalField` would decode a present `undefined` into a
 * key the console then has to treat as meaningful.
 */
const publishedOption = (row: SchemaOption): ComponentTypeOptionsResponse['items'][number] => ({
  path: row.path,
  kind: row.kind,
  ...(row.values === undefined ? {} : { values: row.values }),
  ...(row.defaultValue === undefined ? {} : { defaultValue: row.defaultValue }),
  ...(row.description === undefined ? {} : { description: row.description }),
  ...(row.truncated === undefined ? {} : { truncated: row.truncated }),
})

/**
 * One Configuration heading, narrowed the same way and for the same reason.
 *
 * No field of `SchemaOptionGroup` is excess TODAY, so this projection changes
 * nothing about the bytes on the wire. It is here because the row projection
 * above would otherwise close the defect for `items[]` and leave its twin open
 * one field away on `groups[]` — the same walker, the same `strictKeys`, and a
 * reader who adds a heading-level annotation next.
 */
const publishedGroup = (
  group: SchemaOptionGroup
): ComponentTypeOptionsResponse['groups'][number] => ({
  key: group.key,
  kind: group.kind,
  ...(group.description === undefined ? {} : { description: group.description }),
  ...(group.defaultValue === undefined ? {} : { defaultValue: group.defaultValue }),
  hasDefault: group.hasDefault,
  total: group.total,
})

/**
 * Every option one type accepts, or `undefined` when the name is not catalogued.
 *
 * ─── THE 404 IS THE DETAIL ROUTE'S, ONE LEVEL DOWN ─────────────────────────
 *
 * `undefined` covers exactly the case its sibling's does — a name the catalogue
 * does not publish, whether a typo or a type in a withheld category. A distinct
 * status would let a caller enumerate which types exist but are withheld.
 *
 * A type the catalogue LISTS but refuses to DRAW — `form` — is
 * SERVED, for the reason {@link componentTypeDetail} gives at length: refusing
 * to render a live submit control is a bound on the preview frame, and it says
 * nothing about whether an author may read what the type accepts. Their fields
 * are exactly as real as `button`'s, and an author writing one needs them
 * documented more than most.
 */
export const componentTypeOptions = (
  type: string,
  group?: string
): ComponentTypeOptionsResponse | undefined => {
  if (categoryOf(type) === undefined) return undefined

  // `groups` is published beside `items`, never instead of it: the flat list
  // answers "which key paths does this type accept", and the headings answer
  // "what does a Configuration section print". A page cannot derive one from
  // the other — a row template binds ONE rows source and cannot iterate an
  // array hanging off the row it is drawing — so both cross the wire.
  const { items, groups, capped } = schemaOptionTree(type)
  const headings = groups.map(publishedGroup)
  if (group === undefined) {
    const published = items.map(publishedOption)
    return { type, items: published, groups: headings, total: published.length, capped }
  }

  // ─── THE INNER READ OF THE TWO ───────────────────────────────────────────
  //
  // Narrowed in BOTH fields: the rows this group draws, and that group alone.
  // Leaving `groups` whole would let the inner read be mistaken for a second
  // copy of the outer one, and a page binding it would print every heading
  // again under each heading.
  //
  // An unknown group answers EMPTY rather than falling back to the whole list.
  // A silent fallback would draw every option of the type under one heading and
  // look exactly like a working page — the confident wrong answer, which is
  // worse than a blank section that says what it is.
  // `value` is added on TOP of the shared projection rather than carried through
  // it: it is the one field that tells a group read apart from the flat list, so
  // spelling it here keeps that difference where a reader of the two branches
  // looks for it.
  const rows = schemaOptionGroupRows(type, group).map((row) => ({
    ...publishedOption(row),
    value: row.value,
  }))
  return {
    type,
    items: rows,
    groups: headings.filter((heading) => heading.key === group),
    total: rows.length,
    capped,
  }
}

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

/**
 * Where the operator writes this type, as the two shapes the page needs.
 *
 * ONE walk of the config, exactly as the listing does — and asked for the whole
 * subject set rather than for this type, because `usageFacet` hoists the
 * traversal and a per-type query would re-walk a sixty-seven-page app on every
 * page view.
 *
 * Routes as ROWS, not a string array: `rowsKey` hands a template a RECORD and
 * `$record.` addresses a field of one, so bare strings would arrive unprintable.
 * Same fix already applied to `variants` and `sizes`.
 */
/**
 * The types `design.components` has a key for, as a set for O(1) lookup.
 *
 * Derived from the registry rather than restated, which is the whole point:
 * the excluded set is two names today (`command-palette`, `customHTML` — see
 * `UNSTYLEABLE_COMPONENT_TYPES` for why each owns no engine-drawn element), and
 * a third one added there must reach the wire without anyone remembering this
 * file exists. Restating the pair here would go wrong silently, in the
 * direction that offers a reader a key AppSchema refuses.
 *
 * `readonly string[]` -> `Set<string>` deliberately: the caller holds a route
 * PARAMETER, so the question is asked of an arbitrary string. Narrowing it to
 * `EngineComponentType` first is the same question with an extra step.
 */
const STYLEABLE_TYPES: ReadonlySet<string> = new Set(ENGINE_COMPONENT_TYPES)

/**
 * Whether the RENDERING app restyled this type under `design.components`.
 *
 * ─── THE SAME QUESTION THE OVERVIEW'S LEDGER ASKS, ONE LEVEL DOWN ──────────
 *
 * `layerDeclarations` in the coverage facet asks "did the operator write this
 * LAYER"; this asks "did they write this TYPE". Same shape, same rule for what
 * counts as written — a key that is present but EMPTY is not a declaration.
 * `design.components.button: {}` restyles nothing, and reporting it as
 * configured would tell a reader the type carries their classes when it carries
 * the platform recipe unchanged. Presence alone was the cheaper test and it is
 * the one that lies.
 *
 * The cast is the price of a CLOSED struct. `design.components` is a
 * `Schema.Struct` over `ENGINE_COMPONENT_TYPES` rather than a `Record` — for a
 * measured reason, since a `Record` silently DROPS an entry whose key fails
 * validation, so `buton:` would decode clean and style nothing — and a closed
 * struct has no index signature to address with a route parameter. Narrowing
 * `type` to `EngineComponentType` first would be worse than the cast, not
 * better: it would need the two unstyleable names filtered by hand here, which
 * is the registry fact restated a second time.
 *
 * A type `design.components` has no key for (`command-palette`, `customHTML`)
 * answers `false`, which is true — nothing was declared — and is all this field
 * can say. The contract records what that leaves open for a page.
 *
 * It reuses this module's own {@link keysOf} rather than restating the
 * record test, and that is not only tidiness: the helper is DEFENSIVE about a
 * non-record value, so a scalar written where a style block belongs reports
 * "not configured" instead of `Object.keys('x')` counting its characters as
 * declarations.
 */
const isRestyled = (type: string, app: App): boolean => {
  const components = (app.design?.components ?? {}) as Readonly<Record<string, unknown>>
  return keysOf(components[type]).size > 0
}

const detailUsage = (
  type: string,
  app: App,
  routesLimit?: number
): {
  readonly pageCount: number
  readonly routes: readonly ComponentTypeRoute[]
  readonly routesMore: number
} => {
  const row = usageFacet(app, 'type').items.find((entry) => entry.name === type)
  const all: readonly ComponentTypeRoute[] = (row?.routes ?? []).map((route) => ({ route }))
  // The cap is the CALLER's, which is what keeps this [internal ref]-clean: the server
  // does the arithmetic config has no operator for, and never decides how many
  // rows fit on somebody's page.
  //
  // `pageCount` stays the WHOLE truth while `routes` may be capped, so the two
  // stop agreeing the moment a cap is asked for. That is deliberate — the count
  // is about the app, the list is about this response — and `routesMore` is
  // what lets a reader tell which they are looking at.
  const capped = routesLimit === undefined ? all : all.slice(0, routesLimit)
  return {
    pageCount: row?.count ?? 0,
    routes: capped,
    routesMore: all.length - capped.length,
  }
}

/**
 * The three optional fields that all turn on whether the catalogue draws this
 * type — extracted so {@link componentTypeDetail} stays under its complexity
 * cap, and because they are one decision rather than three.
 *
 * `snippet` is ABSENT for a refused type because there is no drawn specimen to
 * serialise: config that produces nothing, offered for copying, is worse than no
 * config block. `refusalState` and `refusalReason` are the machine value and the
 * sentence of one refusal record, so a page carrying a state always has a reason
 * beside it.
 *
 * `drawnProps` travels with `snippet` and is absent on identical terms, because
 * the two are the readable and the machine-readable projection of ONE component
 * definition. Emitting one without the other would leave the pairing they exist
 * to enforce with nothing to compare against.
 */
const detailRefusal = (
  refusalReason: string | undefined,
  refusalState: ComponentTypeRefusalState | undefined,
  specimen: Component | undefined,
  type: string
): Readonly<Record<string, unknown>> => ({
  ...(refusalReason === undefined ? {} : { refusalReason }),
  ...(refusalState === undefined ? {} : { refusalState }),
  ...(specimen === undefined
    ? {}
    : { snippet: specimenSnippet(type, specimen), drawnProps: drawnPropsOf(specimen) }),
})

// ---------------------------------------------------------------------------
// The flat projection of the token document
// ---------------------------------------------------------------------------

/**
 * The token groups the DTCG document publishes, paired with the config record
 * that DECLARES them.
 *
 * The pairing is what makes `inherited` / `overridden` answerable at all: each
 * group is `{ ...platform defaults, ...what the author wrote }`, so a token is
 * the operator's exactly when its name is a key of the declaring record. This
 * is `projectShadows`' `provenance` field generalised — the same question, asked
 * of every group rather than only of the shadow ramp.
 *
 * `typography` has no inherited half at all (only declared steps are emitted),
 * which needs no special case: every emitted step is a declared key, so every
 * row comes out `overridden`, which is exactly true.
 */
/**
 * The keys of a record-shaped value, and the empty set for anything else.
 *
 * Defensive on purpose, and for the reason `animationTokensOf` is: the LEGACY
 * flat form of `design.motion?.animations` puts arbitrary animation names beside
 * `duration` / `easing`, so the value at one of those keys may be a scalar —
 * and `Object.keys('ease')` would then report four positional "declared token
 * names" that no author ever wrote.
 */
const keysOf = (record: unknown): ReadonlySet<string> =>
  typeof record === 'object' && record !== null && !Array.isArray(record)
    ? new Set(Object.keys(record as Readonly<Record<string, unknown>>))
    : new Set<string>()

const declaredNamesOf = (app: App): Readonly<Record<string, ReadonlySet<string>>> => {
  const { design } = app
  // Destructured rather than read through eight optional chains: each `?.` is a
  // branch, and one `?? {}` says the same thing once.
  const { colors, spacing, radius, breakpoints, typeScale, motion } = design ?? {}

  return {
    color: keysOf(colors),
    spacing: keysOf(spacing),
    radius: keysOf(radius),
    breakpoint: keysOf(breakpoints),
    font: keysOf(typeScale?.families),
    typography: keysOf(typeScale?.steps),
    duration: keysOf(motion?.durations),
    easing: keysOf(motion?.easings),
  }
}

/**
 * Which config path AUTHORS each published group.
 *
 * Read as the `locked` rule rather than as documentation: a group with no
 * authoring position is one config cannot change, so it is locked by
 * construction rather than by a hand-kept list that would go stale the moment a
 * group gained or lost a position. Every group has one today, so every row
 * comes out unlocked — a measured fact about this document, not a stub. The one
 * genuinely non-overridable layer of the design system is the component
 * accessibility FLOOR, and a floor is a class list rather than a token, so it
 * has no row here; it is reported by the provenance read, where `locked` is live.
 */
const AUTHORING_PATH: Readonly<Record<string, string>> = {
  color: 'design.colors',
  spacing: 'design.spacing',
  radius: 'design.radius',
  breakpoint: 'design.breakpoints',
  font: 'design.typeScale.families',
  typography: 'design.typeScale',
  duration: 'design.motion.durations',
  easing: 'design.motion.easings',
}

/**
 * A DTCG COLOUR composite, as CSS spells it.
 *
 * `hex` is carried verbatim whenever the authored value was hexadecimal, so it
 * is both the shortest true spelling and the one the author wrote. Anything else
 * is a pass-through space (`oklch`, `hsl`, …) whose components DTCG stores
 * unwrapped, and the function form is what a renderer applies.
 */
const stringifyColorValue = (value: Readonly<Record<string, unknown>>): string | undefined => {
  const { colorSpace, components, hex, alpha } = value
  if (typeof colorSpace !== 'string' || !Array.isArray(components)) return undefined
  if (typeof hex === 'string' && alpha === undefined) return hex
  const channels = components.join(' ')
  const opacity = typeof alpha === 'number' ? ` / ${alpha}` : ''
  return `${colorSpace === 'srgb' ? 'rgb' : colorSpace}(${channels}${opacity})`
}

/** A DTCG DIMENSION or DURATION composite — `{ value, unit }` — as CSS spells it. */
const stringifyMeasureValue = (value: Readonly<Record<string, unknown>>): string | undefined => {
  const { value: magnitude, unit } = value
  return typeof magnitude === 'number' && typeof unit === 'string'
    ? `${magnitude}${unit}`
    : undefined
}

/**
 * A token's `$value` as the table prints it.
 *
 * A DTCG value is a string for most groups, an ARRAY for a font stack and a
 * cubic-bezier, and an OBJECT for a colour, a dimension, a duration or a
 * typography composite. The table renders one cell, so each shape gets the
 * compact spelling a reader would write it in rather than a JSON dump with
 * quotes and braces they then have to strip.
 *
 * ─── THE TWO NAMED COMPOSITES ARE NOT DECORATION ───────────────────────────
 *
 * A colour and a dimension both have ONE canonical CSS spelling, and the generic
 * `key: value; …` fallback produces something no reader can use and no swatch
 * can paint: `colorSpace: srgb; components: 0.42, 0.5, 0.37; hex: #6b7f5e` for a
 * colour the author simply wrote as `#6b7f5e`, and `value: 0; unit: px` for
 * `0px`. `[internal ref]` pins the colour half against the
 * declared constant, which is what makes the difference visible.
 *
 * The typography composite genuinely has no single CSS spelling — it is a
 * bundle of four properties — so it keeps the generic form, which is why that
 * branch stays rather than being replaced.
 *
 * ─── EXPORTED FOR ONE CALLER, AND THAT IS THE POINT ────────────────────────
 *
 * `typographyProjection` lifts `fontSize` out of that composite so a config
 * page can address it, and spends THIS function to spell it rather than a
 * second formatter of its own. Two formatters over one value is the drift the
 * flat halves exist to avoid: the row's `value` and its `fontSize` are read off
 * the same member, so they must be spelled by the same code or they can come to
 * disagree with nothing noticing.
 */
export const stringifyTokenValue = (value: unknown): string => {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return value.map((entry) => stringifyTokenValue(entry)).join(', ')
  if (typeof value === 'object' && value !== null) {
    const record = value as Readonly<Record<string, unknown>>
    return (
      stringifyColorValue(record) ??
      stringifyMeasureValue(record) ??
      Object.entries(record)
        .map(([key, entry]) => `${key}: ${stringifyTokenValue(entry)}`)
        .join('; ')
    )
  }
  return ''
}

/** A DTCG token, as far as the flattener reads it. */
type TokenNode = Readonly<{ $value?: unknown }>

/** Whether a document member is a token rather than a group of them. */
const isToken = (value: unknown): value is TokenNode =>
  typeof value === 'object' && value !== null && '$value' in value

/**
 * Every token of the document, flattened to rows addressed by dotted path.
 *
 * A PROJECTION, never a replacement: `GET /api/admin/design-system.json` serves
 * a DTCG document, whose nested shape is what a conformant consumer reads, and
 * this is emitted only behind `?flat=1`. A table cannot render a tree, and the
 * console's "Votre design" page IS a table — N inherited, M overridden.
 *
 * `$description`, `$extensions` and every other `$`-prefixed member are skipped:
 * they are document METADATA rather than tokens, and a row for `$description`
 * would put the document's own sentence in the palette table.
 *
 * @param document - The DTCG document `buildDesignSystem(app)` produced.
 * @param app - The same app, read for which names the operator declared.
 * @returns One row per token, in document order.
 */
export const flattenDesignTokens = (
  document: Readonly<Record<string, unknown>>,
  app: App
): readonly FlatTokenRow[] => {
  const declared = declaredNamesOf(app)

  return Object.entries(document).flatMap(([group, members]) => {
    if (group.startsWith('$') || typeof members !== 'object' || members === null) return []
    const declaredHere = declared[group] ?? new Set<string>()
    const locked = !(group in AUTHORING_PATH)

    return Object.entries(members as Record<string, unknown>).flatMap(([name, token]) => {
      if (!isToken(token)) return []
      const overridden = declaredHere.has(name)
      return [
        {
          path: `${group}.${name}`,
          value: stringifyTokenValue(token.$value),
          inherited: !overridden,
          overridden,
          locked,
        },
      ]
    })
  })
}
