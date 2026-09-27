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

const CARD_MENU: Readonly<Record<string, unknown>> = {
  type: 'dropdown-menu',
  triggerLabel: 'Card actions',
  menuItems: [
    { label: 'Edit', icon: 'pencil' },
    { label: 'Share', icon: 'share-2' },
    { separator: true },
    { label: 'Archive', icon: 'archive' },
  ],
}

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
    'Replace the dashed slot with the card content. The menu items carry no action yet: give each an `action` in the installed fragment.',
  ],
  params: [
    stringParam('title', 'The name the card is about.', 'Atelier Nord'),
    stringParam('subtitle', 'One line under the name.', 'Client since March 2024'),
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
                CARD_MENU,
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
