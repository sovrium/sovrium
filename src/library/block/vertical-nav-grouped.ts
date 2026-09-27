/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { appRegion } from '@/library/manifest/app-block-kit'
import { asComponent, PLACE_NOTE, THEME_NOTE } from '@/library/manifest/block-kit'
import { defineLibraryEntry } from '@/library/manifest/define'

/** The sections of an app, stacked in groups, with a count beside the busy ones. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'vertical-nav-grouped',
  title: 'Grouped vertical navigation',
  category: 'application',
  tags: ['navigation', 'sidebar', 'menu', 'counts'],
  description:
    'A vertical navigation of iconed entries in two groups, with a count beside the entries that need attention and the current page marked.',
  notes: [
    PLACE_NOTE,
    THEME_NOTE,
    'Entries mark themselves current from the request path. A literal `badge` is a word or a number your config can state; for a live count give it `{ endpoint, valuePath }` instead.',
  ],
  params: [],
  env: [],
  requires: [],
  build: ({ name }) =>
    asComponent(
      name,
      appRegion([
        {
          type: 'sidebar',
          props: { className: 'w-64 rounded-lg border border-border bg-background-raised' },
          groups: [
            {
              label: 'Workspace',
              items: [
                { label: 'Overview', href: '/', icon: 'house' },
                {
                  label: 'Invoices',
                  href: '/invoices',
                  icon: 'file-text',
                  badge: '12',
                  activeMatch: 'prefix',
                },
                { label: 'Clients', href: '/clients', icon: 'users', activeMatch: 'prefix' },
                {
                  label: 'Automations',
                  href: '/automations',
                  icon: 'workflow',
                  badge: '3',
                  activeMatch: 'prefix',
                },
              ],
            },
            {
              label: 'Reports',
              items: [
                { label: 'Revenue', href: '/reports/revenue', icon: 'chart-column' },
                { label: 'Delays', href: '/reports/delays', icon: 'clock' },
              ],
            },
          ],
        },
      ])
    ),
})
