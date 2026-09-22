/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `resolveClasses()` — the SINGLE class-merge primitive for the three layers a
 * rendered element's class list is built from.
 *
 * Before this existed, every merge site in `src/presentation/` joined its
 * fragments with a template literal or `Array.join(' ')`, which leaves BOTH
 * classes of a conflicting pair in the list and lets CSS source order decide
 * the winner. That is not a decision the renderer controls: Tailwind v4 emits
 * utilities in ITS own order, not in the order a renderer concatenated them, so
 * an author's `p-8` did not reliably beat a recipe's `p-4`. Routing every site
 * through `cn` (tailwind-merge) makes the LAST fragment of a conflict group win
 * and DROPS the loser, so the outcome is decided here rather than by the
 * stylesheet.
 *
 * FOUR layers, lowest precedence first:
 *
 * 1. `defaults` — the recipe (`computeButtonClasses()`, `computeCardClasses()`,
 *    …). What the component looks like when the author says nothing.
 * 2. `app`      — `design.components[<type>]`, the operator's app-wide styling
 *    for every instance of one engine component type. Beats the recipe; loses
 *    to the author, who is being specific about ONE node.
 * 3. `author`   — the app author's `className` on a component instance. Beats
 *    the recipe and the app-wide block on any same-property conflict.
 * 4. `floor`    — non-negotiable classes neither the operator nor the author
 *    may drop: the focus-visible ring above all. Applied LAST so it wins.
 *
 * Written as a NEST rather than as one flat `cn(defaults, app, author, floor)`
 * deliberately: each nesting collapses everything below it into a settled
 * string BEFORE the next layer is applied, so a floor class can never be
 * dropped by an author class that merely sits later in the same argument list.
 * With `tailwind-merge`'s last-wins rule the flat form happens to agree today,
 * but the nested form states the precedence structurally.
 *
 * NOTE — it reuses `cn` from `./class-merge` and must keep doing so. A second
 * `extendTailwindMerge` instance would be a second source of truth for which
 * classes conflict, which is the exact bug `class-merge.ts` was written to
 * prevent (see its header). Presentation layer, not domain: the domain may not
 * import `tailwind-merge`.
 */

import { cn } from './class-merge'

/**
 * Resolve a rendered element's class list from its three precedence layers.
 *
 * Conflicts are resolved by `tailwind-merge`, so `floor` beats `author` beats
 * `defaults` on any shared property; non-conflicting classes from every layer
 * all survive. Unknown (non-Tailwind) tokens — including the legacy `.btn` /
 * `.btn-primary` component-layer classes — pass through untouched, so
 * `variantFromButtonClassName` can still read them out of the merged string.
 *
 * @param defaults - The recipe classes. Lowest precedence.
 * @param app - `design.components[<type>]` classes, if any. Beats `defaults`.
 * @param author - The app author's `className`, if any. Beats `app`.
 * @param floor - Non-negotiable classes. Beats `author`.
 * @returns The merged, de-conflicted class string.
 */
export const resolveClasses = (
  defaults: string,
  app?: string,
  author?: string,
  floor?: string
): string => cn(cn(cn(defaults, app), author), floor)
