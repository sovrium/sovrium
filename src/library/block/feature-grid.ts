/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  asComponent,
  featureItem,
  grid,
  param,
  PLACE_NOTE,
  section,
  sectionHead,
  stringParam,
  THEME_NOTE,
  wrap,
} from '@/library/manifest/block-kit'
import { defineLibraryEntry } from '@/library/manifest/define'

const ITEMS: ReadonlyArray<readonly [string, string, string]> = [
  [
    'file-text',
    'One file describes the app',
    'Each item states a result for the reader, in their words.',
  ],
  ['lock', 'Your data stays yours', 'Keep it to two lines so the grid scans in one pass.'],
  ['workflow', 'Work runs on its own', 'Name what happens, not the mechanism behind it.'],
  ['users', 'Roles decide who sees what', 'A concrete example beats an adjective.'],
  ['database', 'Records you can export', 'If a number supports it, cite where it comes from.'],
  ['globe', 'Runs where you choose', 'The sixth item closes the argument, it does not pad it.'],
]

/** Six benefits in a three-column grid, each with an icon. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'feature-grid',
  title: 'Feature grid in three columns',
  category: 'marketing',
  tags: ['features', 'benefits', 'grid', 'icons'],
  description:
    'A heading group over six benefits laid out three by two, each with an icon, a short title and one or two lines.',
  notes: [
    PLACE_NOTE,
    THEME_NOTE,
    'The six items are written into the fragment. Edit their icon, title and text there; any Lucide icon name works. The grid falls to two columns on a tablet and one on a phone.',
  ],
  params: [
    stringParam('eyebrow', 'A short label above the heading. Empty to omit.', '[Eyebrow]'),
    stringParam('headline', 'The section heading.', 'Group the benefits under one idea'),
    stringParam(
      'subheadline',
      'One sentence under the heading. Empty to omit.',
      'A sentence that frames the six items below.'
    ),
  ],
  env: [],
  requires: [],
  build: ({ name, params }) => {
    const p = param(params)
    return asComponent(
      name,
      section([
        wrap([
          sectionHead({ eyebrow: p('eyebrow'), title: p('headline'), lead: p('subheadline') }),
          grid(
            ITEMS.map(([icon, title, text]) => featureItem(icon, title, text)),
            'mt-12 gap-x-8 gap-y-12 sm:grid-cols-2 lg:mt-16 lg:grid-cols-3'
          ),
        ]),
      ])
    )
  },
})
