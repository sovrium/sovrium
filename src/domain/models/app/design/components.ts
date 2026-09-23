/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { ENGINE_COMPONENT_TYPES } from '../engine-component-types'
import { TailwindClassListSchema } from '../tailwind-class-list'
import type { EngineComponentType } from '../engine-component-types'

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

/**
 * The state vocabulary, and the Tailwind variant each name maps to.
 *
 * ## Why a closed set, and why THESE
 *
 * Every entry is backed by exactly ONE Tailwind variant, so a state name has a
 * single meaning the engine can apply mechanically. The set is measured rather
 * than imagined — it is the census of state variants the shipped recipes and
 * island class builders actually use, ordered by frequency at the time of
 * writing: `hover` (218 uses), `focus-visible` (121), `disabled` (108),
 * `focus` (67), `open` (31), `active` (21), `selected` (8), `checked` (3),
 * `invalid` (3).
 *
 * `focus` and `focusVisible` are BOTH here rather than collapsed. Naming one
 * key `focus` and quietly emitting `focus-visible:` would be the schema lying
 * about what it does, and the two are genuinely different: `focus` fires on a
 * programmatic or mouse focus, `focus-visible` only on the keyboard path the
 * accessibility floor guards.
 *
 * ## What is deliberately absent
 *
 * - **A render-computed state** such as `loading` or `pressed`. These have no
 *   Tailwind variant: the renderer branches on them. Admitting one here would
 *   put two mechanisms under one key — half the entries applying through the
 *   cascade and half through a code path — and an author could not tell which
 *   kind they had written until one silently did nothing. Expressing them needs
 *   renderer support and is a named follow-up, not a schema widening.
 * - **`motion-reduce`** and the focus RING itself. Those belong to the
 *   non-overridable floor, which is applied after the operator's classes
 *   precisely so an operator cannot remove them.
 */
export const COMPONENT_STATE_VARIANTS = {
  hover: 'hover',
  focus: 'focus',
  focusVisible: 'focus-visible',
  active: 'active',
  disabled: 'disabled',
  open: 'open',
  selected: 'selected',
  checked: 'checked',
  invalid: 'invalid',
} as const

/**
 * One state name.
 *
 * `as const` above and this alias are the same requirement the engine-type list
 * has: the `states` struct takes its key type from here, and a widened `string`
 * would emit an index signature that validates at runtime while accepting
 * `hovered` at compile time.
 *
 * @public
 */
export type ComponentState = keyof typeof COMPONENT_STATE_VARIANTS

/** The state names, in declaration order. */
/**
 * What each state MEANS to a reader of the published schema.
 *
 * Keyed off {@link COMPONENT_STATE_VARIANTS} so a state added there without a
 * sentence here fails the type-check rather than shipping undocumented.
 */
export const COMPONENT_STATE_DESCRIPTIONS: Readonly<Record<ComponentState, string>> = {
  hover: 'Classes applied while the pointer is over the component.',
  focus: 'Classes applied while the component holds keyboard focus, however it was reached.',
  focusVisible:
    'Classes applied while the component holds keyboard focus and the browser judges a focus ring warranted — typically after keyboard navigation, not after a click.',
  active: 'Classes applied while the component is being pressed.',
  disabled: 'Classes applied while the component refuses interaction.',
  open: 'Classes applied while the component is expanded, such as an open menu or dialog trigger.',
  selected: 'Classes applied while the component is the chosen one among its siblings.',
  checked: 'Classes applied while a checkbox, radio or switch is on.',
  invalid: 'Classes applied while the value the component holds has been refused.',
}

export const COMPONENT_STATES: readonly ComponentState[] = Object.keys(
  COMPONENT_STATE_VARIANTS
) as readonly ComponentState[]

/**
 * A class list written under a `states` entry — UNPREFIXED.
 *
 * The engine applies the state's own variant (`hover:`, `disabled:`, …) to
 * every token. Writing the prefix again would produce `hover:hover:bg-…`,
 * which generates no CSS and fails silently, so a redundant prefix is refused
 * by name rather than accepted.
 *
 * Other variants stay legal and are prefixed along with the rest of the token:
 * `md:bg-x` under `hover` becomes `hover:md:bg-x`. That is why the check looks
 * only at the FIRST variant segment — a responsive or container-query prefix is
 * not the mistake this catches.
 */
const stateVariantPrefixViolation = (value: string): string | undefined =>
  value
    .split(/\s+/)
    .flatMap((token) => {
      const firstVariant = token.split(':').at(0)
      return firstVariant !== undefined &&
        firstVariant !== token &&
        (Object.values(COMPONENT_STATE_VARIANTS) as readonly string[]).includes(firstVariant)
        ? [{ token, variant: firstVariant }]
        : []
    })
    .at(0)?.token

const StateClassListSchema = TailwindClassListSchema.pipe(
  // ANNOTATE BEFORE CHECK — a trailing `annotate` lands on the check, and the
  // emitted JSON Schema loses its `title` and `description`.
  Schema.annotate({
    title: 'State Class List',
    description:
      'Tailwind utilities for one state, written without the state variant prefix — the engine applies it.',
    examples: ['bg-neutral-800', 'md:opacity-90'],
  }),
  Schema.check(
    Schema.makeFilter((value: string) => {
      const offender = stateVariantPrefixViolation(value)
      return (
        offender === undefined ||
        `A class list under \`states\` is written WITHOUT its state prefix — the engine adds it. Drop the prefix from \`${offender}\`: keeping it would emit a doubled variant that generates no CSS.`
      )
    })
  )
)

/**
 * Classes keyed by the PART of a component they land on.
 *
 * Every engine component has a `root`; a composite one names its inner elements
 * too (`table` has a `header`, a `row`, a `cell`).
 *
 * The key is a plain `Schema.String`, and for once that is not a workaround: a
 * plain string key can never fail, so nothing is ever dropped. What it cannot
 * do is catch a MISTYPED part, and that check genuinely cannot live here — the
 * per-type part vocabulary is owned by the presentation-layer renderers, and
 * the domain layer may not import them. It belongs to the resolver that reads
 * this key, which knows the parts of the type it is resolving. Recorded rather
 * than papered over: a mistyped part name decodes clean today and styles
 * nothing.
 */
const PartClassesSchema = Schema.Record(
  Schema.String.annotate({
    title: 'Component Part',
    description:
      "Name of a part of the component — `root` on every type, plus that type's own inner elements.",
    examples: ['root', 'header', 'cell', 'label'],
  }),
  TailwindClassListSchema
)

const StatePartClassesSchema = Schema.Record(
  Schema.String.annotate({ title: 'Component Part' }),
  StateClassListSchema
)

/**
 * The styling an operator declares for ONE engine component type.
 *
 * Four fields, three of which are the same shape at different depths — parts,
 * then parts per variant, then parts per state — because that is the shape the
 * recipes already have. The fourth, `replace`, is the escape hatch.
 */
export const ComponentStyleSchema = Schema.Struct({
  /** Classes on each part of the component, in every variant and every state. */
  parts: Schema.optional(
    PartClassesSchema.pipe(
      Schema.annotate({
        title: 'Part Classes',
        description: 'Classes applied to each named part of the component',
        examples: [{ root: 'rounded-none tracking-tight' }],
      })
    )
  ),

  /**
   * Classes that apply only when the component is rendered in one named
   * variant — `default`, `destructive`, `outline`.
   *
   * The variant vocabulary is per-type and lives with the type (a `button` has
   * seven; a `divider` has none), so it is an open key here for the same reason
   * `parts` is: the domain cannot see it, and a plain string key drops nothing.
   */
  variants: Schema.optional(
    Schema.Record(
      Schema.String.annotate({
        title: 'Component Variant',
        description: "Name of one of the component type's declared variants",
        examples: ['default', 'destructive', 'outline'],
      }),
      PartClassesSchema
    ).pipe(
      Schema.annotate({
        title: 'Variant Classes',
        description: 'Per-part classes that apply only in the named variant',
        examples: [{ destructive: { root: 'border-2' } }],
      })
    )
  ),

  /**
   * Classes that apply only in one interaction state.
   *
   * Written WITHOUT the variant prefix — see {@link COMPONENT_STATE_VARIANTS}
   * for the closed vocabulary and the reason each name is or is not in it.
   */
  states: Schema.optional(
    Schema.Struct(
      Object.fromEntries(
        COMPONENT_STATES.map((state) => [
          state,
          Schema.optional(
            StatePartClassesSchema.annotate({ description: COMPONENT_STATE_DESCRIPTIONS[state] })
          ),
        ])
      ) as Record<ComponentState, Schema.optional<typeof StatePartClassesSchema>>
    ).pipe(
      Schema.annotate({
        title: 'State Classes',
        description:
          'Per-part classes that apply in one interaction state, written without the state prefix',
        examples: [{ hover: { root: 'bg-neutral-800' } }],
      })
    )
  ),

  /**
   * Drop Sovrium's own recipe for this type instead of layering on top of it.
   *
   * Defaults to `false`, which is the layering behaviour: the operator's
   * classes are merged over the recipe's, so `p-8` beats a recipe's `p-4` and
   * everything the operator did not mention is inherited.
   *
   * `true` is the honest escape hatch for the case layering cannot serve — a
   * component whose default look is wrong for this app in kind rather than in
   * degree. It drops the DEFAULTS only. The accessibility floor is applied
   * after the operator's classes either way and is not affected by this flag;
   * that is the whole reason the floor is a separate layer rather than part of
   * the recipe.
   */
  replace: Schema.optional(
    Schema.Boolean.annotate({
      title: 'Replace Defaults',
      description:
        "Drop Sovrium's recipe for this type rather than layering on top of it. The accessibility floor still applies.",
    })
  ),
}).pipe(
  Schema.annotate({
    identifier: 'ComponentStyle',
    title: 'Component Style',
    description:
      "Classes an operator adds to one engine component type: per part, per variant, per state, and whether to replace Sovrium's recipe or layer over it",
    examples: [
      {
        parts: { root: 'rounded-none tracking-tight' },
        variants: { destructive: { root: 'border-2' } },
        states: { hover: { root: 'bg-neutral-800' } },
      },
    ],
  })
)

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

/** @public */
export type ComponentStyle = Schema.Schema.Type<typeof ComponentStyleSchema>
/** @public */
export type DesignComponents = Schema.Schema.Type<typeof DesignComponentsSchema>
