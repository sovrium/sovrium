/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  asComponent,
  DATA_NOTE,
  PLACE_NOTE,
  param,
  stack,
  stringParam,
  THEME_NOTE,
} from '@/library/manifest/block-kit'
import { defineLibraryEntry } from '@/library/manifest/define'

type Param = ReturnType<typeof param>

/** A moderator's Pin or Unpin: a `crud` update of the turn's record, shown to the moderator role alone. */
const pinButton = (p: Param, label: string, pinned: boolean) => ({
  type: 'button',
  content: label,
  props: { variant: 'ghost', size: 'sm' },
  visibility: { roles: [p('moderatorRole')] },
  action: {
    type: 'crud',
    operation: 'update',
    table: p('table'),
    data: { [p('pinnedField')]: pinned },
  },
})

/** The pinned messages, oldest first, following the table live. */
const pinnedList = (p: Param) => ({
  type: 'list',
  dataSource: {
    table: p('table'),
    filter: [{ field: p('pinnedField'), operator: 'eq', value: true }],
    sort: [{ field: p('dayField'), direction: 'asc' }],
    refreshMode: 'realtime',
  },
  listDisplay: {
    itemTemplate: { title: `$record.${p('bodyField')}` },
    emptyMessage: 'No pinned message.',
  },
})

/**
 * A conversation with its pinned messages above it. No new key: a checkbox
 * field on the message table, a `crud` update a moderator's button sends, and a
 * filtered list. A block rather than a recipe, because what it installs is page
 * components — a recipe installs an automation.
 */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'pinned-messages',
  title: 'Conversation with pinned messages',
  shadcnBlock: null,
  category: 'application',
  tags: ['conversation', 'chat', 'channel', 'messages', 'pinned', 'moderation'],
  description:
    'A conversation drawn from your messages table, with the messages a moderator pinned listed above it and a Pin and an Unpin button on each turn for moderators.',
  notes: [
    PLACE_NOTE,
    DATA_NOTE,
    "Pinning writes the checkbox field named by `pinnedField`. Only the role named by `moderatorRole` sees the buttons, and the table's `update` permission must name that role alone: the buttons are hidden from everyone else, and the records API refuses their update.",
    'Each turn shows who wrote it from the `user` field named by `authorField`, which needs sign-in configured in your app.',
    'Every member sees the pinned list, filtered by the same read permission as the conversation; unpinning a message takes it off the list.',
    THEME_NOTE,
  ],
  params: [
    stringParam('table', 'The table holding the messages.', 'messages'),
    stringParam('bodyField', 'The text field holding what was said.', 'body'),
    stringParam('authorField', 'The user field holding who said it.', 'author'),
    stringParam(
      'dayField',
      'The date-time field the conversation is ordered and split by.',
      'created_at'
    ),
    stringParam('pinnedField', 'The checkbox field a moderator sets to pin.', 'pinned'),
    stringParam('moderatorRole', 'The role allowed to pin and unpin.', 'admin'),
    stringParam('pinnedHeadline', 'The heading of the pinned list.', 'Pinned'),
    stringParam('height', 'The height of the conversation frame, as a CSS length.', '60vh'),
  ],
  tables: [
    {
      param: 'table',
      fields: [
        { name: 'body', param: 'bodyField', type: 'long-text' },
        { name: 'pinned', param: 'pinnedField', type: 'checkbox' },
      ],
    },
  ],
  env: [],
  requires: [],
  build: ({ name, params }) => {
    const p = param(params)
    return asComponent(
      name,
      stack(
        [
          {
            type: 'container',
            element: 'section',
            props: { 'aria-label': p('pinnedHeadline') },
            children: [
              {
                type: 'text',
                element: 'h3',
                content: p('pinnedHeadline'),
                props: { className: 'text-sm font-semibold text-foreground' },
              },
              pinnedList(p),
            ],
          },
          {
            type: 'message-scroller',
            height: p('height'),
            autoScroll: true,
            dataSource: {
              table: p('table'),
              sort: [{ field: p('dayField'), direction: 'asc' }],
              refreshMode: 'realtime',
            },
            authorField: p('authorField'),
            dayField: p('dayField'),
            children: [
              {
                type: 'message',
                timestamp: `$record.${p('dayField')}`,
                children: [
                  { type: 'bubble', content: `$record.${p('bodyField')}` },
                  pinButton(p, 'Pin', true),
                  pinButton(p, 'Unpin', false),
                ],
              },
            ],
          },
        ],
        'gap-4'
      )
    )
  },
})
