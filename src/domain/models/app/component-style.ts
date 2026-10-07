/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The class-styling vocabulary shared by every scope that styles an engine
 * component: `design.components.<type>` (every instance of a type, app-wide),
 * a component node's own `classes` (one instance), and a markdown page's
 * `markdown.classes` (the reading frame the page draws).
 *
 * It lives in its own leaf module, apart from `components.ts`, for one
 * mechanical reason: `components.ts` imports the engine type list, which is
 * derived from the component union, and the union's shared `core` module is
 * one of the consumers of this file. Keeping the vocabulary here means a
 * component node can declare `classes` without an import cycle that would
 * leave the schema `undefined` at evaluation time.
 */

import { Schema } from 'effect'
import { TailwindClassListSchema } from './tailwind-class-list'

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
 * `current` came later and from the other direction: not a recipe census but a
 * template one. Most of the demo templates restyled the CURRENT
 * entry of their navigation through `[&_a[aria-current=page]]:` selectors,
 * because no state named it. The engine already marks that entry with
 * `aria-current="page"`, so the state is a pure cascade one like the others;
 * its variant is `aria-[current=page]`, written by the engine, never by the
 * author.
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
  current: 'aria-[current=page]',
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
  current:
    'Classes applied to the entry that points at the page being read — the current link of a sidebar, a navigation menu or a breadcrumb.',
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

/** @public */
export type ComponentStyle = Schema.Schema.Type<typeof ComponentStyleSchema>

/**
 * The same vocabulary, on ONE component instance.
 *
 * `props.className` reaches a component's root and nothing else, so restyling
 * an inner element of one instance — the links of a sidebar, the title of each
 * list row, the chip in a table cell — could only be written as an arbitrary
 * descendant selector on the root (`[&_a[aria-current=page]]:bg-x`). Those
 * selectors are keyed on markup the engine is free to change, and they were
 * the single largest source of brittle configuration in the shipped templates.
 *
 * This key names the part instead of the markup. Its layer sits between the
 * app-wide `design.components.<type>` and the instance's `props.className`:
 *
 *   recipe  <  design.components  <  classes  <  props.className  <  floor
 *
 * so an instance can depart from the app's look without a selector, and the
 * accessibility floor still applies after it. Part names are the type's own —
 * the same names `design.components.<type>.parts` takes.
 */
export const ComponentClassesSchema = ComponentStyleSchema.annotate({
  identifier: 'ComponentClasses',
  title: 'Component Classes',
  description:
    "Classes for this one component, keyed by the part they land on (`root`, and the type's own parts such as a sidebar's `link`), per variant and per state (`current`, `hover`, …). Layered over `design.components` for this type and under `props.className`; the accessibility floor still applies.",
  examples: [
    {
      parts: { link: 'h-8 rounded-md px-2.5 text-foreground-muted' },
      states: { current: { link: 'bg-primary-subtle font-medium' } },
    },
  ],
})

/** @public */
export type ComponentClasses = Schema.Schema.Type<typeof ComponentClassesSchema>
