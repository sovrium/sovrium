/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { lazy } from 'react'
import AuthFormIsland from './auth-form-island'
import CrudFormIsland from './crud-form-island'

/**
 * Island component registry — maps island type names to React components.
 *
 * Auth and CRUD form islands are eagerly imported to mount synchronously,
 * preventing native form submission from the SSR skeleton before React
 * takes over event handling. Data table and search list use React.lazy()
 * for code splitting since they don't have the same timing constraints.
 *
 * To add a new island type:
 * 1. Create the component in src/presentation/islands/
 * 2. Add an import entry here (lazy or eager)
 * 3. Add the SSR placeholder in island-components.tsx
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Island props vary by type
export const ISLANDS: Record<string, React.ComponentType<any>> = {
  'data-table': lazy(() => import('./data-table/island')),
  kanban: lazy(() => import('./kanban-island')),
  calendar: lazy(() => import('./calendar-island')),
  gallery: lazy(() => import('./gallery-island')),
  chart: lazy(() => import('./chart-island')),
  'search-list': lazy(() => import('./search-list-island')),
  'auth-form': AuthFormIsland,
  'crud-form': CrudFormIsland,

  // Base UI islands (lazy-loaded, code-split per component)
  // Phase 0
  dialog: lazy(() => import('./dialog-island')),
  'alert-dialog': lazy(() => import('./dialog-island')),
  // Phase 1 — Form Controls & Core
  select: lazy(() => import('./select-island')),
  dropdown: lazy(() => import('./select-island')), // Legacy alias for select
  accordion: lazy(() => import('./accordion-island')),
  tabs: lazy(() => import('./tabs-island')),
  checkbox: lazy(() => import('./checkbox-island')),
  'radio-group': lazy(() => import('./radio-island')),
  switch: lazy(() => import('./switch-island')),
  // Phase 2 — Overlays & Feedback
  tooltip: lazy(() => import('./tooltip-island')),
  popover: lazy(() => import('./popover-island')),
  drawer: lazy(() => import('./drawer-island')),
  'dropdown-menu': lazy(() => import('./menu-island')),
  'context-menu': lazy(() => import('./menu-island')), // Shares menu island
  slider: lazy(() => import('./slider-island')),
  toggle: lazy(() => import('./toggle-island')),
  'toggle-group': lazy(() => import('./toggle-group-island')),
  // Phase 3 — Navigation & Advanced
  menubar: lazy(() => import('./menubar-island')),
  'navigation-menu': lazy(() => import('./nav-menu-island')),
  'scroll-area': lazy(() => import('./scroll-area-island')),
}

// SSR's "which component types need a hydration script" set lives in
// `src/presentation/utils/island-component-types.ts` (a smaller subset
// of ISLANDS — not every registry entry triggers bundle building, only
// the ones that gate `<script src="islands.js">` emission). Don't add
// a parallel set here; the consolidated source of truth is upstream.
