/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { appRegion, slot } from '@/library/manifest/app-block-kit'
import { asComponent, flex, PLACE_NOTE, THEME_NOTE } from '@/library/manifest/block-kit'
import { defineLibraryEntry } from '@/library/manifest/define'

const SECTIONS: readonly (readonly [string, string, string])[] = [
  ['General', '/settings', 'general'],
  ['Members', '/settings/members', 'members'],
  ['Billing', '/settings/billing', 'billing'],
  ['Notifications', '/settings/notifications', 'notifications'],
  ['Danger zone', '/settings/danger', 'danger'],
]

/** The sub-navigation of a settings area beside the settings panel. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'vertical-nav-settings',
  title: 'Settings sub-navigation',
  category: 'application',
  tags: ['navigation', 'settings', 'sub-navigation', 'menu'],
  description:
    'A settings area: a short list of sections on the left, the current one marked, beside the panel of that section.',
  notes: [
    PLACE_NOTE,
    THEME_NOTE,
    'Each link marks itself current when `$query.section` equals its key. Place a copy on each settings page, or bind the key to your own route parameter with `$param.<name>`.',
    'On a phone the list sits above the panel and scrolls sideways.',
  ],
  params: [],
  env: [],
  requires: [],
  build: ({ name }) =>
    asComponent(
      name,
      appRegion([
        flex(
          [
            {
              type: 'container',
              element: 'nav',
              props: {
                'aria-label': 'Settings',
                className: 'flex flex-none gap-1 overflow-x-auto md:w-52 md:flex-col',
              },
              children: SECTIONS.map(([label, href, key]) => ({
                type: 'link',
                props: {
                  href: `${href}?section=${key}`,
                  className:
                    'whitespace-nowrap rounded-md px-3 py-2 text-md text-foreground-muted hover:bg-background-subtle hover:text-foreground',
                },
                activeWhen: { value: '$query.section', equals: key },
                activeProps: {
                  'aria-current': 'page',
                  className:
                    'whitespace-nowrap rounded-md bg-background-subtle px-3 py-2 text-md font-medium text-foreground',
                },
                content: label,
              })),
            },
            slot('[Settings panel]', 'h-80 min-w-0 flex-1'),
          ],
          'flex-col gap-6 md:flex-row md:gap-12'
        ),
      ])
    ),
})
