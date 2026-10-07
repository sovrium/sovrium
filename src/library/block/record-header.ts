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
import { RECORD_PAGE_NOTE, recordFact } from '@/library/manifest/record-block-kit'

type Node = Readonly<Record<string, unknown>>

/** The edit dialog: the record's form, saving back to it. */
const editDialog = (
  dialogId: string,
  table: string,
  title: string,
  fields: readonly string[]
): Node => ({
  type: 'dialog',
  props: { id: dialogId, title: `Edit ${title}`, description: 'Changes are saved to this record.' },
  children: [
    {
      type: 'form',
      dataSource: { table, mode: 'single', param: 'id' },
      fields: fields.map((field) => ({ field })),
      action: {
        type: 'crud',
        operation: 'update',
        table,
        submitLabel: 'Save changes',
        onSuccess: { toast: { message: 'Changes saved.', variant: 'success' } },
      },
    },
  ],
})

type P = (key: string) => string

/** The title and its status on the left, Edit and the menu on the right. */
const titleRow = (p: P, title: string, dialogId: string): Node => ({
  type: 'flex',
  props: { className: 'flex flex-wrap items-start justify-between gap-4' },
  children: [
    {
      type: 'flex',
      props: { className: 'flex min-w-0 flex-wrap items-center gap-3' },
      children: [
        {
          type: 'text',
          element: 'h1',
          props: { className: 'text-2xl font-semibold tracking-tight text-foreground' },
          content: title,
        },
        { type: 'record-field', props: { field: p('statusField') } },
      ],
    },
    {
      type: 'flex',
      props: { className: 'flex items-center gap-2' },
      children: [
        {
          type: 'button',
          variant: 'secondary',
          props: { label: 'Edit', interactions: { click: { modal: dialogId } } },
        },
        actionsMenu(p, title),
      ],
    },
  ],
})

/** The secondary actions, folded into one menu. */
const actionsMenu = (p: P, title: string): Node => ({
  type: 'dropdown-menu',
  triggerLabel: 'More actions',
  menuItems: [
    {
      label: 'Delete',
      icon: 'trash-2',
      variant: 'destructive',
      action: {
        type: 'crud',
        operation: 'delete',
        table: p('table'),
        confirm: true,
        confirmMessage: `Delete ${title}? It cannot be undone.`,
        onSuccess: { navigate: p('listPath') },
      },
    },
  ],
})

/** The top of a record page: trail, title, status, three facts, and the actions. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'record-header',
  title: 'Record page header',
  category: 'application',
  tags: ['record', 'detail', 'header', 'breadcrumb', 'actions'],
  description:
    'The head of a record page: a breadcrumb ending in the record’s name, the name as the page heading with its status beside it, three facts drawn by their type, an Edit button and a menu holding Delete.',
  notes: [
    RECORD_PAGE_NOTE,
    DATA_NOTE,
    'Edit opens the record’s form in a dialog. Delete asks first, naming the record. A reader the table does not let edit or delete is not offered either.',
    THEME_NOTE,
  ],
  params: [
    stringParam('table', 'The table the page’s record belongs to.', 'projects'),
    stringParam('titleField', 'The text field naming the record.', 'title'),
    stringParam('statusField', 'The status or single-select field.', 'status'),
    stringParam('fact1', 'The first fact under the title.', 'client'),
    stringParam('fact2', 'The second fact.', 'budget'),
    stringParam('fact3', 'The third fact.', 'due_date'),
    stringParam('listPath', 'Where the reader lands after deleting the record.', '/projects'),
    stringParam(
      'listSegment',
      'The path segment of the list page, as the address spells it.',
      'projects'
    ),
    stringParam('listLabel', 'How the breadcrumb names the list page.', '[Projects]'),
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
    const dialogId = `${name}-edit`
    const title = `$record.${p('titleField')}`
    return asComponent(name, {
      type: 'container',
      element: 'header',
      props: { className: 'flex flex-col gap-4 border-b border-border pb-6' },
      children: [
        {
          type: 'breadcrumb',
          derive: 'path',
          labels: { [p('listSegment')]: p('listLabel') },
          currentLabel: title,
        },
        titleRow(p, title, dialogId),
        {
          type: 'grid',
          props: { className: 'grid grid-cols-1 gap-4 sm:grid-cols-3' },
          children: [
            recordFact('[Client]', p('fact1')),
            recordFact('[Budget]', p('fact2')),
            recordFact('[Due]', p('fact3')),
          ],
        },
        editDialog(dialogId, p('table'), title, [
          p('titleField'),
          p('statusField'),
          p('fact1'),
          p('fact2'),
          p('fact3'),
        ]),
      ],
    })
  },
})
