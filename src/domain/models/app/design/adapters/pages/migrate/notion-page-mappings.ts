/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { MigratedPageMappings } from './migrated-page-mapping'

/**
 * Notion → kit types, read from a workspace or page export ZIP
 * (the pinned Notion facts, `MIGRATION_PAGE_FACTS.notion`): HTML first, the
 * Markdown and CSV export when the HTML is absent.
 *
 * Keyed by the block types as Notion names them (`heading_1`, `callout`,
 * `column_list` …). The converter recognises each block by the markup the
 * pinned real exports show (fact b2); a recognition that turns out wrong is
 * fixed in the converter, never by changing a target here.
 *
 * Each exported page becomes a Sovrium page, and a sub-page becomes a page of
 * its own, linked from its parent by a `link` at the place the sub-page sat.
 * An inline database is data, not page: it is left behind and named in the
 * report, its CSV kept for the data migration. A mention, a synced block and
 * an equation have no static meaning on a migrated page and are reported.
 * A bulleted, numbered or to-do list has no static kit node (the kit's `list`
 * draws records), so it is reported rather than flattened into paragraphs.
 *
 * @public Read by the page migration converter.
 */
export const NOTION_PAGE_MAPPINGS: MigratedPageMappings = {
  source: 'notion',
  components: {
    heading_1: {
      outcome: 'node',
      type: 'text',
      element: 'h1',
      holds: 'content',
      note: 'A level-one heading',
    },
    heading_2: {
      outcome: 'node',
      type: 'text',
      element: 'h2',
      holds: 'content',
      note: 'A level-two heading',
    },
    heading_3: {
      outcome: 'node',
      type: 'text',
      element: 'h3',
      holds: 'content',
      note: 'A level-three heading',
    },
    paragraph: {
      outcome: 'node',
      type: 'text',
      element: 'p',
      holds: 'content',
      note: 'A paragraph of literal text',
    },
    quote: {
      outcome: 'node',
      type: 'text',
      element: 'blockquote',
      holds: 'content',
      note: 'A quotation',
    },
    callout: {
      outcome: 'node',
      type: 'alert',
      holds: 'content',
      note: 'A highlighted note; its icon is not carried',
    },
    toggle: {
      outcome: 'node',
      type: 'collapsible',
      holds: 'children',
      requires: ['triggerLabel'],
      note: 'Its summary line is the trigger, its nested blocks the region',
    },
    divider: {
      outcome: 'node',
      type: 'separator',
      holds: 'nothing',
      note: 'A hairline between two things',
    },
    code: {
      outcome: 'node',
      type: 'code',
      holds: 'content',
      note: 'A block of code shown as text, never run',
    },
    column_list: {
      outcome: 'node',
      type: 'grid',
      holds: 'children',
      note: 'One equal column per column block; unequal widths are reported',
    },
    column: {
      outcome: 'node',
      type: 'container',
      holds: 'children',
      note: 'One column of a column list',
    },
    image: {
      outcome: 'node',
      type: 'image',
      holds: 'nothing',
      note: 'Its file beside the page in the export and its caption as alternative text',
    },
    table_of_contents: {
      outcome: 'node',
      type: 'toc',
      holds: 'nothing',
      note: 'Rebuilt from the migrated page’s own headings',
    },
    child_page: {
      outcome: 'node',
      type: 'link',
      holds: 'content',
      note: 'The sub-page becomes its own page, linked here by its path',
    },
    child_database: {
      outcome: 'left-behind',
      note: 'An inline database is data: its CSV is kept for the data migration',
    },
  },
  layout: {
    'column_list.columns': {
      property: 'columns',
      note: 'The number of column blocks, when their widths are equal',
    },
  },
}
