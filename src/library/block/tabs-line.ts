/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { asComponent, PLACE_NOTE, THEME_NOTE } from '@/library/manifest/block-kit'
import { defineLibraryEntry } from '@/library/manifest/define'

/** The sections of one page, one visible at a time, under shadcn's line tabs. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'tabs-line',
  shadcnBlock: null,
  title: 'Line tabs',
  category: 'console',
  tags: ['tabs', 'line', 'sections', 'navigation', 'panels'],
  description:
    'The sections of one page under a row of tabs whose current tab is underlined on no ground: shadcn’s `line` tabs, one panel open at a time.',
  notes: [
    'No shadcn counterpart: shadcn/ui ships Tabs as a component, not a block. This block is its `line` variant (`tabsVariant: line`), the tabs a page uses for its own sections.',
    'Replace each placeholder `body`, or give the tabs `children` — one component per panel, in order — to put components in a panel. Arrow keys move between tabs.',
    'Set `defaultTab: $query.tab` to open the tab a link names, so each section keeps an address.',
    PLACE_NOTE,
    THEME_NOTE,
  ],
  params: [],
  env: [],
  requires: [],
  build: ({ name }) =>
    asComponent(name, {
      type: 'tabs',
      tabsVariant: 'line',
      defaultTab: 'overview',
      props: { 'aria-label': 'Sections' },
      panels: [
        { id: 'overview', label: 'Overview', body: '[What this page is about, at a glance.]' },
        { id: 'activity', label: 'Activity', body: '[What happened, newest first.]' },
        { id: 'settings', label: 'Settings', body: '[How it is set up.]' },
      ],
    }),
})
