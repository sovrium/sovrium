/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { appRegion } from '@/library/manifest/app-block-kit'
import { asComponent, PLACE_NOTE, THEME_NOTE } from '@/library/manifest/block-kit'
import { defineLibraryEntry } from '@/library/manifest/define'

/** A few views of one thing, one visible at a time, under an underlined strip. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'tabs-underline',
  title: 'Underlined tabs',
  category: 'application',
  tags: ['tabs', 'navigation', 'views', 'panels'],
  description:
    'A strip of tabs with an underline under the current one, each opening its own panel — for a few views of one record.',
  notes: [
    PLACE_NOTE,
    THEME_NOTE,
    'Replace each placeholder `body`, or give the tabs `children` — one component per panel, in order — to put components in a panel. Arrow keys move between tabs.',
  ],
  params: [],
  env: [],
  requires: [],
  build: ({ name }) =>
    asComponent(
      name,
      appRegion([
        {
          type: 'tabs',
          layout: 'flow',
          defaultTab: 'details',
          panels: [
            { id: 'details', label: 'Details', body: '[The record’s fields.]' },
            { id: 'invoices', label: 'Invoices', body: '[The invoices linked to this record.]' },
            {
              id: 'activity',
              label: 'Activity',
              body: '[What happened to this record, newest first.]',
            },
            { id: 'files', label: 'Files', body: '[The files attached to this record.]' },
          ],
        },
      ])
    ),
})
