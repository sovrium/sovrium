/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { asComponent, param, stringParam, THEME_NOTE } from '@/library/manifest/block-kit'
import { defineLibraryEntry } from '@/library/manifest/define'
import { RECORD_PAGE_NOTE, recordPanel } from '@/library/manifest/record-block-kit'

type Node = Readonly<Record<string, unknown>>

/** What each kind of change reads as, after a name and on its own. */
const CHANGES = [
  { action: 'create', named: 'created this record', alone: 'Created' },
  { action: 'update', named: 'edited this record', alone: 'Edited' },
  { action: 'delete', named: 'deleted this record', alone: 'Deleted' },
  { action: 'restore', named: 'restored this record', alone: 'Restored' },
] as const

/** One phrase, drawn only on the rows whose change is `action`. */
const phrase = (action: string, content: string): Node => ({
  type: 'text',
  element: 'span',
  visibility: { record: { field: 'action', eq: action } },
  content,
})

/**
 * The sentence of one change: "Ana Lindqvist edited this record" when a
 * person made it, "Edited" alone when none did — an import, an automation.
 */
const sentence = (): Node => ({
  type: 'flex',
  props: { className: 'min-w-0 text-md text-foreground' },
  children: [
    {
      type: 'flex',
      visibility: { record: { field: 'userName', isNotEmpty: true } },
      props: { className: 'flex min-w-0 flex-wrap gap-x-1' },
      children: [
        {
          type: 'text',
          element: 'span',
          props: { className: 'font-medium' },
          content: '$record.userName',
        },
        // The leading space is the sentence's own word break: the flex gap
        // spaces the words on screen, but copied or read as text the name and
        // the verb would otherwise run together ("Ana Lindqvistedited")
        ...CHANGES.map((change) => phrase(change.action, ` ${change.named}`)),
      ],
    },
    {
      type: 'flex',
      visibility: { record: { field: 'userName', isEmpty: true } },
      children: CHANGES.map((change) => phrase(change.action, change.alone)),
    },
  ],
})

/**
 * The record's twenty latest changes, newest first. A server-drawn row
 * template has no Load more, so the panel stays a recent-history view.
 */
const changeList = (table: string): Node => ({
  type: 'list',
  props: { 'aria-label': 'Changes' },
  dataSource: {
    system: {
      endpoint: `/api/tables/${table}/records/$record.id/history`,
      rowsKey: 'history',
      idKey: 'createdAt',
      query: { sort: 'createdAt:desc', limit: 20 },
    },
  },
  listDisplay: { emptyMessage: 'No change recorded yet.' },
  children: [
    {
      type: 'flex',
      props: {
        className: 'flex items-baseline justify-between gap-4 py-2.5',
      },
      children: [
        sentence(),
        {
          type: 'record-field',
          props: { field: 'createdAt', className: 'shrink-0 text-sm text-foreground-muted' },
          format: 'relative-date',
        },
      ],
    },
  ],
})

/** What happened to the page's record, and who did it. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'record-history',
  title: 'Record history',
  category: 'application',
  tags: ['record', 'history', 'changes', 'audit', 'activity'],
  description:
    'The latest changes made to the page’s record, newest first: one sentence each saying who created, edited, deleted or restored it, and how long ago.',
  notes: [
    RECORD_PAGE_NOTE,
    'The history comes from the record’s own change log, so there is no table to add. A reader sees the history of a record they may read, and nothing for one they may not.',
    'A change no person made — a seeded or imported record, an automation — reads as the change alone ("Created"), naming no one.',
    'It shows the twenty latest changes and says that the record changed, not what changed: the fields before and after are left out, so the panel stays one line per change.',
    THEME_NOTE,
  ],
  params: [
    stringParam('table', 'The table the page’s record belongs to.', 'projects'),
    stringParam('headline', 'The heading above the changes.', 'History'),
  ],
  env: [],
  requires: [],
  build: ({ name, params }) => {
    const p = param(params)
    return asComponent(name, recordPanel(p('headline'), [changeList(p('table'))]))
  },
})
