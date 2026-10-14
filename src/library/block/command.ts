/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { asComponent, PLACE_NOTE, THEME_NOTE } from '@/library/manifest/block-kit'
import { defineLibraryEntry } from '@/library/manifest/define'

/** The command menu: grouped commands a reader reaches from the keyboard. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'command',
  shadcnBlock: null,
  title: 'Command menu',
  category: 'console',
  tags: ['command', 'palette', 'keyboard', 'search', 'navigation'],
  description:
    'A command menu that opens with Control or Command and K: named groups of commands, narrowed as the reader types.',
  notes: [
    'No shadcn counterpart: shadcn/ui ships Command as a component, not a block. This block is its demo, Suggestions and Settings, written as `groups`.',
    'Nothing is drawn until the reader presses Control or Command and K; typing narrows the commands across every group, and Enter runs the highlighted one. Place one per page.',
    'Each command goes to its `href`, or runs its `action` (a navigation or a toast). Edit `groups` in the installed fragment to list your own pages.',
    PLACE_NOTE,
    THEME_NOTE,
  ],
  params: [],
  env: [],
  requires: [],
  build: ({ name }) =>
    asComponent(name, {
      type: 'command',
      groups: [
        {
          label: 'Suggestions',
          items: [
            { label: 'Calendar', icon: 'calendar', href: '/calendar' },
            { label: 'Search Emoji', icon: 'smile', href: '/emoji' },
            { label: 'Calculator', icon: 'calculator', href: '/calculator' },
          ],
        },
        {
          label: 'Settings',
          items: [
            { label: 'Profile', icon: 'user', href: '/profile', shortcut: ['⌘', 'P'] },
            { label: 'Billing', icon: 'credit-card', href: '/billing', shortcut: ['⌘', 'B'] },
            { label: 'Settings', icon: 'settings', href: '/settings', shortcut: ['⌘', 'S'] },
          ],
        },
      ],
    }),
})
