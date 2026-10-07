/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The sentences and the parameter shape every library block repeats: kept
 * beside `block-kit.ts` so a block's prose has one source.
 */

/** A string parameter with its default — the shape every block's `params` repeats. */
export const stringParam = (
  name: string,
  description: string,
  defaultValue: string
): {
  readonly name: string
  readonly description: string
  readonly type: 'string'
  readonly default: string
} => ({
  name,
  description,
  type: 'string',
  default: defaultValue,
})

/** The note every block carries on how to place it. */
export const PLACE_NOTE =
  'The block is a reusable component. Place it on a page with `component: <name>` under the page `components` list.'

/** The note every block carries on colour. */
export const THEME_NOTE =
  'Colours come from the theme tokens, so the block follows your `theme` without edits.'

/** The note every data-bound block carries on the table it reads. */
export const DATA_NOTE =
  'The block reads a table you already have: `library add` refuses until your config declares it, and lists the table and fields it expects. Point it at your own names with `--set` on the table and field parameters.'
