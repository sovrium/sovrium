/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  asComponent,
  param,
  PLACE_NOTE,
  stringParam,
  THEME_NOTE,
} from '@/library/manifest/block-kit'
import { defineLibraryEntry } from '@/library/manifest/define'
import { buttonLink } from '@/library/manifest/navigation-block-kit'

/** shadcn's Empty: the media, a title, a line, and the actions that fill the view. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'empty',
  shadcnBlock: null,
  title: 'Empty state',
  category: 'console',
  tags: ['empty state', 'zero data', 'onboarding'],
  description:
    "An empty view on shadcn's anatomy: an icon in its tile, what is missing, what will appear, and the two actions that fill it.",
  notes: [
    'No shadcn counterpart: shadcn/ui ships Empty as a component, not a block. This block is its demo: the media, the header and the content holding the actions.',
    'Say what the view will hold and how it gets there; a blank area with no next step is a dead end.',
    PLACE_NOTE,
    THEME_NOTE,
  ],
  params: [
    stringParam('icon', 'A Lucide icon name, drawn in its tile.', 'folder-code'),
    stringParam('title', 'What is missing.', 'No projects yet'),
    stringParam(
      'description',
      'What will appear here, and how.',
      'You have not created a project yet. Start by creating your first one.'
    ),
    stringParam('primaryLabel', 'The main action.', 'Create project'),
    stringParam('primaryHref', 'Where the main action points.', '/projects/new'),
    stringParam('secondaryLabel', 'The second action.', 'Import project'),
    stringParam('secondaryHref', 'Where the second action points.', '/projects/import'),
  ],
  env: [],
  requires: [],
  build: ({ name, params }) => {
    const p = param(params)
    return asComponent(name, {
      type: 'empty',
      emptyIcon: p('icon'),
      emptyMedia: 'icon',
      emptyTitle: p('title'),
      emptyDescription: p('description'),
      props: { className: 'border border-dashed' },
      children: [
        {
          type: 'flex',
          props: { className: 'flex gap-2' },
          children: [
            buttonLink(p('primaryLabel'), p('primaryHref')),
            buttonLink(p('secondaryLabel'), p('secondaryHref'), { variant: 'outline' }),
          ],
        },
      ],
    })
  },
})
