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
import fullTextSearchBody from '@/domain/models/app/tables/fields/field-types/full-text-search.docs.md' with { type: 'file' }
import { defineArticle, defineSection } from './define'

/**
 * Search — the section manifest.
 *
 * ─── WHY THE THREE FRAGMENTS SIT IN TWO DIFFERENT TREES ────────────────────
 *
 * Search has no property of its own: `app.search` does not exist, and the
 * placement rule sends each article to the narrowest thing it is true of.
 *
 *   - `search-overview` documents `dataSource.mode: 'search'` and
 *     `searchEngine`, both declared in `pages/components/data-source.ts`, so
 *     it lands in `pages/` beside `pages-data-binding.docs.md`, which
 *     documents the rest of that schema.
 *   - `search-components` spans five owners — `content/search-input.ts`,
 *     `data/list/list-display.ts`, `navigation/command-palette.ts`,
 *     `component-search.ts` and the root `palette` property — and `pages/` is
 *     the narrowest declared directory that contains four of the five.
 *   - `full-text-search` documents `indexed` (on `field-types/base-field.ts`)
 *     and `fullTextSearch` (on `field-types/text/rich-text-field.ts`), so it
 *     sits at the `field-types/` root, which is the narrowest directory
 *     holding both.
 *
 * ─── WHY TWO OF THE THREE CARRY NO DIRECTIVE ───────────────────────────────
 *
 * An option table belongs beside its property, once. `DataSourceSchema`,
 * `BaseFieldSchema` and `RichTextFieldSchema` are already expanded by
 * `pages-data-binding`, `field-types-overview` and `text-fields` respectively,
 * and `SearchEngineSchema` is a scalar enum the engine refuses to expand at
 * all. So `search-overview` and `full-text-search` are prose that names those
 * articles rather than re-tabulating them, and the three directives that DO
 * appear here are each the only expansion of their schema in the manual.
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
        'The four places a query runs in Sovrium — a bound component, the records endpoint, the ⌘K palette and the static public-page index — and which one a given configuration reaches.',
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
      stories: [],
    }),
    defineArticle({
      slug: 'search-components',
      title: 'Search Components',
      description:
        'The components that put a search box on a page — `search-input` and its two scopes, the `list` result display, the ⌘K palette, and the in-component toolbar box.',
      keywords: [
        'sovrium',
        'search-input',
        'search scope',
        'page search',
        'static index',
        'list',
        'listDisplay',
        'command palette',
        'palette',
        'toolbar search',
        'bindTo',
        'highlight',
      ],
      order: 2620,
      sidebarLabel: 'Search Components',
      body: searchComponentsBody,
      documents: [ListDisplaySchema, PaletteSchema, CommandPaletteSearchSchema],
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
      ],
    }),
  ],
})
