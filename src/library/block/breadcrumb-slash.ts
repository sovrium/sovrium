/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { appRegion } from '@/library/manifest/app-block-kit'
import { asComponent, PLACE_NOTE, THEME_NOTE } from '@/library/manifest/block-kit'
import { defineLibraryEntry } from '@/library/manifest/define'

/** A path-like breadcrumb in a monospace face. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'breadcrumb-slash',
  title: 'Slash breadcrumb',
  category: 'application',
  tags: ['breadcrumb', 'navigation', 'path'],
  description:
    'A breadcrumb that reads like a path — lower-case segments in a monospace face, separated by slashes, the last one the current page.',
  notes: [
    PLACE_NOTE,
    THEME_NOTE,
    'The trail is written out: edit `breadcrumbItems` in the installed fragment. Long trails wrap onto a second line; middle segments are not collapsed.',
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
          separator: '/',
          breadcrumbItems: [
            { label: 'workspace', href: '/' },
            { label: 'clients', href: '/clients' },
            { label: 'atelier-nord', href: '/clients/atelier-nord' },
            { label: 'inv-0142' },
          ],
          props: { className: 'font-mono text-sm' },
        },
      ])
    ),
})
