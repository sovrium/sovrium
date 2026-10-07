/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  asComponent,
  DATA_NOTE,
  param,
  stringParam,
  THEME_NOTE,
} from '@/library/manifest/block-kit'
import { defineLibraryEntry } from '@/library/manifest/define'
import { RECORD_PAGE_NOTE, recordPanel } from '@/library/manifest/record-block-kit'

/** The facts of a record page: each field by its type, and when it was made and changed. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'record-meta-sidebar',
  title: 'Record facts sidebar',
  category: 'application',
  tags: ['record', 'detail', 'sidebar', 'facts', 'metadata'],
  description:
    'The sidebar of a record page: the record’s facts as a description list, each value drawn by its type — a date in the page language, a status as its chip — with "Not set" for an empty one, and when the record was created and last changed.',
  notes: [
    RECORD_PAGE_NOTE,
    DATA_NOTE,
    'On a tablet the sidebar reads well above the main column as a two-column grid of facts; on a phone it is one column.',
    THEME_NOTE,
  ],
  params: [
    stringParam('table', 'The table the page’s record belongs to.', 'projects'),
    stringParam('titleField', 'The text field naming the record.', 'title'),
    stringParam('statusField', 'The status or single-select field.', 'status'),
    stringParam('fact1', 'The first fact under the title.', 'client'),
    stringParam('fact2', 'The second fact.', 'budget'),
    stringParam('fact3', 'The third fact.', 'due_date'),
  ],
  tables: [
    {
      param: 'table',
      fields: [
        { name: 'title', param: 'titleField', type: 'single-line-text' },
        { name: 'status', param: 'statusField', type: 'status' },
        { name: 'client', param: 'fact1', type: 'single-line-text' },
        { name: 'budget', param: 'fact2', type: 'currency' },
        { name: 'due_date', param: 'fact3', type: 'date' },
      ],
    },
  ],
  env: [],
  requires: [],
  build: ({ name, params }) => {
    const p = param(params)
    return asComponent(
      name,
      recordPanel('Details', [
        {
          type: 'description-list',
          items: [
            { term: '[Status]', field: p('statusField') },
            { term: '[Client]', field: p('fact1') },
            { term: '[Budget]', field: p('fact2') },
            { term: '[Due]', field: p('fact3') },
          ],
        },
        {
          type: 'flex',
          props: {
            className:
              'flex flex-col gap-1 border-t border-border pt-3 text-sm text-foreground-muted',
          },
          children: [
            { type: 'text', element: 'p', content: 'Created $record.createdAt' },
            { type: 'text', element: 'p', content: 'Updated $record.updatedAt' },
          ],
        },
      ])
    )
  },
})
