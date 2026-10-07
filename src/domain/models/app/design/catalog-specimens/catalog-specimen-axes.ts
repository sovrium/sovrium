/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A catalogue specimen drawn IN its axis values — variant, size, state — and
 * the type's own node inside a composing specimen. Split from
 * `catalog-specimens.ts`, which holds the specimens themselves.
 */

import { componentWithRecipe } from '@/domain/models/app/design/catalog-specimens/recipe-application'
import { stateRecipeOf } from '@/domain/models/app/design/state-vocabulary'
import { catalogSpecimenComponent, SPECIMENS_BY_CATEGORY } from './catalog-specimens'
import type { CategoryState } from '@/domain/models/app/design/state-vocabulary'
import type { TypeField, TypeIntrospection } from '@/domain/models/app/design/type-introspection'
import type { Component } from '@/domain/models/app/pages/components'

/**
 * The axis values a specimen may be drawn IN.
 *
 * All three optional and independent: a subject may name a variant without a
 * size, a state without either, or none at all — which is the plain specimen.
 */
export interface SpecimenAxes {
  readonly variant?: string
  readonly size?: string
  readonly state?: string
}

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * The catalogue's specimen for one type, drawn IN the axis values it was given.
 *
 * ─── ONE DECLARATION, ONE CELL OF THE MATRIX ───────────────────────────────
 *
 * `specimen.subject` already turns ninety kit pages into one by taking its TYPE
 * from a route or a row. A variant matrix is the next axis over: seven variants
 * by three sizes is twenty-one cells, and writing them out is the ninety-page
 * problem again one level down. So a subject may name the axis values too, and
 * a row template draws one cell per row.
 *
 * ─── THE AXIS FIELD IS LIFTED, NEVER ASSUMED ───────────────────────────────
 *
 * `variant` and `size` are written onto whichever FIELD the introspector lifted
 * for this type, not onto a field of those names: the axis is a closed union
 * wherever the schema put it, and a type spelling it otherwise would be handed
 * a property it does not declare. The introspection is passed IN rather than
 * read here, so the caller that already holds it — a detail endpoint publishing
 * the axis rows a page then draws — reads the schema once per request instead
 * of once per cell.
 *
 * ─── AND THE SPECIMEN IS UNWRAPPED TO THE TYPE'S OWN NODE ─────────────────
 *
 * MEASURED, and it is the whole difference between a matrix and twenty-one
 * copies of one picture. A catalogue specimen is illustrative, so several of
 * them COMPOSE: `button`'s is a `container` of five buttons showing five
 * variants side by side, and `badge`'s is the same shape. Patching the axis
 * onto that root writes `variant` onto a `container`, which declares no such
 * field — the renderer drops it and every cell of the matrix draws the same
 * five buttons. So when an axis is named the type's OWN node inside the
 * specimen is what gets drawn, keeping the illustrative content (`label`,
 * `options`, children) that makes a bare `select` more than an empty box.
 *
 * With NO axis named nothing is unwrapped: the plain subject must keep drawing
 * exactly what it drew before this feature, or every existing kit page changes
 * under it.
 *
 * ─── AND A STATE IS APPLIED THE WAY AN AUTHOR WOULD REACH IT ───────────────
 *
 * A `rendered` state merges the real attribute the dispatcher reads, so the
 * element IS in that state. A `depicted` one merges an inline style, because a
 * browser pseudo-class cannot be forced from markup. Publishing the difference
 * is `componentTypeDetail.states[]`'s job; honouring it is this function's.
 *
 * `undefined` for a type with no drawing, and for an axis value the type does
 * not declare — the caller reports that in place rather than drawing a cell
 * that silently ignored what it was asked for.
 */
/**
 * The axis value written onto the field the introspector lifted for it:
 * `{}` when no value was asked for, and `undefined` when one was asked for that
 * the type does not declare.
 *
 * Wrapped for the same reason {@link recipeFor} is: "no axis" and "an axis this
 * type has never heard of" are different answers, and only the second is a
 * refusal. Membership is tested against the union's OWN members rather than
 * merely against the field existing, so a value from the wrong type's rows is
 * refused instead of being handed to a renderer that would ignore it.
 */
const axisPatch = (
  value: string | undefined,
  field: TypeField | undefined
): Readonly<Record<string, string>> | undefined => {
  if (value === undefined) return {}
  if (field === undefined || !(field.members ?? []).includes(value)) return undefined
  return { [field.name]: value }
}

/**
 * The type's own node inside its catalogue specimen — the root itself when the
 * specimen IS one control, and the first descendant of that type when it
 * composes several.
 *
 * Depth-first and first-match, because a composing specimen lists its own type
 * as siblings: any one of them is a faithful base, and the first is the one an
 * author reads as "the default".
 */
export const ownNodeOf = (
  node: unknown,
  type: string
): Readonly<Record<string, unknown>> | undefined => {
  if (!isPlainRecord(node)) return undefined
  if (node['type'] === type) return node
  const children = Array.isArray(node['children']) ? node['children'] : []
  return children.reduce<Readonly<Record<string, unknown>> | undefined>(
    (found, child) => found ?? ownNodeOf(child, type),
    undefined
  )
}

/**
 * The state recipe for a subject: `{ recipe }` when it resolves, `{}` when no
 * state was asked for, and `undefined` when a state was asked for that nothing
 * draws.
 *
 * Wrapped rather than returning the recipe directly, because "no state" and
 * "an unknown state" are different answers and only the second is a refusal.
 */
const recipeFor = (
  type: string,
  state: string | undefined
): { readonly recipe?: CategoryState } | undefined => {
  if (state === undefined) return {}
  const category = CATEGORY_OF_TYPE.get(type)
  // Resolved per TYPE with the category as fallback — the same chain the
  // endpoint publishes through, so a cell can never be asked to draw a state
  // the contract did not list, or miss one it did.
  const recipe = category === undefined ? undefined : stateRecipeOf(type, category, state)
  return recipe === undefined ? undefined : { recipe }
}

export function catalogSpecimenInAxes(
  type: string,
  axes: SpecimenAxes,
  introspection: Pick<TypeIntrospection, 'variant' | 'size'>
): Component | undefined {
  const base = catalogSpecimenComponent(type)
  if (base === undefined || !isPlainRecord(base)) return base
  if (axes.variant === undefined && axes.size === undefined && axes.state === undefined) return base

  const resolved = recipeFor(type, axes.state)
  const variant = axisPatch(axes.variant, introspection.variant)
  const size = axisPatch(axes.size, introspection.size)
  if (resolved === undefined || variant === undefined || size === undefined) return undefined

  const drawn = ownNodeOf(base, type) ?? base
  return {
    ...drawn,
    ...variant,
    ...size,
    ...componentWithRecipe(drawn, resolved.recipe),
  } as Component
}

/** Which published category each catalogued type belongs to. */
const CATEGORY_OF_TYPE: ReadonlyMap<string, string> = new Map(
  Object.entries(SPECIMENS_BY_CATEGORY).flatMap(([category, specimens]) =>
    specimens.map((specimen) => [specimen.type, category] as const)
  )
)
