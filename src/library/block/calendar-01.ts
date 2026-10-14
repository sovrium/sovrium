/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { asComponent, PLACE_NOTE, THEME_NOTE } from '@/library/manifest/block-kit'
import { defineLibraryEntry } from '@/library/manifest/define'

/** shadcn/ui's `calendar-01`, composed in config. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'calendar-01',
  shadcnBlock: 'calendar-01',
  title: 'Calendar 01',
  category: 'shadcn',
  tags: ['calendar', 'date', 'single', 'shadcn'],
  description: 'A simple calendar.',
  notes: [
    'One month; a press picks one day, and a second press on it clears it. It opens on the month of `defaultValue`.',
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
      mode: 'single',
      defaultValue: '2026-06-12',
      props: { className: 'rounded-lg border shadow-sm' },
    }),
})
