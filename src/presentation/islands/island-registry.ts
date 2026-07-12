/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { lazy } from 'react'
import AdminAgentConversationsIsland from './admin/agents/admin-agent-conversations-island'
import SharedFilterSelectIsland from './admin/automations/shared-filter-select-island'
import AdminCommandPaletteIsland from './admin/command-palette/admin-command-palette-island'
import AdminSpaNavIsland from './admin/spa-nav/admin-spa-nav-island'
import AiChatIsland from './ai-chat-island'
import AuthFormIsland from './auth-form/auth-form-island'
import CrudFormIsland from './crud-form-island'
import DatePickerIsland from './date-picker/date-picker-island'
import TabsIsland from './disclosure/tabs-island'
import FileUploadIsland from './file-upload/file-upload-island'
import NumberInputIsland from './form-controls/number-input-island'
import SplitPaneIsland from './layout/split-pane-island'
import RecordDrawerIsland from './overlays/record-drawer-island'
import PageRecordSystemIsland from './pages/page-record-system-island'

export const ISLANDS: Record<string, React.ComponentType<any>> = {
  'data-table': lazy(() => import('./data-table/island')),
  'split-pane': SplitPaneIsland,
  kanban: lazy(() => import('./kanban/kanban-island')),
  calendar: lazy(() => import('./calendar/calendar-island')),
  gallery: lazy(() => import('./gallery/gallery-island')),
  chart: lazy(() => import('./chart/chart-island')),
  kpi: lazy(() => import('./kpi/kpi-island')),
  'data-timeline': lazy(() => import('./timeline/timeline-island')),
  list: lazy(() => import('./list/list-island')),
  'record-field-system': lazy(() => import('./record-field/record-field-system-island')),
  'page-record-system': PageRecordSystemIsland,
  'search-list': lazy(() => import('./search/search-list-island')),
  'auth-form': AuthFormIsland,
  'crud-form': CrudFormIsland,
  'ai-chat': AiChatIsland,

  dialog: lazy(() => import('./overlays/dialog-island')),
  'alert-dialog': lazy(() => import('./overlays/dialog-island')),
  select: lazy(() => import('./select/select-island')),
  dropdown: lazy(() => import('./select/select-island')),
  accordion: lazy(() => import('./disclosure/accordion-island')),
  tabs: TabsIsland,
  checkbox: lazy(() => import('./form-controls/checkbox-island')),
  'radio-group': lazy(() => import('./form-controls/radio-island')),
  switch: lazy(() => import('./form-controls/switch-island')),
  tooltip: lazy(() => import('./overlays/tooltip-island')),
  popover: lazy(() => import('./overlays/popover-island')),
  'hover-card': lazy(() => import('./overlays/hover-card-island')),
  drawer: lazy(() => import('./overlays/drawer-island')),
  'record-drawer': RecordDrawerIsland,
  'dropdown-menu': lazy(() => import('./overlays/menu-island')),
  'context-menu': lazy(() => import('./overlays/menu-island')),
  slider: lazy(() => import('./form-controls/slider-island')),
  toggle: lazy(() => import('./form-controls/toggle-island')),
  'toggle-group': lazy(() => import('./form-controls/toggle-group-island')),
  menubar: lazy(() => import('./overlays/menubar-island')),
  'navigation-menu': lazy(() => import('./overlays/nav-menu-island')),
  'scroll-area': lazy(() => import('./overlays/scroll-area-island')),
  'presence-indicator': lazy(() => import('./presence-indicator-island')),
  'admin-sidebar': lazy(() => import('./admin/sidebar/admin-sidebar-island')),
  'shared-filter-select': SharedFilterSelectIsland,
  'admin-spa-nav': AdminSpaNavIsland,
  'admin-search-palette': AdminCommandPaletteIsland,
  'admin-agent-conversations': AdminAgentConversationsIsland,
  'file-upload': FileUploadIsland,
  'number-input': NumberInputIsland,
  'date-picker': DatePickerIsland,
  'page-search': lazy(() => import('./search/page-search-island')),
  comments: lazy(() => import('./comments/comment-thread-island')),
  'comment-count': lazy(() => import('./comments/comment-count-island')),
  'schema-json-editor': lazy(() => import('./schema-editor/schema-json-editor-island')),
  'schema-yaml-editor': lazy(() => import('./schema-editor/schema-yaml-editor-island')),
  'schema-form-editor': lazy(() => import('./schema-editor/schema-form-editor-island')),
  'schema-ai-agent': lazy(() => import('./schema-editor/schema-ai-agent-island')),
}

