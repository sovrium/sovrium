/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { asComponent, PLACE_NOTE, THEME_NOTE } from '@/library/manifest/block-kit'
import { defineLibraryEntry } from '@/library/manifest/define'
import type { BlockNode } from '@/library/manifest/block-kit'

type Person = readonly [name: string, email: string, initials: string]

const PEOPLE: readonly Person[] = [
  ['Léa Moreau', 'lea@example.com', 'LM'],
  ['Hugo Bernard', 'hugo@example.com', 'HB'],
  ['Inès Laurent', 'ines@example.com', 'IL'],
]

/** One person as shadcn's Item: the avatar as media, a title, a line, and an action. */
const person = ([name, email, initials]: Person): BlockNode => ({
  type: 'item',
  itemVariant: 'outline',
  // `!flex`: the renderer stamps an inline `display: inline-block` on the item,
  // which otherwise beats the row layout of its own recipe.
  props: { className: '!flex w-full' },
  title: name,
  description: email,
  media: { type: 'avatar', label: name, initials },
  actions: [
    {
      type: 'link',
      props: {
        href: `/team/${initials.toLowerCase()}`,
        className:
          'inline-flex h-8 items-center rounded-lg border border-border bg-background px-2.5 text-sm font-medium text-foreground no-underline hover:bg-muted hover:no-underline',
      },
      content: 'View',
    },
  ],
})

/** A list of shadcn Items: each row a person with their avatar and one action. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'item',
  shadcnBlock: null,
  title: 'Item list',
  category: 'console',
  tags: ['item', 'list', 'row', 'avatar', 'people'],
  description: 'A column of rows, each with its media, a title, one line under it and an action.',
  notes: [
    'No shadcn counterpart: shadcn/ui ships Item as a component, not a block. Each row is an `item` with its `media`, `title`, `description` and `actions` slots.',
    '`itemVariant` frames a row (`default`, `outline` or `muted`) and `itemSize: sm` makes it shorter. Edit the rows in the installed fragment, or bind a `list` to your table and keep one row as its template.',
    PLACE_NOTE,
    THEME_NOTE,
  ],
  params: [],
  env: [],
  requires: [],
  build: ({ name }) =>
    asComponent(name, {
      type: 'container',
      props: { className: 'flex w-full max-w-md flex-col gap-3' },
      children: PEOPLE.map(person),
    }),
})
