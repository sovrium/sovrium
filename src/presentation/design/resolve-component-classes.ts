/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Reads `design.components[<type>]` and turns it into the two things a renderer
 * needs: a class string for the layer between the recipe and the author, and
 * the PROVENANCE of every class in the final list.
 *
 * ## The shape of the key, and what this file does with it
 *
 * `design.components.button` may carry `parts`, `variants`, `states` and
 * `replace`. Three of those are the same shape at different depths, so they
 * collapse into ONE class string per part:
 *
 *   parts.root                          -> `rounded-none`
 *   variants.destructive.root           -> `border-2`        (only when rendered
 *                                                             in that variant)
 *   states.hover.root                   -> `hover:bg-…`      (prefix added HERE)
 *
 * The state prefix is applied in this file and nowhere else. The schema refuses
 * a class list that already carries its own state prefix
 * (`COMPONENT_STATE_VARIANTS` in `domain/models/app/design/components.ts`)
 * precisely so this is the single place the mapping happens: `focusVisible`
 * becomes `focus-visible:`, and a token that already carries a responsive or
 * container prefix keeps it (`md:bg-x` under `hover` becomes `hover:md:bg-x`).
 *
 * ## Precedence
 *
 * The resolved string is layer 2 of {@link resolveClasses}' four:
 *
 *   recipe defaults  <  design.components  <  props.className  <  floor
 *
 * The operator's app-wide block loses to a per-instance `className` because the
 * author of that node is being specific; it beats the recipe because that is
 * the entire point of the key. `replace: true` drops the RECIPE only — the
 * floor is unaffected, which is why the floor is a separate layer rather than
 * part of the recipe an operator can replace.
 *
 * ## Why the floor is conditional on a declaration
 *
 * {@link resolveComponentStyle} returns an EMPTY floor when the app declares no
 * block for the type. That is a deliberate, measured scoping decision, not a
 * hole: with no declaration the recipe already emits its own focus block, so
 * replaying it would only reorder an app's class strings — and doing that
 * unconditionally would change the rendered HTML, the candidate corpus and the
 * cache key of every app that never opened this door. The floor exists to
 * backstop `design.components`, INCLUDING `replace: true`, which is exactly the
 * case where the recipe's own block is gone.
 *
 * Named consequence: an author who zeroes the focus ring through `className` on
 * a single node still wins today. Extending the floor over the author channel is
 * a behaviour change for existing apps and needs its own spec.
 *
 * (Ring classes are described rather than spelled throughout this file: the
 * build-time CSS candidate scan reads comments too, and a bare Tailwind-shaped
 * token in one becomes a rule in every app's stylesheet.)
 */

import {
  COMPONENT_STATE_VARIANTS,
  applyComponentStateVariant,
} from '@/domain/models/app/design/components'
import { componentFloorFor, componentPartFloorsFor } from './component-floor'
import { resolveClasses } from './resolve-classes'
import type { ComponentState, ComponentStyle, Design } from '@/domain/models/app/design'

/** Where one fragment of a resolved class list came from. */
export type ClassSource = 'default' | 'app' | 'floor'

/** One layer of a resolved class list, in precedence order. */
export interface ClassProvenanceEntry {
  readonly source: ClassSource
  readonly classes: string
}

/** Everything a renderer needs to apply one type's `design.components` block. */
export interface ComponentDesignResolution {
  /** `design.components[type].replace` — drop the recipe rather than layer on it. */
  readonly replace: boolean
  /** The operator's classes for the ROOT part, states and variants folded in. */
  readonly root: string
  /** The operator's classes for every NON-root part, keyed by part name. */
  readonly parts: Readonly<Record<string, string>>
  /** The non-overridable floor for the root. Empty when nothing is declared. */
  readonly floor: string
  /**
   * The non-overridable floor for each NON-root part that has one, keyed by
   * part name. Empty when nothing is declared, on the same terms as `floor`.
   *
   * Separate from `floor` rather than folded into it under a `root` key: the
   * root's floor travels to an island inside `className`, already merged
   * server-side, while these have to cross as their own serialised map because
   * the elements they land on do not exist until the island builds them.
   */
  readonly partFloors: Readonly<Record<string, string>>
}

const EMPTY_RESOLUTION: ComponentDesignResolution = {
  replace: false,
  root: '',
  parts: {},
  floor: '',
  partFloors: {},
}

/** Merge two part maps, appending rather than replacing on a shared part. */
const appendParts = (
  into: Record<string, string>,
  from: Readonly<Record<string, string>> | undefined
): Record<string, string> => {
  if (!from) return into
  return Object.entries(from).reduce<Record<string, string>>((accumulator, [part, classes]) => {
    const existing = accumulator[part]
    return { ...accumulator, [part]: existing ? `${existing} ${classes}` : classes }
  }, into)
}

/**
 * Collapse one type's block into a per-part class map.
 *
 * Order within a part is `parts` → `variants[<active>]` → `states[*]`, so a
 * state class is later than the base class it modifies and wins the merge on a
 * same-property conflict — which is what "the hover colour beats the resting
 * colour" has to mean.
 */
const collapseParts = (
  style: ComponentStyle,
  variant: string | undefined
): Readonly<Record<string, string>> => {
  const base = appendParts({}, style.parts as Readonly<Record<string, string>> | undefined)
  const withVariant = appendParts(
    base,
    variant === undefined
      ? undefined
      : (style.variants?.[variant] as Readonly<Record<string, string>> | undefined)
  )
  const states = style.states as
    Readonly<Record<string, Readonly<Record<string, string>> | undefined>> | undefined
  if (!states) return withVariant

  return Object.keys(COMPONENT_STATE_VARIANTS).reduce<Record<string, string>>(
    (accumulator, state) => {
      const partClasses = states[state]
      if (!partClasses) return accumulator
      return appendParts(
        accumulator,
        Object.fromEntries(
          Object.entries(partClasses).map(([part, classes]) => [
            part,
            applyComponentStateVariant(state as ComponentState, classes),
          ])
        )
      )
    },
    withVariant
  )
}

/**
 * Resolve one engine type's `design.components` block against the active
 * variant.
 *
 * @param design - The app's `design` key, if any.
 * @param type - The engine component type being rendered (`button`, `tabs`, …).
 * @param variant - The variant this instance renders in, if the type has one.
 * @returns The operator layer, the per-part map, `replace`, and the floor.
 */
export const resolveComponentStyle = (
  design: Design | undefined,
  type: string,
  variant?: string
): ComponentDesignResolution => {
  const style = (design?.components as Readonly<Record<string, ComponentStyle>> | undefined)?.[type]
  if (!style) return EMPTY_RESOLUTION

  const parts = collapseParts(style, variant)
  const { root = '', ...rest } = parts
  return {
    replace: style.replace === true,
    root,
    parts: rest,
    // The floor is armed by the DECLARATION, not by the type — see the module
    // doc. `replace: true` with an otherwise empty block still arms it, which
    // is the case that needs it most.
    floor: componentFloorFor(type),
    // Armed by the same declaration, and by the TYPE rather than by which parts
    // the operator happened to name: declaring `parts.list` on a select still
    // floors its trigger, exactly as declaring nothing about the root still
    // floors the root above. A floor that only appeared on parts the operator
    // touched would be absent from the config that removed the ring by
    // replacing the whole recipe.
    partFloors: componentPartFloorsFor(type),
  }
}

/** Arguments for {@link resolveComponentClasses} / {@link resolveClassProvenance}. */
export interface ResolveComponentClassesInput {
  readonly design?: Design
  readonly type: string
  readonly part?: string
  readonly variant?: string
  readonly author?: string
  readonly defaults?: string
}

/** The three layers of one part's class list, before merging. */
const layersFor = (
  input: ResolveComponentClassesInput
): { defaults: string; app: string; floor: string } => {
  const resolution = resolveComponentStyle(input.design, input.type, input.variant)
  const part = input.part ?? 'root'
  const isRoot = part === 'root'
  return {
    defaults: resolution.replace ? '' : (input.defaults ?? ''),
    app: isRoot ? resolution.root : (resolution.parts[part] ?? ''),
    // A named part carries its own floor when its type declares one; see the
    // entry rule on `PART_FLOOR` in `component-floor.ts` for why most parts
    // legitimately have none.
    floor: isRoot ? resolution.floor : (resolution.partFloors[part] ?? ''),
  }
}

/**
 * The merged, de-conflicted class list for one part of one engine component.
 *
 * @param input - The design key, the type, and this instance's own classes.
 * @returns The class string to put on the element.
 */
export const resolveComponentClasses = (input: ResolveComponentClassesInput): string => {
  const { defaults, app, floor } = layersFor(input)
  return resolveClasses(defaults, app, input.author, floor)
}

/**
 * The same resolution, reported layer by layer rather than merged.
 *
 * The design-system console renders this so an operator can see WHY a class is
 * or is not on the element — the question a merged string cannot answer. Layers
 * that contribute nothing are omitted rather than reported as empty.
 *
 * The author layer is deliberately absent from the vocabulary: provenance
 * answers "which of Sovrium's three layers put this here", and a per-instance
 * `className` is the author's own text, already visible in their config.
 *
 * @param input - The design key, the type, and this instance's own classes.
 * @returns One entry per contributing layer, in precedence order.
 */
export const resolveClassProvenance = (
  input: ResolveComponentClassesInput
): ReadonlyArray<ClassProvenanceEntry> => {
  const { defaults, app, floor } = layersFor(input)
  return (
    [
      { source: 'default' as const, classes: defaults },
      { source: 'app' as const, classes: app },
      { source: 'floor' as const, classes: floor },
    ] satisfies ReadonlyArray<ClassProvenanceEntry>
  ).filter((entry) => entry.classes.length > 0)
}
