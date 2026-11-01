/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { ListDisplaySchema } from '@/domain/models/app/pages/components/component-types/data/list'
import { CommandPaletteSearchSchema } from '@/domain/models/app/pages/components/component-types/navigation'
import searchComponentsBody from '@/domain/models/app/pages/search-components.docs.md' with { type: 'file' }
import searchOverviewBody from '@/domain/models/app/pages/search-overview.docs.md' with { type: 'file' }
import { PaletteSchema } from '@/domain/models/app/palette'
import commandPaletteBody from '@/domain/models/app/palette/palette.docs.md' with { type: 'file' }
import fullTextSearchBody from '@/domain/models/app/tables/fields/field-types/full-text-search.docs.md' with { type: 'file' }
import { defineArticle, defineSection } from './define'

/**
 * Search — the section manifest.
 *
 * Why the four fragments sit in three trees and two carry no directive:
 * `[internal ref]`, § `search`.
 * Shape, ordering and the gates that hold a manifest: the same page,
 * "The conventions every manifest follows".
 */
export const section = defineSection({
  slug: 'search',
  title: 'Search',
  order: 2600,
  tab: 'tables',
  articles: [
    defineArticle({
      slug: 'search-overview',
      title: 'Search Overview',
      description:
        'The four places a query runs: a bound component, the records endpoint, the ⌘K palette and the static public-page index, and which one a configuration reaches.',
      keywords: [
        'sovrium',
        'search',
        'search engine',
        'searchEngine',
        'mode search',
        'client search',
        'full-text search',
        'command palette',
        'q parameter',
        'debounce',
      ],
      order: 2600,
      sidebarLabel: 'Search Overview',
      body: searchOverviewBody,
      documents: [],
      stories: ['US-PAGES-SEARCH-001', 'US-PAGES-COMMAND-SEARCH-INDEX-001'],
    }),
    defineArticle({
      slug: 'full-text-search',
      title: 'Full-Text Search',
      description:
        'What `indexed` and `fullTextSearch` emit into the database, how PostgreSQL and SQLite differ, and which searches read an index.',
      keywords: [
        'sovrium',
        'full-text search',
        'fullTextSearch',
        'indexed',
        'tsvector',
        'GIN index',
        'rich text',
        'postgresql',
        'sqlite',
        'database index',
      ],
      order: 2610,
      sidebarLabel: 'Full-Text Search',
      body: fullTextSearchBody,
      documents: [],
      stories: ['US-TABLES-FIELD-TYPES-LONG-TEXT-SEARCH'],
    }),
    defineArticle({
      slug: 'search-components',
      title: 'Search Components',
      description:
        'The components that put a search box on a page — `search-input` and its two roles, the `list` result display, and where the ⌘K palette is documented.',
      keywords: [
        'sovrium',
        'search-input',
        'search scope',
        'page search',
        'static index',
        'list',
        'listDisplay',
        'toolbar search',
        'bindTo',
        'highlight',
      ],
      order: 2620,
      sidebarLabel: 'Search Components',
      body: searchComponentsBody,
      documents: [ListDisplaySchema],
      stories: [
        'US-PAGES-SEARCH-003',
        'US-PAGES-SEARCH-004',
        'US-PAGES-SEARCH-005',
        'US-PAGES-SEARCH-006',
        'US-PAGES-COMMAND-SEARCH-HARDENING',
        'US-PAGES-PUBLIC-SEARCH-001',
        'US-PAGES-PUBLIC-SEARCH-002',
        'US-PAGES-PUBLIC-SEARCH-003',
        'US-PAGES-PUBLIC-SEARCH-004',
        'US-PAGES-PUBLIC-SEARCH-005',
        'US-PAGES-PUBLIC-SEARCH-006',
        'US-PAGES-PUBLIC-SEARCH-007',
        'US-PAGES-PUBLIC-SEARCH-008',
        'US-PAGES-PUBLIC-SEARCH-009',
        'US-PAGES-PUBLIC-SEARCH-010',
      ],
    }),
    defineArticle({
      slug: 'command-palette',
      title: 'Command Palette',
      description:
        'The ⌘K overlay on every page: what it searches and offers, the `palette` property that switches it off, and the `command` component that places your own.',
      keywords: [
        'sovrium',
        'command palette',
        'palette',
        'cmd+k',
        'ctrl+k',
        'keyboard shortcut',
        'command',
        'custom search endpoint',
        'opt out',
      ],
      order: 2630,
      sidebarLabel: 'Command Palette',
      body: commandPaletteBody,
      documents: [PaletteSchema, CommandPaletteSearchSchema],
      stories: ['US-PAGES-COMMAND-PALETTE'],
    }),
  ],
})
