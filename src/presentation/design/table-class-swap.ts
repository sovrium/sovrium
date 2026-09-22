/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * One token-exact class swap, shared by the three grid recipes that need it.
 *
 * It sits in its own module, and NOT under a `-default-classes.ts` name,
 * because both facts are decisions rather than accidents. Three of the split
 * recipes take the shared button recipe and change exactly one of its classes —
 * `table-toolbar-default-classes.ts` (the active fill),
 * `table-pager-default-classes.ts` (28px to 26px) and
 * `table-panel-default-classes.ts` (the row-action button's height, padding and
 * type step). Putting it in whichever of the three is read first would make the
 * other two import a toolbar module to shrink a button, which is a dependency
 * that says something false about the code. And the `-default-classes.ts`
 * suffix is what `arbitrary-var-safelist.ts` collects files by: this module
 * holds no `v(…)` site and publishes no class string, so wearing that suffix
 * would claim a role it does not have. `class-merge.ts` and `table-type-classes.ts`
 * next door are the same shape.
 */

/**
 * Swap ONE known utility out of another recipe's output, by exact token.
 *
 * Three of the grid's computers take the shared button recipe and change
 * exactly one of its classes: the toolbar button replaces its resting fill when
 * a control is active, the pager button shrinks 28px to 26px, and the row
 * action button shrinks height, padding and type step. Each is a
 * SAME-PROPERTY conflict, so appending the replacement is not enough —
 * concatenation leaves both classes in the list and lets Tailwind's own
 * emission order pick the winner, which is not a decision this file controls.
 *
 * ## Why not `cn` (tailwind-merge), which does exactly this
 * Because it costs 29.4 KB in the client bundle, and the grid recipes are
 * imported by an island that needs none of it. Measured: routing `filter-bar` through the
 * shared chip recipe dragged tailwind-merge into its chunk and took its mount
 * cost from 13.7 KB to 47.0 KB — a 3.4x jump on an island whose small size its
 * own docstring calls load-bearing, to reconcile three class strings. The
 * `Island Payload Budget` gate caught it.
 *
 * A whole-token comparison rather than `String.replace`, which would match
 * `h-7` inside `h-72`. The assumption that the token being replaced is present
 * at all is pinned by tests: if the button recipe ever renames its resting
 * fill, the swap becomes a silent no-op and an active control paints as a
 * resting one, so `table-toolbar-default-classes.test.ts` asserts the target
 * exists rather than only asserting the result.
 */
export const swapUtility = (classes: string, from: string, to: string): string =>
  classes
    .split(' ')
    .map((token) => (token === from ? to : token))
    .join(' ')
