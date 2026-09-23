/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import calendarBody from '@/domain/models/app/pages/components/component-types/data/calendar/calendar.docs.md' with { type: 'file' }
import chartBody from '@/domain/models/app/pages/components/component-types/data/chart/chart.docs.md' with { type: 'file' }
import dataFormBody from '@/domain/models/app/pages/components/component-types/data/form/form.docs.md' with { type: 'file' }
import galleryBody from '@/domain/models/app/pages/components/component-types/data/gallery/gallery.docs.md' with { type: 'file' }
import graphBody from '@/domain/models/app/pages/components/component-types/data/graph/graph.docs.md' with { type: 'file' }
import kanbanBody from '@/domain/models/app/pages/components/component-types/data/kanban/kanban.docs.md' with { type: 'file' }
import kpiBody from '@/domain/models/app/pages/components/component-types/data/kpi/kpi.docs.md' with { type: 'file' }
import dataListBody from '@/domain/models/app/pages/components/component-types/data/list/list.docs.md' with { type: 'file' }
import matrixBody from '@/domain/models/app/pages/components/component-types/data/matrix/matrix.docs.md' with { type: 'file' }
import gridEditingBody from '@/domain/models/app/pages/components/component-types/data/table/grid-editing.docs.md' with { type: 'file' }
import dataTableBody from '@/domain/models/app/pages/components/component-types/data/table/table.docs.md' with { type: 'file' }
import { componentType } from './component-directives'
import { defineArticle, defineSection } from './define'

/**
 * Data Components — the section manifest.
 *
 * Every `body` is imported `with { type: 'file' }`, so the value is a PATH and
 * the prose is never loaded until something reads it.
 *
 * `documents` is positional: its Nth entry is what the fragment's Nth
 * `sovrium:options` directive expands. Most sections fill it with imported
 * schemas, so deleting one fails `tsc` here. A component type cannot be
 * imported — it is a field bag rather than an exported schema — so its entry is
 * {@link componentType}, which throws on a name the catalogue does not hold.
 * `docs-structure.test.ts` asserts the round trip over all ninety names.
 */
export const section = defineSection({
  slug: 'data-components',
  title: 'Data Components',
  order: 3400,
  tab: 'pages',
  articles: [
    defineArticle({
      slug: 'data-components',
      title: 'Tables & Filter Bars',
      description:
        'The data grid — columns, selection, bulk actions, grouping and summaries — plus the filter-bar that narrows it and everything else listening on the same channel.',
      keywords: ['sovrium', 'data table', 'columns', 'selection', 'bulkActions', 'groupBy'],
      order: 3400,
      sidebarLabel: 'Tables & Filters',
      body: dataTableBody,
      documents: [componentType('table'), componentType('filter-bar')],
      stories: [
        'US-DESIGN-SYSTEM-COMPONENT-TYPES-DATA-FILTER-BAR',
        'US-PAGES-ACCESS-ACTION-CAPABILITY-GATE',
        'US-PAGES-DATA-COMPONENTS-COLUMN-FORMAT-BYTES',
        'US-PAGES-DATA-COMPONENTS-DATA-TABLE-001',
        'US-PAGES-DATA-COMPONENTS-DATA-TABLE-003',
        'US-PAGES-DATA-COMPONENTS-DATA-TABLE-AI-STATUS',
        'US-PAGES-DATA-COMPONENTS-DATA-TABLE-DISPLAY-CONFIG',
        'US-PAGES-DATA-COMPONENTS-DATA-TABLE-GROUP-SUMMARY',
        'US-PAGES-DATA-COMPONENTS-DATA-TABLE-NESTED-GROUP',
        'US-PAGES-DATA-COMPONENTS-DATA-TABLE-NO-MATCH',
        'US-PAGES-DATA-COMPONENTS-DATA-TABLE-OAUTH-ACTION',
        'US-PAGES-DATA-COMPONENTS-DATA-TABLE-RECORD-PICKER',
        'US-PAGES-DATA-COMPONENTS-DATA-TABLE-RELATIVE-TIME',
        'US-PAGES-DATA-COMPONENTS-DATA-TABLE-ROW-EXPAND',
        'US-PAGES-DATA-COMPONENTS-DATA-TABLE-SERVER-SEARCH',
        'US-PAGES-DATA-COMPONENTS-DATA-TABLE-SUMMARY',
        'US-PAGES-DATA-COMPONENTS-DATA-TABLE-TOOLBAR-CREATE',
        'US-PAGES-DATA-COMPONENTS-DATA-TABLE-VALUE-LABELS',
        'US-PAGES-DATA-COMPONENTS-DATA-TABLE-VISIBLE-WHEN',
        'US-PAGES-DATA-COMPONENTS-RUNTIME-VIEWS-001',
        'US-PAGES-DATA-COMPONENTS-RUNTIME-VIEWS-002',
        'US-PAGES-DATA-COMPONENTS-RUNTIME-VIEWS-003',
        'US-PAGES-DATA-COMPONENTS-RUNTIME-VIEWS-004',
        'US-PAGES-DATA-COMPONENTS-RUNTIME-VIEWS-005',
        'US-PAGES-DATA-COMPONENTS-RUNTIME-VIEWS-006',
        'US-PAGES-DATA-COMPONENTS-RUNTIME-VIEWS-007',
        'US-PAGES-DATA-COMPONENTS-RUNTIME-VIEWS-008',
        'US-PAGES-DATA-COMPONENTS-RUNTIME-VIEWS-009',
        'US-PAGES-DATA-COMPONENTS-RUNTIME-VIEWS-010',
        'US-PAGES-DATA-COMPONENTS-RUNTIME-VIEWS-011',
        'US-PAGES-DATA-COMPONENTS-RUNTIME-VIEWS-012',
        'US-PAGES-DATA-COMPONENTS-RUNTIME-VIEWS-013',
        'US-PAGES-DATA-COMPONENTS-RUNTIME-VIEWS-014',
        'US-PAGES-DATA-COMPONENTS-SELECT-PUBLISHES',
      ],
    }),
    defineArticle({
      slug: 'data-components-grid-editing',
      title: 'Working in the Grid',
      description:
        'What a table with editable columns does without being configured — the cell cursor, ranges and the fill handle, the trailing row that creates records, and live refresh.',
      keywords: [
        'sovrium',
        'data table',
        'inline editing',
        'cell editor',
        'fill handle',
        'keyboard navigation',
      ],
      order: 3401,
      sidebarLabel: 'Working in the Grid',
      body: gridEditingBody,
      documents: [],
      stories: [
        'US-PAGES-DATA-COMPONENTS-DATA-TABLE-ADD-ROW',
        'US-PAGES-DATA-COMPONENTS-DATA-TABLE-CELL-EDITORS',
        'US-PAGES-DATA-COMPONENTS-DATA-TABLE-CELL-RENDERERS',
        'US-PAGES-DATA-COMPONENTS-DATA-TABLE-FILL-HANDLE',
        'US-PAGES-DATA-COMPONENTS-DATA-TABLE-GROUPED-EDITING',
        'US-PAGES-DATA-COMPONENTS-DATA-TABLE-INLINE-SELECT-EDIT',
        'US-PAGES-DATA-COMPONENTS-DATA-TABLE-KEYBOARD-NAV',
        'US-PAGES-DATA-COMPONENTS-DATA-TABLE-LIVE-REFRESH',
        'US-PAGES-INTERACTIVITY-AUTO-SAVE-004',
        'US-PAGES-INTERACTIVITY-AUTO-SAVE-006',
        'US-PAGES-INTERACTIVITY-CLIPBOARD-OPERATIONS-001',
        'US-PAGES-INTERACTIVITY-CLIPBOARD-OPERATIONS-002',
      ],
    }),
    defineArticle({
      slug: 'data-components-lists',
      title: 'Lists',
      description:
        'The list component — a vertical run of records drawn from a per-record template, with Load More paging.',
      keywords: ['sovrium', 'list', 'listDisplay', 'itemTemplate', 'loadMore', 'maxItems'],
      order: 3402,
      sidebarLabel: 'Lists',
      body: dataListBody,
      documents: [componentType('list')],
      stories: [],
    }),
    defineArticle({
      slug: 'data-components-boards',
      title: 'Kanban Boards',
      description:
        'The kanban component — records grouped into columns by a field value, with drag-and-drop between them — and the colour rules the record views share.',
      keywords: ['sovrium', 'gallery', 'masonry', 'kanban', 'swimlanes', 'drag and drop'],
      order: 3404,
      sidebarLabel: 'Kanban',
      body: kanbanBody,
      documents: [componentType('kanban')],
      stories: [
        'US-DESIGN-SYSTEM-COMPONENT-TYPES-DATA-GAPS',
        'US-PAGES-DATA-COMPONENTS-CSV-IMPORT-EXPORT-001',
        'US-PAGES-DATA-COMPONENTS-CSV-IMPORT-EXPORT-002',
        'US-PAGES-DATA-COMPONENTS-DATA-KANBAN',
        'US-PAGES-DATA-COMPONENTS-DATA-KANBAN-COLORED-SELECT-GROUP-BY',
        'US-PAGES-DATA-COMPONENTS-DATA-KANBAN-SWIMLANES',
        'US-PAGES-DATA-COMPONENTS-DATA-KANBAN-SYSTEM-READ-ENDPOINT-DATA-SOURCE',
        'US-PAGES-DATA-COMPONENTS-DATA-TABLE-OPTION-COLORS',
        'US-PAGES-DATA-COMPONENTS-RECORD-DETAIL-VIEW-004',
      ],
    }),
    defineArticle({
      slug: 'data-components-galleries',
      title: 'Galleries',
      description:
        'The gallery component — a responsive card grid over records, in a uniform grid, a masonry wall or a carousel.',
      keywords: ['sovrium', 'gallery', 'card grid', 'masonry', 'carousel', 'gridColumns'],
      order: 3406,
      sidebarLabel: 'Galleries',
      body: galleryBody,
      documents: [componentType('gallery')],
      stories: [
        'US-PAGES-DATA-COMPONENTS-DATA-GALLERY',
        'US-PAGES-DATA-COMPONENTS-DATA-GALLERY-SYSTEM-READ-ENDPOINT-DATA-SOURCE',
      ],
    }),
    defineArticle({
      slug: 'data-components-calendars',
      title: 'Calendars',
      description: 'The calendar component — a month, week or day view of date-bearing records.',
      keywords: ['sovrium', 'calendar', 'dateField', 'endDateField', 'defaultView', 'month'],
      order: 3407,
      sidebarLabel: 'Calendars',
      body: calendarBody,
      documents: [componentType('calendar')],
      stories: [
        'US-PAGES-DATA-COMPONENTS-DATA-CALENDAR',
        'US-PAGES-DATA-COMPONENTS-DATA-CALENDAR-SYSTEM-READ-ENDPOINT-DATA-SOURCE',
      ],
    }),
    defineArticle({
      slug: 'data-components-charts',
      title: 'Charts',
      description:
        'The chart component — six chart types over an aggregate of records, with series, axes, a legend and a tooltip.',
      keywords: ['sovrium', 'chart', 'chartType', 'bar', 'line', 'pie'],
      order: 3408,
      sidebarLabel: 'Charts',
      body: chartBody,
      documents: [componentType('chart')],
      stories: [
        'US-PAGES-ACCESSIBILITY',
        'US-PAGES-DATA-COMPONENTS-DATA-CHART-001',
        'US-PAGES-DATA-COMPONENTS-DATA-CHART-002',
        'US-PAGES-DATA-COMPONENTS-DATA-CHART-003',
        'US-PAGES-DATA-COMPONENTS-DATA-CHART-004',
        'US-PAGES-DATA-COMPONENTS-DATA-CHART-005',
        'US-PAGES-DATA-COMPONENTS-DATA-CHART-ACCESSIBLE-NAME',
        'US-PAGES-DATA-COMPONENTS-DATA-CHART-EMPTY-STATE-REGION',
        'US-PAGES-DATA-COMPONENTS-DATA-CHART-SHAPES',
      ],
    }),
    defineArticle({
      slug: 'data-components-kpis',
      title: 'KPI Cards',
      description:
        'The kpi component — a single summary metric, with an optional comparison, sparkline and thresholds.',
      keywords: ['sovrium', 'kpi', 'stat card', 'metric', 'kpiAggregate', 'kpiFormat'],
      order: 3410,
      sidebarLabel: 'KPI Cards',
      body: kpiBody,
      documents: [componentType('kpi')],
      stories: [
        'US-PAGES-DATA-COMPONENTS-DATA-KPI-001',
        'US-PAGES-DATA-COMPONENTS-DATA-KPI-002',
        'US-PAGES-DATA-COMPONENTS-DATA-KPI-003',
      ],
    }),
    defineArticle({
      slug: 'data-components-matrix',
      title: 'The Matrix Grid',
      description:
        'The matrix component — two sets of graph nodes crossed into a grid whose cells are glyphs, with its accessible twin.',
      keywords: ['sovrium', 'matrix', 'graph', 'nodes', 'edges', 'glyph'],
      order: 3412,
      sidebarLabel: 'Matrix',
      body: matrixBody,
      documents: [componentType('matrix')],
      stories: [
        'US-PAGES-DATA-COMPONENTS-DATA-MATRIX-ACCESSIBLE-TWIN',
        'US-PAGES-DATA-COMPONENTS-DATA-MATRIX-CELL-GLYPHS',
        'US-PAGES-DATA-COMPONENTS-DATA-MATRIX-EMPTY-AND-DEGRADED',
        'US-PAGES-DATA-COMPONENTS-DATA-MATRIX-GRID-RENDERING',
        'US-PAGES-DATA-COMPONENTS-DATA-MATRIX-SCHEMA-REFUSALS',
      ],
    }),
    defineArticle({
      slug: 'data-components-graph',
      title: 'The Graph Drawing',
      description:
        'The graph component — nodes laid out in ordered columns or in lanes of chained steps, with the edges running between them.',
      keywords: ['sovrium', 'graph', 'node-link', 'layered', 'lanes', 'stations'],
      order: 3414,
      sidebarLabel: 'Graph',
      body: graphBody,
      documents: [componentType('graph')],
      stories: [
        'US-PAGES-DATA-COMPONENTS-DATA-GRAPH-ACCESSIBLE-TWIN',
        'US-PAGES-DATA-COMPONENTS-DATA-GRAPH-COLUMN-RENDERING',
        'US-PAGES-DATA-COMPONENTS-DATA-GRAPH-EMPTY-AND-DEGRADED-READS',
        'US-PAGES-DATA-COMPONENTS-DATA-GRAPH-LANE-RENDERING',
        'US-PAGES-DATA-COMPONENTS-DATA-GRAPH-SCHEMA-REFUSALS',
        'US-PAGES-DATA-COMPONENTS-DATA-GRAPH-SELECTION-AND-REACH',
      ],
    }),
    defineArticle({
      slug: 'data-components-forms',
      title: 'The Form Component',
      description:
        'form — one type, two modes: table-bound writes through the records API, static submits to a declared form or to a URL of your own.',
      keywords: ['sovrium', 'form', 'dataSource', 'fields', 'fieldGroups', 'endpoint'],
      order: 3416,
      sidebarLabel: 'Form Component',
      body: dataFormBody,
      documents: [componentType('form')],
      stories: [
        'US-PAGES-AUTH-COMPONENTS',
        'US-PAGES-CRUD-COMPONENTS-001',
        'US-PAGES-CRUD-COMPONENTS-002',
        'US-PAGES-CRUD-COMPONENTS-003',
        'US-PAGES-CRUD-COMPONENTS-004',
        'US-PAGES-CRUD-COMPONENTS-005',
        'US-PAGES-CRUD-FORM-NATIVE-LABELS',
        'US-PAGES-DATA-COMPONENTS-DATA-FORM-001',
        'US-PAGES-DATA-COMPONENTS-DATA-FORM-002',
        'US-PAGES-DATA-COMPONENTS-DATA-FORM-003',
        'US-PAGES-DATA-COMPONENTS-DATA-FORM-004',
        'US-PAGES-DATA-COMPONENTS-DATA-FORM-005',
        'US-PAGES-DATA-COMPONENTS-DATA-FORM-006',
        'US-PAGES-DATA-COMPONENTS-DATA-FORM-007',
        'US-PAGES-DATA-COMPONENTS-DATA-FORM-008',
        'US-PAGES-DATA-COMPONENTS-DATA-FORM-009',
        'US-PAGES-DATA-COMPONENTS-DATA-FORM-010',
        'US-PAGES-DATA-COMPONENTS-DATA-FORM-CONDITIONAL-FIELDS-ADVANCED',
        'US-PAGES-DATA-COMPONENTS-DATA-FORM-CUSTOM-ENDPOINT-SUBMIT',
        'US-PAGES-DATA-COMPONENTS-DATA-FORM-FORMREF',
        'US-PAGES-DATA-COMPONENTS-DATA-FORM-WIZARD',
      ],
    }),
  ],
})
