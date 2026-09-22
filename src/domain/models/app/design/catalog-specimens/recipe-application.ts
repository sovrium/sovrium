/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * How a STATE RECIPE reaches the specimen it is drawn on.
 *
 * ─── THREE REACHES, BECAUSE A COMPONENT IS NOT ONE BAG ─────────────────────
 *
 * A recipe used to merge into `props` and nothing else, and that single reach
 * decided which states could be published honestly. `props` addresses HTML
 * attributes; a component's own declared options are siblings of `props`, and
 * its `dataSource` is a sibling too. So a state reached by a declared option —
 * a grid whose rows can be selected — and a state reached by the data source
 * answering differently — a grid with no rows — were both unreachable, and the
 * only way to publish either was to file it as a DEPICTION: a drawing presented
 * with the authority of a rendering, which is the one claim
 * `state-vocabulary.ts` exists to refuse.
 *
 * Each reach lands where its kind of state actually lives:
 *
 *  - `props`  → HTML attributes (`disabled`, `aria-invalid`)
 *  - `fields` → the component's own declared options (`selection`)
 *  - `sourceQuery` → merged INTO `dataSource.system.query`, never assigned over
 *    it, so the endpoint and `rowsKey` survive and the vocabulary stays
 *    ignorant of which endpoint the catalogue points at
 *
 * ─── AND ONE REFUSAL ───────────────────────────────────────────────────────
 *
 * Everything here lands on the COMPONENT. A ROW-scoped recipe's paint is
 * therefore dropped rather than applied: a row's fill drawn at component scope
 * fills the entire specimen, and a reader would see a table painted end to end
 * and take it for the table being in that state — the misreading `scope` was
 * added to prevent.
 */

import type { CategoryState } from '@/domain/models/app/design/state-vocabulary'

/** A non-null, non-array object — the shape every merge below reads. */
const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * The component's props, with a state recipe's attributes and paint merged in.
 *
 * A row-scoped paint is deliberately NOT merged — see the refusal above.
 */
export const propsWithRecipe = (
  declared: unknown,
  recipe: CategoryState | undefined
): Readonly<Record<string, unknown>> => {
  const props = isPlainRecord(declared) ? declared : {}
  const style = {
    ...(isPlainRecord(props['style']) ? props['style'] : {}),
    ...(recipe?.scope === 'row' ? {} : (recipe?.style ?? {})),
  }
  return {
    ...props,
    ...(recipe?.props ?? {}),
    ...(Object.keys(style).length === 0 ? {} : { style }),
  }
}

/**
 * The specimen's `dataSource`, with a recipe's `sourceQuery` merged into the
 * system arm's own query — or nothing at all when neither is present.
 *
 * Returns a PATCH (`{}` or `{ dataSource }`) rather than the binding itself, so
 * a specimen with no data source, or a recipe with no query, spreads to nothing
 * and the declared binding is left exactly as the catalogue wrote it.
 */
export const dataSourceWithRecipe = (
  declared: unknown,
  recipe: CategoryState | undefined
): Readonly<Record<string, unknown>> => {
  const query = recipe?.sourceQuery
  if (query === undefined || !isPlainRecord(declared)) return {}
  const { system } = declared
  if (!isPlainRecord(system)) return {}
  return {
    dataSource: {
      ...declared,
      system: {
        ...system,
        query: { ...(isPlainRecord(system['query']) ? system['query'] : {}), ...query },
      },
    },
  }
}

/**
 * Every reach applied at once: the drawn node, its recipe's component-level
 * fields, its data-source patch, and its props.
 *
 * One function because the ORDER matters and is easy to get wrong in a caller:
 * the axis patches a caller spreads afterwards must still win, and `props` is
 * assigned last because it is computed from the node's own declared props
 * rather than replacing them wholesale.
 */
export const componentWithRecipe = (
  drawn: Readonly<Record<string, unknown>>,
  recipe: CategoryState | undefined
): Readonly<Record<string, unknown>> => ({
  ...(recipe?.fields ?? {}),
  ...dataSourceWithRecipe(drawn['dataSource'], recipe),
  props: propsWithRecipe(drawn['props'], recipe),
})
