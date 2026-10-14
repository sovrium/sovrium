/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { asComponent, PLACE_NOTE, THEME_NOTE } from '@/library/manifest/block-kit'
import { defineLibraryEntry } from '@/library/manifest/define'

/** shadcn/ui's `calendar-04`, composed in config. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'calendar-04',
  shadcnBlock: 'calendar-04',
  title: 'Calendar 04',
  category: 'shadcn',
  tags: ['calendar', 'date', 'range', 'shadcn'],
  description: 'Single month with range selection',
  notes: [
    'One month; the first press starts a range and the second ends it. `defaultValue` is the range shown when the page opens, as `{ from, to }`.',
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
      mode: 'range',
      defaultValue: { from: '2026-06-09', to: '2026-06-26' },
      props: { className: 'rounded-lg border shadow-sm' },
    }),
})
