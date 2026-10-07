/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { appRegion, slot, span } from '@/library/manifest/app-block-kit'
import {
  asComponent,
  flex,
  param,
  PLACE_NOTE,
  stack,
  stringParam,
  THEME_NOTE,
} from '@/library/manifest/block-kit'
import { defineLibraryEntry } from '@/library/manifest/define'

/** A menu row that goes somewhere — the only kind a menu row can carry out on its own. */
const goTo = (
  label: string,
  iconName: string,
  path: string
): Readonly<Record<string, unknown>> => ({
  label,
  icon: iconName,
  action: { type: 'navigate', path },
})

const cardMenu = (p: (key: string) => string): Readonly<Record<string, unknown>> => ({
  type: 'dropdown-menu',
  triggerLabel: 'Card actions',
  menuItems: [
    goTo('Edit', 'pencil', p('editHref')),
    goTo('Share', 'share-2', p('shareHref')),
    { separator: true },
    goTo('Archive', 'archive', p('archiveHref')),
  ],
})

/** A card whose heading names what it holds, with a menu for what can be done to it. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'card-heading',
  title: 'Card heading with a menu',
  category: 'application',
  tags: ['heading', 'card', 'menu', 'avatar'],
  description:
    'A card whose heading row names what it holds — an avatar, a name and one line — with a menu of card actions, above a slot for its content.',
  notes: [
    PLACE_NOTE,
    THEME_NOTE,
    'Replace the dashed slot with the card content.',
    'Each menu row opens a page: the edit form, the sharing settings, and an archive page that asks before it archives. A menu row carries out `navigate` (and signing out) itself; an action that changes a record lives on the page it opens, behind its own confirmation.',
  ],
  params: [
    stringParam('title', 'The name the card is about.', 'Atelier Nord'),
    stringParam('subtitle', 'One line under the name.', 'Client since March 2024'),
    stringParam('editHref', 'The page the Edit row opens.', '/clients/atelier-nord/edit'),
    stringParam('shareHref', 'The page the Share row opens.', '/clients/atelier-nord/share'),
    stringParam(
      'archiveHref',
      'The page the Archive row opens; it confirms before archiving.',
      '/clients/atelier-nord/archive'
    ),
  ],
  env: [],
  requires: [],
  build: ({ name, params }) => {
    const p = param(params)
    return asComponent(
      name,
      appRegion([
        {
          type: 'card',
          props: { className: 'max-w-xl p-0' },
          children: [
            flex(
              [
                flex(
                  [
                    { type: 'avatar', label: p('title'), shape: 'square' },
                    stack(
                      [
                        {
                          type: 'text',
                          element: 'h3',
                          props: { className: 'text-md font-semibold text-foreground' },
                          content: p('title'),
                        },
                        span(p('subtitle'), 'text-sm text-foreground-subtle'),
                      ],
                      'gap-0.5'
                    ),
                  ],
                  'items-center gap-3'
                ),
                cardMenu(p),
              ],
              'items-center justify-between gap-4 border-b border-border px-5 py-4'
            ),
            {
              type: 'container',
              props: { className: 'p-5' },
              children: [slot('[Card content]', 'h-28')],
            },
          ],
        },
      ])
    )
  },
})
