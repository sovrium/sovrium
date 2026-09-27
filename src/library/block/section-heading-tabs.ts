/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { appHeading, appRegion, plainButton } from '@/library/manifest/app-block-kit'
import {
  asComponent,
  flex,
  param,
  PLACE_NOTE,
  stringParam,
  THEME_NOTE,
} from '@/library/manifest/block-kit'
import { defineLibraryEntry } from '@/library/manifest/define'

/** A section heading with one action and the tabs that switch the section's view. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'section-heading-tabs',
  title: 'Section heading with tabs',
  category: 'application',
  tags: ['heading', 'section header', 'tabs', 'filter'],
  description:
    'A section heading with one action beside it, above tabs that switch between views of the same section.',
  notes: [
    PLACE_NOTE,
    THEME_NOTE,
    'Each tab has a panel: replace the placeholder sentence in each `panels[].body`, or give the tabs `children` — one per panel, in order — to put components in them.',
  ],
  params: [
    stringParam('title', 'The section heading.', 'Activity'),
    stringParam('actionLabel', 'The text of the button beside the heading.', 'Add note'),
  ],
  env: [],
  requires: [],
  build: ({ name, params }) => {
    const p = param(params)
    return asComponent(
      name,
      appRegion([
        flex(
          [appHeading(p('title')), plainButton(p('actionLabel'), 'outline', { size: 'sm' })],
          'items-center justify-between gap-4'
        ),
        {
          type: 'tabs',
          layout: 'flow',
          defaultTab: 'all',
          props: { className: 'mt-4' },
          panels: [
            { id: 'all', label: 'All', body: '[Everything that happened, newest first.]' },
            { id: 'payments', label: 'Payments', body: '[Payments only.]' },
            { id: 'emails', label: 'Emails', body: '[Emails only.]' },
            { id: 'notes', label: 'Notes', body: '[Notes only.]' },
          ],
        },
      ])
    )
  },
})
