/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { asComponent, param, PLACE_NOTE, THEME_NOTE, when } from '@/library/manifest/block-kit'
import { stringParam } from '@/library/manifest/block-notes'
import { defineLibraryEntry } from '@/library/manifest/define'
import { labelOf } from '@/library/manifest/field-labels'

type P = (key: string) => string
type Node = Readonly<Record<string, unknown>>

/**
 * The record a table holds, in words, for the New button: `projects` reads
 * "project", `companies` reads "company". Only the plural endings an English
 * table name takes; anything else is left as written.
 */
const singularOf = (table: string): string => {
  const words = table.replace(/[_-]+/g, ' ').trim().toLowerCase()
  if (words.endsWith('ies')) return `${words.slice(0, -3)}y`
  if (/(ss|us)$/.test(words)) return words
  if (words.endsWith('s')) return words.slice(0, -1)
  return words
}

/** The New button's words: the `newLabel` parameter, else "New <record>". */
const newLabelOf = (p: P): string =>
  p('newLabel').trim() === '' ? `New ${singularOf(p('table'))}` : p('newLabel')

/**
 * The search box: what the reader types is published as `q` on the channel,
 * which every data component subscribed to it sends to the records API.
 */
const searchBox = (p: P): Node => ({
  type: 'search-input',
  placeholder: p('searchPlaceholder'),
  props: {
    'aria-label': p('searchLabel').trim() === '' ? p('searchPlaceholder') : p('searchLabel'),
    className: 'h-8 w-full sm:w-[150px] lg:w-[250px]',
  },
  publishes: { bindTo: p('channel'), param: 'q' },
})

/**
 * The facet: one choice field's declared options, several at once. Each pick
 * adds the field to the channel as one `in` condition, combined with the
 * search and the filter bar.
 */
const facet = (p: P): Node => ({
  type: 'select',
  // The field's name is the trigger's words and its accessible name, not a
  // caption above it: a caption would push the control out of the 40 px row.
  props: {
    placeholder: labelOf(p, 'facetLabel', 'facetField'),
    'aria-label': labelOf(p, 'facetLabel', 'facetField'),
    className: 'h-8 w-auto',
  },
  multiple: true,
  optionsFrom: { table: p('table'), field: p('facetField') },
  publishes: { bindTo: p('channel'), field: p('facetField'), operator: 'in' },
})

/** The filter bar: any field of the table, any condition, as chips. */
const filterBar = (p: P): Node => ({
  type: 'filter-bar',
  publishes: { bindTo: p('channel') },
  fieldsFrom: { table: p('table') },
})

/**
 * One button at the toolbar's height. No icon: a button whose words come from
 * `label` is drawn without the flex row an icon beside its words needs.
 */
const toolbarButton = (label: string, action: Node, variant = 'outline'): Node => ({
  type: 'button',
  label,
  variant,
  size: 'sm',
  action,
})

/** The Export CSV button: a download of the table as the reader may read it. */
const exportButton = (p: P): Node =>
  toolbarButton(p('exportLabel'), {
    type: 'fetch',
    mode: 'download',
    url: `/api/tables/${p('table')}/export?format=csv`,
    filename: `${p('table')}.csv`,
  })

/**
 * Export CSV, held back on an empty table when `hideExportWhenEmpty` is set: a
 * box bound to the table's first record draws the button once per row, so an
 * empty table — or a read that fails — draws none, and the page still renders.
 * `contents` keeps the box out of the toolbar's flex row.
 */
const exportAffordance = (p: P): Node =>
  p('hideExportWhenEmpty').trim() === ''
    ? exportButton(p)
    : {
        type: 'container',
        element: 'div',
        props: { className: 'contents [&>li]:list-none' },
        dataSource: { table: p('table'), limit: 1 },
        children: [exportButton(p)],
      }

/** Export, Import and New, right-aligned on the same row. */
const trailing = (p: P): Node => ({
  type: 'container',
  element: 'div',
  props: { className: 'flex items-center gap-2 sm:ml-auto' },
  children: [
    ...when(p('exportLabel'), exportAffordance(p)),
    ...when(
      p('importLabel'),
      toolbarButton(p('importLabel'), { action: 'openImport', table: p('table') })
    ),
    ...when(
      p('newSheet'),
      toolbarButton(newLabelOf(p), { action: 'openSheet', component: p('newSheet') }, 'default')
    ),
  ],
})

/**
 * shadcn's "tasks" toolbar in one row: the search box and the narrowing
 * controls on the left, the actions on the right. On a phone the row wraps,
 * the search box taking the full width.
 */
const toolbar = (p: P): Node => ({
  type: 'container',
  element: 'div',
  props: {
    role: 'toolbar',
    'aria-label': p('toolbarLabel'),
    className: 'flex flex-wrap items-center gap-2',
  },
  children: [searchBox(p), ...when(p('facetField'), facet(p)), filterBar(p), trailing(p)],
})

/** The block's parameters, each with the default an install starts from. */
const TOOLBAR_PARAMS = [
  stringParam('table', 'The table the controls filter, export and import.', 'invoices'),
  stringParam(
    'channel',
    'The shared-filter channel the controls publish on. Subscribe the grid to the same name.',
    'invoices-filter'
  ),
  stringParam(
    'facetField',
    'A status, single-select or multi-select field offered as a facet.',
    'status'
  ),
  stringParam(
    'facetLabel',
    'The facet’s label. Empty reads as the field name in words: `status` reads "Status".',
    ''
  ),
  stringParam(
    'newSheet',
    'The id of the sheet the New button opens. Empty to omit the button.',
    ''
  ),
  stringParam(
    'newLabel',
    'The New button’s words. Empty reads "New" and the table’s record: `invoices` reads "New invoice".',
    ''
  ),
  stringParam('searchPlaceholder', 'What the empty search box says.', 'Search'),
  stringParam(
    'searchLabel',
    'The search box’s name for a screen reader. Empty reads as the placeholder.',
    ''
  ),
  stringParam('toolbarLabel', 'The toolbar’s name for a screen reader.', 'Table controls'),
  stringParam('exportLabel', 'The export button’s words. Empty to omit the button.', 'Export CSV'),
  stringParam(
    'hideExportWhenEmpty',
    'Any value holds Export CSV back until the table holds a record the reader may read. Empty draws it always.',
    ''
  ),
  stringParam(
    'importLabel',
    'The import button’s words. Empty to omit the button — on a read-only directory, say.',
    'Import CSV'
  ),
]

/**
 * The toolbar built from `values`, every unset parameter at its default — how
 * another block (the `data-table` grid) composes the same row above its table.
 */
export const composedToolbar = (values: Readonly<Record<string, string>>): Node => {
  const defaults = new Map(TOOLBAR_PARAMS.map((item) => [item.name, String(item.default)]))
  return toolbar((key) => values[key] ?? defaults.get(key) ?? '')
}

/** The toolbar above a data grid, composed from controls that publish on one channel. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'data-table-toolbar',
  title: 'Data table toolbar',
  category: 'console',
  shadcnBlock: null,
  tags: ['table', 'grid', 'toolbar', 'search', 'filter', 'facet', 'export', 'import'],
  description:
    'The toolbar above a data grid: a search box, a facet on one choice field and a filter bar that narrow every data component on a shared channel, then Export CSV, Import CSV and New on the right.',
  notes: [
    'No shadcn counterpart as a block: it draws the toolbar of shadcn/ui’s "tasks" data table — the search box, the faceted filter, then the actions — in one row.',
    PLACE_NOTE,
    'The block narrows nothing by itself: each control publishes on the channel named by `channel`. Subscribe a data component to it with `dataSource: { table: <table>, bindTo: <channel>, sharedFilter: {} }` — a grid, a board or a calendar, as many as the page holds.',
    'The block reads a table you already have: `library add` refuses until your config declares it and the facet field. Point it at your own names with `--set table=…` and `--set facetField=…`.',
    'The facet offers the options the facet field declares, in their declared order, and keeps the records holding any of the ones picked.',
    'Export CSV downloads the table as the reader may read it. Import CSV opens the import dialog, shown only to a reader the table lets create records. New appears once you name the page’s sheet with `--set newSheet=<sheet id>`. Empty `exportLabel` or `importLabel` drops that button. Set `--set hideExportWhenEmpty=true` to draw Export CSV only once the table holds a record the reader may read.',
    'What a reader types or picks narrows the page for that visit only.',
    THEME_NOTE,
  ],
  params: TOOLBAR_PARAMS,
  tables: [
    {
      param: 'table',
      fields: [{ name: 'status', param: 'facetField', type: 'status' }],
    },
  ],
  env: [],
  requires: [],
  build: ({ name, params }) => asComponent(name, toolbar(param(params))),
})
