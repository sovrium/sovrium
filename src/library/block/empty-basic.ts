/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { appRegion } from '@/library/manifest/app-block-kit'
import {
  asComponent,
  linkButton,
  param,
  PLACE_NOTE,
  stringParam,
  THEME_NOTE,
} from '@/library/manifest/block-kit'
import { defineLibraryEntry } from '@/library/manifest/define'

/** What an empty view is, and the one thing to do next. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'empty-basic',
  title: 'Empty state with one action',
  category: 'application',
  tags: ['empty state', 'onboarding', 'zero data'],
  description:
    'An empty view that says what will appear here and offers the one action that fills it.',
  notes: [
    PLACE_NOTE,
    THEME_NOTE,
    'Say what the view will hold and how it gets there; a blank area with no next step is a dead end.',
  ],
  params: [
    stringParam('icon', 'A Lucide icon name for the view.', 'file-text'),
    stringParam('title', 'What is missing.', 'No invoices yet'),
    stringParam(
      'description',
      'What will appear here, and in which order.',
      'Invoices you create or import appear here, newest first.'
    ),
    stringParam('actionLabel', 'The text of the action that fills the view.', 'New invoice'),
    stringParam('actionHref', 'Where the action points.', '/invoices/new'),
  ],
  env: [],
  requires: [],
  build: ({ name, params }) => {
    const p = param(params)
    return asComponent(
      name,
      appRegion([
        {
          type: 'empty-state',
          emptyIcon: p('icon'),
          emptyTitle: p('title'),
          emptyDescription: p('description'),
          children: [linkButton(p('actionLabel'), p('actionHref'))],
        },
      ])
    )
  },
})
