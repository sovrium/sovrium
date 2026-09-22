/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Sovrium's OWN recipe for a component root, as far as this layer can quote it.
 *
 * ## Why the provenance surfaces need this at all
 *
 * `resolveClassProvenance` takes the recipe as an INPUT (`defaults`), because a
 * renderer already holds it: the button renderer computed
 * `computeButtonDefaultClasses(...)` two lines earlier. The design-system
 * console does not. It answers "why is this class on a `button`?" without
 * rendering one, so it has to obtain the recipe by NAME — and a chain that
 * omitted the recipe layer would tell an operator their `design.components`
 * block is the first thing applied, which is the one fact the chain exists to
 * correct.
 *
 * ## Two fidelities, and the split is a layering fact rather than a preference
 *
 * `input` / `textarea` report their WHOLE recipe, imported verbatim: the input
 * recipe already lives in this directory (`input-default-classes.ts`), so there
 * is nothing to copy and nothing to drift.
 *
 * `button` reports the STRUCTURAL HEAD of its recipe. Its recipe lives in
 * `ui/sections/renderers/element-renderers/recipes/`, which is a
 * `presentation-component` and therefore closed to a `presentation-util` — the
 * same boundary `component-floor.ts` hits, and it is answered the same way: the
 * string is re-composed here and pinned by a test that asserts it appears
 * VERBATIM in the real recipe's output, so a divergence fails a unit test
 * rather than publishing a class list the renderer never emitted.
 *
 * The HEAD specifically, and not an approximation of the whole: everything
 * after it in `filledClasses` varies with the instance's variant, size and
 * state, and a provenance read carries none of those. Quoting a
 * `variant`-dependent list under a `variant`-less query would be confidently
 * wrong, which is the failure class this whole surface exists to remove.
 *
 * ## Which types are here, and why not more
 *
 * The same boundary `component-floor.ts` draws, for the same reason: a type
 * belongs here when its recipe puts classes on the SAME element that receives
 * `className` — the component root. Every other engine type composes its recipe
 * onto inner parts that no `className` reaches, so a root entry for one would
 * be decoration. A type absent from the table contributes NO recipe layer to
 * the chain, which reads as "Sovrium declares nothing at the design layer for
 * this root" and is the honest answer.
 *
 * `swatch` is here for the same rule read the other way round: it had NO recipe
 * anywhere, and the root it would land on is the one `className` reaches, so
 * the recipe was written here and the renderer reads it back. See
 * {@link SWATCH_ROOT_RECIPE}.
 *
 * `link` is deliberately absent. Its recipe is the `link` BRANCH of the button
 * recipe (`linkClasses`), whose head differs from the filled one and which the
 * `link` engine type reaches through a separate anchor recipe — two shapes, no
 * single quotable head. It joins when the recipe consolidation gives it one.
 *
 * (Class strings are spelled here rather than described because they must be
 * verbatim; the build-time CSS candidate scan reads this file, and every token
 * below is already emitted by the recipe it replays, so nothing new enters the
 * compiled stylesheet.)
 */

import { computeInputDefaultClasses } from './input-default-classes'

/**
 * The invariant head of `computeButtonDefaultClasses`' filled branch.
 *
 * Pinned verbatim by `component-recipe-defaults.test.ts` against the real
 * recipe's output. Do not "tidy" the spacing: the test asserts containment of
 * this exact string.
 */
export const BUTTON_ROOT_RECIPE_HEAD =
  'inline-flex items-center justify-center gap-1.5 border font-medium whitespace-nowrap'

/**
 * The `swatch` root — a chip, the token's name, and whatever notations were
 * asked for, laid out in one row with a gap between them.
 *
 * ─── THE ONE ENTRY HERE THAT IS APPLIED RATHER THAN QUOTED ─────────────────
 *
 * Its three siblings REPLAY a recipe some renderer already emits. This one IS
 * the recipe: `colorSwatchComponent` (`render/registry/design-components.tsx`)
 * reads it back through {@link recipeClassesFor} and merges it onto the root —
 * the same element `className` lands on, which is the membership rule the
 * module note states, satisfied from the other direction. So there is nothing
 * to drift from: the quoted recipe and the applied one are one string.
 *
 * `swatch` had no recipe at all, and its root rendered a bare `<div class="">`
 * with three INLINE children inside it. Measured live on the console
 * 2026-09-16: the chip's right edge and the label's left edge both at x 561 —
 * the name glued to the colour, `gap: normal` computed, because nothing had
 * asked for a flex box in the first place.
 *
 * `flex-wrap` because the notations (`showHex` / `showOklch`) and the contrast
 * verdict are optional extras on that same row, and a swatch in a narrow column
 * should wrap them rather than overflow.
 */
export const SWATCH_ROOT_RECIPE = 'inline-flex flex-wrap items-center gap-2'

/** Per-engine-type recipe for the component ROOT. See the module note. */
const ROOT_RECIPE: Readonly<Record<string, string>> = {
  button: BUTTON_ROOT_RECIPE_HEAD,
  input: computeInputDefaultClasses(),
  swatch: SWATCH_ROOT_RECIPE,
  textarea: computeInputDefaultClasses(),
}

/** The engine types this module can quote a root recipe for, for tests. */
export const RECIPE_ROOT_TYPES: readonly string[] = Object.keys(ROOT_RECIPE)

/**
 * Sovrium's recipe for one engine type's root, or `''` when it has none here.
 *
 * Returns a string rather than `undefined` so callers concatenate without
 * branching; `resolveClasses` and `resolveClassProvenance` both treat `''` as
 * "no layer", so an absent type simply drops out of the chain.
 *
 * @param type - The engine component type.
 * @param part - Which part is being resolved. Only `root` has an answer here.
 * @returns The recipe class list for that part, or `''`.
 */
export const recipeClassesFor = (type: string, part = 'root'): string =>
  part === 'root' ? (ROOT_RECIPE[type] ?? '') : ''
