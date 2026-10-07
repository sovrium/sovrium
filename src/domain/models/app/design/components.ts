/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import {
  COMPONENT_STATE_VARIANTS,
  COMPONENT_STATES,
  ComponentStyleSchema,
} from '../component-style'
import { ENGINE_COMPONENT_TYPES } from '../engine-component-types'
import type { ComponentState } from '../component-style'
import type { EngineComponentType } from '../engine-component-types'

export {
  COMPONENT_STATE_VARIANTS,
  COMPONENT_STATES,
  ComponentStyleSchema,
  type ComponentState,
  type ComponentStyle,
} from '../component-style'

/**
 * Per-engine-type styling: the classes an operator adds to the components
 * Sovrium itself draws.
 *
 * ## The gap this closes
 *
 * An author can already restyle ONE component instance — `props.className` on
 * the node. What has never been expressible is "every button in this app", and
 * the workaround is to repeat the same class list at every call site, which
 * drifts the moment one site is missed. A token reaches this only where
 * a token happens to be wired; a recipe's `rounded-base` is not a token an
 * operator can retune.
 *
 * So this key is indexed by ENGINE TYPE — `button`, `table`, `dialog` —
 * and not by the author's own `components[]` names. Those are templates the
 * author already controls end to end; these are the components Sovrium ships.
 *
 * ## Why a closed Struct and not a Record
 *
 * The measured Effect v4 trap, avoided the same way `TypeScaleSchema` avoids
 * it: `Schema.Record` **silently DROPS** an entry whose KEY fails the key
 * schema — no error under any option, including `onExcessProperty: 'error'`.
 * An operator writing `buton:` or `dataTable:` would be told the config is
 * valid and would ship an app that ignored every class they wrote.
 *
 * The type set CAN be enumerated (it is {@link ENGINE_COMPONENT_TYPES},
 * derived from the same tuple the component union is built from), so it is a
 * `Schema.Struct` and a typo is reported BY NAME at the decode boundary. The
 * trap is not worked around here; it is made inexpressible.
 *
 * One implementation note, because getting it wrong is invisible: the key type
 * of the built struct comes from the ELEMENT TYPE of
 * {@link ENGINE_COMPONENT_TYPES}. A `readonly string[]` there produces a struct
 * whose TypeScript type is an index signature — runtime validation still
 * refuses `buton`, but the editor offers no completion and `tsc` accepts it.
 * The list is therefore typed `readonly EngineComponentType[]`.
 *
 * The cost is a wide generated type — one optional key per engine type in
 * `sovrium.d.ts` and in the published JSON Schema. That is the deliberate side
 * of the trade: those keys are also what gives an author autocomplete over the
 * styleable surface, which is exactly the affordance a `Record<string, …>`
 * cannot offer.
 */

// The state vocabulary and `ComponentStyleSchema` live in `./component-style`
// (see that module for why they are a separate leaf).

/**
 * Styling for the engine's own components, keyed by component type.
 *
 * A closed `Schema.Struct` over {@link ENGINE_COMPONENT_TYPES} — see the module
 * doc for why a `Schema.Record` is the wrong shape here and what it would cost.
 */
export const DesignComponentsSchema = Schema.Struct(
  Object.fromEntries(
    ENGINE_COMPONENT_TYPES.map((type) => [type, Schema.optional(ComponentStyleSchema)])
  ) as Record<EngineComponentType, Schema.optional<typeof ComponentStyleSchema>>
).pipe(
  Schema.annotate({
    identifier: 'DesignComponents',
    title: 'Component Styles',
    description:
      "Per-engine-type styling: the classes an operator adds to the components Sovrium draws. Keys are component types (`button`, `table`), not the app's own `components[]` names — those carry their styling on the template.",
    examples: [
      {
        button: {
          parts: { root: 'rounded-none' },
          states: { hover: { root: 'bg-neutral-800' } },
        },
      },
    ],
  })
)

/**
 * Prefix every token of a state class list with that state's Tailwind variant.
 *
 * The single implementation of the `states` contract: a class list is written
 * WITHOUT its prefix (the schema refuses one that carries it), and this is
 * where the prefix is added. Two callers, and they must agree exactly or the
 * key breaks in the way that is hardest to see — the class reaching the element
 * and the class reaching the CSS candidate corpus would differ, so the element
 * would carry a utility the stylesheet never emitted and nothing would paint:
 *
 *  - the resolver that builds an element's class list
 *    (`presentation/utils/design/resolve-component-classes.ts`);
 *  - the CSS candidate harvest ({@link designComponentClassCandidates}).
 *
 * A token that already carries a responsive or container-query prefix keeps it:
 * `md:bg-x` under `hover` becomes `hover:md:bg-x`, which is the correct
 * Tailwind ordering.
 *
 * @param state - One state name from {@link COMPONENT_STATE_VARIANTS}.
 * @param classes - The unprefixed class list written under that state.
 * @returns The same list with the state's variant on every token.
 */
export const applyComponentStateVariant = (state: ComponentState, classes: string): string =>
  classes
    .split(/\s+/)
    .filter((token) => token.length > 0)
    .map((token) => `${COMPONENT_STATE_VARIANTS[state]}:${token}`)
    .join(' ')

/** Every class token in one part map, flattened. */
const partMapTokens = (parts: unknown): readonly string[] =>
  parts === null || typeof parts !== 'object'
    ? []
    : Object.values(parts as Record<string, unknown>).flatMap((classes) =>
        typeof classes === 'string' ? classes.split(/\s+/).filter((t) => t.length > 0) : []
      )

/**
 * Every Tailwind class an operator's `design.components` block will emit, as it
 * will be emitted — state entries carry their variant prefix.
 *
 * The CSS candidate scan reads `className` / `class` keys with string values and
 * NOTHING else, so a new key holding classes is a SILENT no-op: the class lands
 * on the element and the stylesheet never emits the utility. This function is
 * what stops `design.components` being that no-op, and it lives in the domain
 * beside the state vocabulary so the harvest and the resolver cannot drift.
 *
 * @param components - The app's `design.components` block, if any.
 * @returns Every candidate token, unordered and possibly duplicated.
 */
export const designComponentClassCandidates = (components: unknown): readonly string[] => {
  if (components === null || typeof components !== 'object') return []
  return Object.values(components as Record<string, unknown>).flatMap((style) => {
    if (style === null || typeof style !== 'object') return []
    const { parts, variants, states } = style as {
      parts?: unknown
      variants?: unknown
      states?: unknown
    }
    const variantTokens =
      variants === null || typeof variants !== 'object'
        ? []
        : Object.values(variants as Record<string, unknown>).flatMap(partMapTokens)
    const stateTokens =
      states === null || typeof states !== 'object'
        ? []
        : Object.entries(states as Record<string, unknown>).flatMap(([state, parts_]) =>
            COMPONENT_STATES.includes(state as ComponentState)
              ? partMapTokens(parts_).map((token) =>
                  applyComponentStateVariant(state as ComponentState, token)
                )
              : []
          )
    return [...partMapTokens(parts), ...variantTokens, ...stateTokens]
  })
}

/**
 * Every Tailwind class the per-instance `classes` keys of an app will emit:
 * a component node's own `classes` and a markdown page's `markdown.classes`,
 * at any depth, state entries prefixed exactly as {@link designComponentClassCandidates}
 * prefixes them.
 *
 * Without this the key is the silent no-op that function documents: the
 * candidate scan reads `className` / `class` keys only.
 *
 * @param node - The app config, or any subtree of it.
 * @returns Every candidate token, unordered and possibly duplicated.
 */
export const componentClassesCandidates = (node: unknown): readonly string[] => {
  if (Array.isArray(node)) return node.flatMap(componentClassesCandidates)
  if (node === null || typeof node !== 'object') return []
  return Object.entries(node as Record<string, unknown>).flatMap(([key, value]) =>
    key === 'classes' && value !== null && typeof value === 'object' && !Array.isArray(value)
      ? designComponentClassCandidates({ instance: value })
      : componentClassesCandidates(value)
  )
}

/** @public */
export type DesignComponents = Schema.Schema.Type<typeof DesignComponentsSchema>
