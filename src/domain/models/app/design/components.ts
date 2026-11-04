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
import { ENGINE_COMPONENT_TYPES, TEXT_ELEMENTS } from '../engine-component-types'
import { TailwindClassListSchema } from '../tailwind-class-list'
import { unknownComponentPartIssues, type ComponentPartName } from './component-parts'
import type { ComponentState } from '../component-style'
import type { EngineComponentType, TextElement } from '../engine-component-types'

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
 * Classes for every `text` drawn as one element, keyed by that element.
 *
 * Closed over the same tuple the `element` field reads, so `h7` is refused by
 * name and an editor completes the thirteen. Each value is one class list: a
 * `text` element IS the root, it has no inner parts to name.
 */
const TextElementClassesSchema = Schema.Struct(
  Object.fromEntries(
    TEXT_ELEMENTS.map((element) => [
      element,
      Schema.optional(
        TailwindClassListSchema.annotate({
          description: `Classes on every \`text\` drawn as a \`<${element}>\`.`,
        })
      ),
    ])
  ) as Record<TextElement, Schema.optional<typeof TailwindClassListSchema>>
).pipe(
  Schema.annotate({
    title: 'Element Classes',
    description:
      "Classes on every `text` drawn as one element, keyed by that element (`h2`, `p`, `code`). They layer after the type's `parts.root` and before the instance's variant, states and own classes. A `text` with no `element` is drawn as a `span`.",
    examples: [{ h2: 'mt-12 tracking-tight' }],
  })
)

/**
 * The styling of `design.components.text`: the shared fields, plus `elements`.
 *
 * Only `text` takes `elements` — every other type keeps
 * {@link ComponentStyleSchema}, where the key is unknown and refused.
 */
export const TextComponentStyleSchema = Schema.Struct({
  ...ComponentStyleSchema.fields,
  elements: Schema.optional(TextElementClassesSchema),
}).pipe(
  Schema.annotate({
    identifier: 'TextComponentStyle',
    title: 'Text Component Style',
    description:
      'Classes an operator adds to every `text`: per part, per variant, per state, per element drawn, and whether to replace the recipe or layer over it',
    examples: [{ parts: { root: 'leading-relaxed' }, elements: { h2: 'mt-12 tracking-tight' } }],
  })
)

/** @public */
export type TextComponentStyle = Schema.Schema.Type<typeof TextComponentStyleSchema>

/** The style schema each key of `design.components` takes. */
const styleSchemaOf = (type: EngineComponentType) =>
  type === 'text' ? TextComponentStyleSchema : ComponentStyleSchema

/**
 * Styling for the engine's own components, keyed by component type.
 *
 * A closed `Schema.Struct` over {@link ENGINE_COMPONENT_TYPES} — see the module
 * doc for why a `Schema.Record` is the wrong shape here and what it would cost.
 */
export const DesignComponentsSchema = Schema.Struct({
  ...(Object.fromEntries(
    ENGINE_COMPONENT_TYPES.map((type) => [type, Schema.optional(styleSchemaOf(type))])
  ) as Record<
    Exclude<EngineComponentType, 'text'>,
    Schema.optional<typeof ComponentStyleSchema>
  > & { readonly text: Schema.optional<typeof TextComponentStyleSchema> }),
  /**
   * Every markdown article: a markdown page and each article of a content
   * collection. Not an engine component type — no page tree draws a
   * `markdown` node — but the same shape a page's `markdown.classes` takes,
   * one layer under it: recipe < this < the page's own `markdown.classes`.
   */
  markdown: Schema.optional(ComponentStyleSchema),
  /**
   * The consent banner the engine draws when the app declares `consent`. Not a
   * component type either: no page places it, every page carries it. `root` is
   * its card; `title` and `description` its two lines of text; `action` every
   * one of its buttons at once, so a style can never make Accept easier to see
   * than Refuse. Where the banner sits stays the engine's.
   */
  'consent-banner': Schema.optional(ComponentStyleSchema),
}).pipe(
  Schema.annotate({
    identifier: 'DesignComponents',
    title: 'Component Styles',
    description:
      "Per-engine-type styling: the classes an operator adds to the components Sovrium draws. Keys are component types (`button`, `table`), not the app's own `components[]` names, which carry their styling on the template; `markdown` styles every markdown article, under a page's own `markdown.classes`; `consent-banner` styles the consent banner.",
    examples: [
      {
        button: {
          parts: { root: 'rounded-none' },
          states: { hover: { root: 'bg-neutral-800' } },
        },
      },
    ],
  }),
  // ANNOTATE BEFORE CHECK: a trailing `annotate` lands on the check, and the
  // published schema loses the struct's title and description.
  Schema.check(
    Schema.makeFilter((components: unknown) => {
      const issues = unknownComponentPartIssues(components)
      return issues.length === 0 ? undefined : issues
    })
  )
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

/**
 * The variant the outline's scroll-spy sets on the link to the section being
 * read: it marks that link `data-active="true"`.
 */
export const ACTIVE_SECTION_VARIANT = 'data-[active=true]'

/**
 * The parts that style the outline link to the section being read: the docs
 * layout's `tocLinkActive` and the `toc` component's `linkActive`. Their
 * classes are written WITHOUT the variant, like a state's, and the engine
 * applies {@link ACTIVE_SECTION_VARIANT} to every token.
 */
export const ACTIVE_SECTION_PARTS: readonly string[] = [
  'tocLinkActive',
  'linkActive',
] satisfies readonly (ComponentPartName<'markdown'> | ComponentPartName<'toc'>)[]

/**
 * Prefix every token of an active-section part with {@link ACTIVE_SECTION_VARIANT}.
 * The renderer and the CSS candidate harvest both go through it, so the class on
 * the element and the class in the stylesheet are the same string.
 *
 * @param classes - The unprefixed class list of the part, if any.
 * @returns The same list with the variant on every token.
 */
export const applyActiveSectionVariant = (classes: string | undefined): string =>
  (classes ?? '')
    .split(/\s+/)
    .filter((token) => token.length > 0)
    .map((token) => `${ACTIVE_SECTION_VARIANT}:${token}`)
    .join(' ')

/**
 * Every class token in one part map, flattened, each one passed through
 * `prefix` (a state's variant, or none). An active-section part also yields
 * its tokens under {@link ACTIVE_SECTION_VARIANT}, as the renderer writes them.
 */
const partMapTokens = (
  parts: unknown,
  prefix: (token: string) => string = (token) => token
): readonly string[] =>
  parts === null || typeof parts !== 'object'
    ? []
    : Object.entries(parts as Record<string, unknown>).flatMap(([part, classes]) => {
        if (typeof classes !== 'string') return []
        const tokens = classes
          .split(/\s+/)
          .filter((t) => t.length > 0)
          .map(prefix)
        return ACTIVE_SECTION_PARTS.includes(part)
          ? [...tokens, ...tokens.map((token) => applyActiveSectionVariant(token))]
          : tokens
      })

/**
 * Every Tailwind class an operator's `design.components` block will emit, as it
 * will be emitted — state entries carry their variant prefix, and an
 * active-section part carries {@link ACTIVE_SECTION_VARIANT}.
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
    const { parts, variants, states, elements } = style as {
      parts?: unknown
      variants?: unknown
      states?: unknown
      elements?: unknown
    }
    const variantTokens =
      variants === null || typeof variants !== 'object'
        ? []
        : Object.values(variants as Record<string, unknown>).flatMap((map) => partMapTokens(map))
    const stateTokens =
      states === null || typeof states !== 'object'
        ? []
        : Object.entries(states as Record<string, unknown>).flatMap(([state, parts_]) =>
            COMPONENT_STATES.includes(state as ComponentState)
              ? partMapTokens(parts_, (token) =>
                  applyComponentStateVariant(state as ComponentState, token)
                )
              : []
          )
    return [...partMapTokens(parts), ...partMapTokens(elements), ...variantTokens, ...stateTokens]
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
