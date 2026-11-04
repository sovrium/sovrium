/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { joinPartButtonClasses } from './button-variant-classes'

/**
 * The solid destructive fill: the one red button the engine draws, kept for the
 * verb of a confirm whose action cannot be undone. Every other destructive
 * button is base-nova's tint.
 *
 * A module of its own rather than a row of the part-button variant table: that
 * table ships with every island drawing a button, and only the confirm gates
 * draw this one: the server-stamped gate of a standalone button, and a table row
 * action's dialog, which reaches it through
 * {@link solidifyDestructiveButtonClasses}. An island calling
 * {@link computeSolidDestructiveButtonClasses} would export the shared button
 * chunk's join helper to every island that mounts a button.
 */
export const PART_BUTTON_DESTRUCTIVE_SOLID =
  'border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40'

/** The className of a part's button drawn as the solid destructive fill, at the size string given. */
export const computeSolidDestructiveButtonClasses = (size: string): string =>
  joinPartButtonClasses(PART_BUTTON_DESTRUCTIVE_SOLID, size)

/** The tint's colour tokens: the translucent grounds and the destructive text. */
const TINT_COLOUR_TOKEN = /^(?:dark:)?(?:hover:)?bg-destructive\/\d+$|^text-destructive$/

/**
 * A part's destructive button turned from the tint to the solid fill, at whatever
 * size it was drawn: the tint's colour tokens are swapped for the fill's.
 *
 * What an island draws the fill with. Rebuilding the button from its base and size
 * strings would make the shared button chunk export them to every island that
 * mounts a button; starting from the tinted button the island already computes
 * costs those islands nothing.
 */
export const solidifyDestructiveButtonClasses = (tinted: string): string =>
  [
    ...tinted.split(' ').filter((token) => !TINT_COLOUR_TOKEN.test(token)),
    'bg-destructive text-destructive-foreground hover:bg-destructive/90',
  ].join(' ')
