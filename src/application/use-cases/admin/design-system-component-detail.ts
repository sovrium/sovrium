/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The detail projection of the design-system console: one catalogued type's
 * fields, axes, states, usage and siblings, as its own page reads them.
 */

import {
  catalogSpecimenComponent,
  catalogSpecimenRefusal,
} from '@/domain/models/app/design/catalog-specimens'
import { drawnPropsOf, specimenSnippet } from '@/domain/models/app/design/specimen-snippet'
import { statesOfType } from '@/domain/models/app/design/state-vocabulary'
import { introspectType } from '@/domain/models/app/design/type-introspection'
import { variantStateCells } from '@/domain/models/app/design/variant-state-cells'
import { ENGINE_COMPONENT_TYPES } from '@/domain/models/app/engine-component-types'
import {
  CATALOG_CATEGORY_TITLES,
  EXCLUDED_TYPES,
  catalogedTypesOf,
} from '@/domain/models/app/pages/components/component-types/catalog'
import {
  axisValues,
  categoryOf,
  detailHref,
  publishedField,
  purposeOf,
  undrawnReason,
} from './design-system-schema'
import { keysOf } from './design-system-token-rows'
import { usageFacet } from './design-system-usage-facet'
import type {
  ComponentTypeDetail,
  ComponentTypeRefusalState,
  ComponentTypeRoute,
  ComponentTypeSharedModule,
  ComponentTypeSibling,
} from '@/domain/models/api/admin/design-system/component-types'
import type { App } from '@/domain/models/app'
import type { Component } from '@/domain/models/app/pages/components'

/**
 * One type's fields, or `undefined` when this name is not a catalogued type.
 *
 * ─── CATALOGUED IS THE LINE, DRAWABLE IS NOT ───────────────────────────────
 *
 * `undefined` — the caller's 404 — now covers one case: a name the catalogue
 * does not publish. That includes the four `editors` types, whose whole
 * category is withheld permanently because their SSR placeholders ship a live
 * write path ([internal ref] A3 clauses 2-3); the 404 there is the safety property and
 * the console's specs assert it.
 *
 * A type the catalogue LISTS but refuses to draw — `form` — is
 * served, with `drawable: false` and the reason in place of the canvas, for
 * three reasons:
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
 *   - The console carries a page for every catalogued type
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
    // Read from the domain vocabulary rather than from a console builder: the
    // type page is not the only caller that needs to know
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
  // The cap is the CALLER's, which keeps the server out of layout: it
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
