/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { lazy } from 'react'
import AiChatIsland from './ai-chat-island'
import AuthFormIsland from './auth-form-island'
import CrudFormIsland from './crud-form-island'

export const ISLANDS: Record<string, React.ComponentType<any>> = {
  'data-table': lazy(() => import('./data-table/island')),
  kanban: lazy(() => import('./kanban-island')),
  calendar: lazy(() => import('./calendar-island')),
  gallery: lazy(() => import('./gallery-island')),
  chart: lazy(() => import('./chart-island')),
  kpi: lazy(() => import('./kpi-island')),
  'data-timeline': lazy(() => import('./timeline-island')),
  'search-list': lazy(() => import('./search-list-island')),
  'auth-form': AuthFormIsland,
  'crud-form': CrudFormIsland,
  'ai-chat': AiChatIsland,

  dialog: lazy(() => import('./dialog-island')),
  'alert-dialog': lazy(() => import('./dialog-island')),
  select: lazy(() => import('./select-island')),
  dropdown: lazy(() => import('./select-island')),
  accordion: lazy(() => import('./accordion-island')),
  tabs: lazy(() => import('./tabs-island')),
  checkbox: lazy(() => import('./checkbox-island')),
  'radio-group': lazy(() => import('./radio-island')),
  switch: lazy(() => import('./switch-island')),
  tooltip: lazy(() => import('./tooltip-island')),
  popover: lazy(() => import('./popover-island')),
  drawer: lazy(() => import('./drawer-island')),
  'dropdown-menu': lazy(() => import('./menu-island')),
  'context-menu': lazy(() => import('./menu-island')),
  slider: lazy(() => import('./slider-island')),
  toggle: lazy(() => import('./toggle-island')),
  'toggle-group': lazy(() => import('./toggle-group-island')),
  menubar: lazy(() => import('./menubar-island')),
  'navigation-menu': lazy(() => import('./nav-menu-island')),
  'scroll-area': lazy(() => import('./scroll-area-island')),
}

