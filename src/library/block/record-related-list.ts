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

type Node = Readonly<Record<string, unknown>>
type P = (key: string) => string

/** The children of the page's record. */
const childGrid = (p: P): Node => ({
  type: 'table',
  // The block's own Add button opens the linked form; the grid only lists.
  readOnly: true,
  dataSource: {
    table: p('childTable'),
    filter: [{ field: p('parentField'), operator: 'eq', value: '$record.id' }],
  },
  columns: [{ field: p('childTitleField'), label: 'Title', editable: false }],
  phoneLayout: 'rows',
  emptyMessage: `No ${p('childLabel')} yet. Add one to see it here.`,
})

/** The add dialog: the installed form, its parent link filled and kept out of view. */
const addDialog = (p: P, dialogId: string, formName: string): Node => ({
  type: 'dialog',
  props: {
    id: dialogId,
    title: `Add a ${p('childLabel')}`,
    description: 'It is linked to this record.',
  },
  children: [
    {
      type: 'form',
      formRef: formName,
      classes: { parts: { title: 'sr-only' } },
      inlinePrefill: { prefill: { [p('parentField')]: '$parent.id' }, lockPrefill: true },
    },
  ],
})

/** The children of the page's record, with an add action that links the new one. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'record-related-list',
  title: 'Record related list',
  category: 'application',
  tags: ['record', 'related', 'children', 'list', 'add'],
  description:
    'A list of the records that point at the page’s record — the tasks of a project, the lines of an order — with an "Add a [child]" button whose form links the new record to this one before it is saved.',
  notes: [
    RECORD_PAGE_NOTE,
    'The child table needs a relationship field pointing at the page’s table: `parentField` names it. The add form installed beside the block fills that field with the page’s record and keeps it out of view, so a new child is always linked to the right parent.',
    DATA_NOTE,
    THEME_NOTE,
  ],
  params: [
    stringParam('table', 'The table the page’s record belongs to.', 'projects'),
    stringParam('childTable', 'The table the related records live in.', 'tasks'),
    stringParam(
      'parentField',
      'The child’s relationship field pointing at the page’s record.',
      'project'
    ),
    stringParam(
      'childTitleField',
      'The child’s text field the list and the form lead with.',
      'title'
    ),
    stringParam('childLabel', 'What one child is called, for the button and the form.', 'task'),
    stringParam('childHeading', 'The heading above the list.', '[Tasks]'),
  ],
  tables: [
    {
      param: 'childTable',
      fields: [
        { name: 'title', param: 'childTitleField', type: 'single-line-text' },
        { name: 'project', param: 'parentField', type: 'relationship' },
      ],
    },
  ],
  env: [],
  requires: [],
  forms: ({ name, params }) => {
    const p = param(params)
    return [
      {
        name: `${name}-add`,
        title: `Add a ${p('childLabel')}`,
        submitTo: { table: p('childTable') },
        fields: [
          { kind: 'table-field', column: p('childTitleField'), label: 'Title' },
          { kind: 'table-field', column: p('parentField'), hidden: true },
        ],
        display: { submitLabel: `Add ${p('childLabel')}` },
        onSuccess: { type: 'toast', message: 'Added.', variant: 'success' },
      },
    ]
  },
  build: ({ name, params }) => {
    const p = param(params)
    const dialogId = `${name}-add-dialog`
    return asComponent(
      name,
      recordPanel('', [
        {
          type: 'flex',
          props: { className: 'flex items-center justify-between gap-3' },
          children: [
            {
              type: 'text',
              element: 'h2',
              props: { className: 'text-md font-semibold text-foreground' },
              content: p('childHeading'),
            },
            {
              type: 'button',
              variant: 'secondary',
              props: {
                label: `Add a ${p('childLabel')}`,
                interactions: { click: { modal: dialogId } },
              },
            },
          ],
        },
        childGrid(p),
        addDialog(p, dialogId, `${name}-add`),
      ])
    )
  },
})
