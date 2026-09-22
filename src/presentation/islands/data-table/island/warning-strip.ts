/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The warning strip above the grid: a full-width band that names a changed
 * condition — a save conflict, an overwritten edit, a stalled live
 * connection, a fill the grid had to leave partly undone.
 *
 * One string for the four strips, so they cannot drift apart a token at a
 * time. A caller that needs layout on top (the fill refusals put a dismiss
 * button on the right) appends its own classes after this one.
 *
 * It KEEPS the warning tone while the rest of the grid's chrome gives colour
 * up: a stalled live connection and an overwritten edit ARE failures, and they
 * are exactly what the reserved signal is reserved for. What moves is the
 * geometry — `px-2 py-1.5` at 12px, the same step every other bar above and
 * below the rows now spends, so a strip no longer arrives taller and louder
 * than the toolbar it appears under.
 */
export const WARNING_STRIP_CLASS =
  'border-warning-border bg-warning-bg text-warning-fg border-b px-2 py-1.5 text-sm'
