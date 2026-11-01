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
 * table ships with every island drawing a button, and only the server-stamped
 * confirm gate draws this one. An island reaching it would export the shared
 * button chunk's join helper to every island that mounts a button.
 */
export const PART_BUTTON_DESTRUCTIVE_SOLID =
  'border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40'

/** The className of a part's button drawn as the solid destructive fill, at the size string given. */
export const computeSolidDestructiveButtonClasses = (size: string): string =>
  joinPartButtonClasses(PART_BUTTON_DESTRUCTIVE_SOLID, size)
