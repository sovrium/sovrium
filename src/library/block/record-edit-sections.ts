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
import { RECORD_PAGE_NOTE } from '@/library/manifest/record-block-kit'

/** The full-page edit of a record: fields grouped into titled sections, a save bar that follows. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'record-edit-sections',
  title: 'Record edit page',
  category: 'application',
  tags: ['record', 'edit', 'form', 'sections', 'save bar'],
  description:
    'A record’s edit page: its fields in titled sections with a line of help each, labels beside the controls, and a save bar pinned to the bottom that counts the unsaved changes.',
  notes: [
    RECORD_PAGE_NOTE,
    DATA_NOTE,
    'Add, remove or regroup fields in the `sections` of your copy. Leaving with unsaved changes asks first.',
    THEME_NOTE,
  ],
  params: [
    stringParam('table', 'The table the page’s record belongs to.', 'projects'),
    stringParam('titleField', 'The text field naming the record.', 'title'),
    stringParam('statusField', 'The status or single-select field.', 'status'),
    stringParam('fact1', 'The first fact under the title.', 'client'),
    stringParam('fact2', 'The second fact.', 'budget'),
    stringParam('fact3', 'The third fact.', 'due_date'),
    stringParam(
      'descriptionField',
      'A long-text field for the description section.',
      'description'
    ),
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
        { name: 'description', param: 'descriptionField', type: 'long-text' },
      ],
    },
  ],
  env: [],
  requires: [],
  build: ({ name, params }) => {
    const p = param(params)
    const table = p('table')
    return asComponent(name, {
      type: 'container',
      element: 'section',
      props: {
        className: 'mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-8 sm:py-8',
      },
      children: [
        {
          type: 'text',
          element: 'h1',
          props: { className: 'text-2xl font-semibold tracking-tight text-foreground' },
          content: `Edit $record.${p('titleField')}`,
        },
        {
          type: 'form',
          dataSource: { table, mode: 'single', param: 'id' },
          labelPlacement: 'side',
          stickyActions: true,
          action: {
            type: 'crud',
            operation: 'update',
            table,
            submitLabel: 'Save',
            onSuccess: { toast: { message: 'Changes saved.', variant: 'success' } },
          },
          sections: [
            {
              title: 'Basics',
              description: 'What the [project] is called and where it stands.',
              fields: [p('titleField'), p('statusField')],
            },
            {
              title: 'Client and budget',
              description: 'Who it is for and what it may cost.',
              fields: [p('fact1'), p('fact2'), p('fact3')],
            },
            {
              title: 'Description',
              description: 'Anything the team should know.',
              fields: [p('descriptionField')],
            },
          ],
        },
      ],
    })
  },
})
