/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { lazy } from 'react'

/**
 * The three non-grid view-type islands, bound ONCE as `React.lazy` components.
 *
 * Two consumers render them and both must resolve to the SAME dynamic import,
 * so the binding lives here rather than being duplicated at each call site:
 *
 *  - `island-registry.ts` — mounts them as standalone page components;
 *  - the data-table island's view switcher — renders one of them in place of
 *    the grid over the data-table's own (already filtered) rows.
 *
 * Keeping them lazy is load-bearing, not a preference. The universal island
 * payload is the bundle every island page downloads; a view switcher is exactly
 * the shape that re-eagerifies it, because rendering three view types is one
 * static import away from putting FullCalendar, @dnd-kit and the gallery grid
 * back on that path. `bun run lint` and `bun run typecheck` both pass while
 * that happens — only the E2E chunk-loading specs catch it.
 *
 * The dynamic-import specifier also fixes the emitted chunk name: the island
 * bundle is built with `naming: { chunk: '[name]-[hash].js' }`, so importing
 * `./kanban/kanban-island` is what makes the chunk `kanban-island-<hash>.js`.
 */
export const KanbanIslandLazy = lazy(() => import('./kanban/kanban-island'))
export const CalendarIslandLazy = lazy(() => import('./calendar/calendar-island'))
export const GalleryIslandLazy = lazy(() => import('./gallery/gallery-island'))
