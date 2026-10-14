/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { asComponent, PLACE_NOTE, THEME_NOTE } from '@/library/manifest/block-kit'
import { defineLibraryEntry } from '@/library/manifest/define'

/** shadcn/ui's `calendar-03`, composed in config. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'calendar-03',
  shadcnBlock: 'calendar-03',
  title: 'Calendar 03',
  category: 'shadcn',
  tags: ['calendar', 'date', 'multiple', 'months', 'shadcn'],
  description: 'Multiple months with multiple selection.',
  notes: [
    'Two months side by side; each press toggles one day, so a reader picks several. `defaultValue` lists the days picked when the page opens.',
    'The day calendar holds no records: to place records on dates, use `event-calendar`. Inside a form, give it a `name` and the selection is submitted as ISO dates.',
    PLACE_NOTE,
    THEME_NOTE,
  ],
  params: [],
  env: [],
  requires: [],
  build: ({ name }) =>
    asComponent(name, {
      type: 'calendar',
      mode: 'multiple',
      months: 2,
      defaultValue: ['2026-06-12', '2026-07-24'],
      props: { className: 'rounded-lg border shadow-sm' },
    }),
})
