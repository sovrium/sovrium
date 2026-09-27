/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { appRegion, slot } from '@/library/manifest/app-block-kit'
import {
  asComponent,
  param,
  PLACE_NOTE,
  stringParam,
  THEME_NOTE,
} from '@/library/manifest/block-kit'
import { defineLibraryEntry } from '@/library/manifest/define'

/** A segmented control choosing one period for the view below it. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'tabs-segmented',
  title: 'Segmented control',
  category: 'application',
  tags: ['segmented control', 'toggle', 'tabs', 'period'],
  description:
    'A segmented control — three joined choices, one selected — above the region it switches, for views that share one panel such as a period.',
  notes: [
    PLACE_NOTE,
    THEME_NOTE,
    'This is a `toggle-group` with `toggleType: single`: the choice is held in the reader’s browser. When each choice needs its own panel, use `block/tabs-underline` instead.',
    'Replace the dashed slot with the view the control switches.',
  ],
  params: [stringParam('label', 'The accessible name of the control.', 'Period')],
  env: [],
  requires: [],
  build: ({ name, params }) => {
    const p = param(params)
    return asComponent(
      name,
      appRegion([
        {
          type: 'toggle-group',
          toggleType: 'single',
          orientation: 'horizontal',
          options: [
            { label: 'Week', value: 'week' },
            { label: 'Month', value: 'month' },
            { label: 'Quarter', value: 'quarter' },
          ],
          props: { 'aria-label': p('label'), defaultValue: ['week'] },
        },
        slot('[The view for the chosen period]', 'mt-6 h-32'),
      ])
    )
  },
})
