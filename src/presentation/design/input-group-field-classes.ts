/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Adapted from shadcn/ui input-group (https://ui.shadcn.com), registry commit 30a58d4498f270af1c1e981a7d78a15cf5740841.
 * Copyright (c) 2023 shadcn. MIT License: licenses/MIT-shadcn-ui.txt
 */

/**
 * shadcn/ui `InputGroupInput`, alone in a leaf module.
 *
 * Same reason as `input-group-root-classes.ts`: a module several islands
 * import becomes a chunk shipping every export, and the addons beside the
 * field in `input-group-default-classes.ts` reach the button recipe. An island
 * drawing only the frame and the field (the tree's filter box) imports the two
 * leaves and pays for those two strings. `input-group-default-classes.ts`
 * re-exports it.
 */

/**
 * shadcn/ui `InputGroupInput`: the `Input` recipe with its own border and ring
 * taken off. `fit` gives it a fixed 4rem width in a group that hugs its content.
 */
export const computeInputGroupFieldClasses = ({
  fit = false,
}: { readonly fit?: boolean } = {}): string =>
  `h-8 ${fit ? 'w-16 flex-none' : 'w-full flex-1'} min-w-0 rounded-none border-0 bg-transparent px-2.5 py-1 text-base shadow-none ring-0 transition-colors outline-none placeholder:text-muted-foreground focus-visible:ring-0 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-transparent aria-invalid:ring-0 md:text-sm dark:bg-transparent dark:disabled:bg-transparent`
