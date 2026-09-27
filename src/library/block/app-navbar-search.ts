/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { accountMenu, appHeader, iconLink } from '@/library/manifest/app-block-kit'
import {
  asComponent,
  flex,
  logo,
  param,
  PLACE_NOTE,
  stringParam,
  THEME_NOTE,
} from '@/library/manifest/block-kit'
import { defineLibraryEntry } from '@/library/manifest/define'

/** The top bar inside an app: identity, search, notifications and the account. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'app-navbar-search',
  title: 'Application top bar with search',
  category: 'application',
  tags: ['navbar', 'top bar', 'search', 'account menu'],
  description:
    'The top bar inside an app: the app name, a wide search box, a notifications link and the account menu.',
  notes: [
    PLACE_NOTE,
    THEME_NOTE,
    'The search box searches the public pages of the app (`scope: page`); bind it to a list instead with `scope: subscribers`. It is hidden on a phone, where ⌘K opens the command palette.',
    'Edit the account menu items in the installed fragment.',
  ],
  params: [
    stringParam('brand', 'The app name beside the logo mark.', '[App]'),
    stringParam(
      'searchPlaceholder',
      'The placeholder in the search box.',
      'Search clients, invoices…'
    ),
  ],
  env: [],
  requires: [],
  build: ({ name, params }) => {
    const p = param(params)
    return asComponent(
      name,
      appHeader(
        [
          logo(p('brand')),
          {
            type: 'search-input',
            scope: 'page',
            props: {
              placeholder: p('searchPlaceholder'),
              'aria-label': 'Search',
              className: 'hidden w-full max-w-md md:flex',
            },
          },
          flex(
            [
              iconLink('bell', 'Notifications', '/notifications'),
              accountMenu([
                ['Profile', 'user', '/profile'],
                ['Settings', 'settings', '/settings'],
              ]),
            ],
            'items-center gap-1'
          ),
        ],
        'h-16'
      )
    )
  },
})
