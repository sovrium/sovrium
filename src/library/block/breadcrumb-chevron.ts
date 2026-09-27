/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { appRegion } from '@/library/manifest/app-block-kit'
import { asComponent, PLACE_NOTE, THEME_NOTE } from '@/library/manifest/block-kit'
import { defineLibraryEntry } from '@/library/manifest/define'

/** The path back up, separated by chevrons, starting at home. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'breadcrumb-chevron',
  title: 'Breadcrumb with chevrons',
  category: 'application',
  tags: ['breadcrumb', 'navigation', 'path'],
  description:
    'The path back up: a home crumb, the parent pages as links separated by chevrons, and the current page as plain text.',
  notes: [
    PLACE_NOTE,
    THEME_NOTE,
    'The trail is written out. To build it from the page address instead, replace `breadcrumbItems` with `derive: path`, a `labels` map and a `home` crumb.',
  ],
  params: [],
  env: [],
  requires: [],
  build: ({ name }) =>
    asComponent(
      name,
      appRegion([
        {
          type: 'breadcrumb',
          separator: '›',
          breadcrumbItems: [
            { label: 'Home', href: '/', icon: 'house' },
            { label: 'Clients', href: '/clients' },
            { label: 'Atelier Nord', href: '/clients/atelier-nord' },
            { label: 'INV-0142' },
          ],
        },
      ])
    ),
})
