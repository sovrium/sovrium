/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The stepper rail's three states, painted from the rail entry's own
 * `data-state` (`done` / `current` / `todo`) — the attribute the enhancement
 * island moves from step to step, so the look follows without a re-render.
 *
 *  - done:    the number sits in a filled disc
 *  - current: the number is ringed (2 px) and the label is bold
 *  - todo:    plain — an outlined number, a regular label
 */

/** The rail entry: the `group` the marker and the label read their state from. */
export const STEPPER_RAIL_ITEM = 'group flex items-start gap-2'

/** The step number's disc. */
export const STEPPER_MARKER = [
  'flex size-7 shrink-0 items-center justify-center rounded-full border border-border font-mono text-xs',
  'group-data-[state=done]:border-foreground group-data-[state=done]:bg-foreground group-data-[state=done]:text-background',
  'group-data-[state=current]:border-foreground group-data-[state=current]:ring-2 group-data-[state=current]:ring-foreground group-data-[state=current]:ring-offset-2 group-data-[state=current]:ring-offset-background',
].join(' ')

/** The step's name. */
export const STEPPER_LABEL = 'text-sm group-data-[state=current]:font-semibold'
