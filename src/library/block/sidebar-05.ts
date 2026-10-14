/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { asComponent } from '@/library/manifest/block-kit'
import { defineLibraryEntry } from '@/library/manifest/define'
import {
  brandRow,
  crumbs,
  placeholderContent,
  sidebarSearch,
} from '@/library/manifest/navigation-block-kit'
import {
  SHELL_NOTES,
  shellHeader,
  shellInset,
  shellLayout,
  shellSidebar,
} from '@/library/manifest/sidebar-shell-block-kit'

type Section = readonly [title: string, slug: string, entries: readonly string[]]

const SECTIONS: readonly Section[] = [
  ['Getting Started', 'getting-started', ['Installation', 'Project Structure']],
  ['Build Your Application', 'build', ['Routing', 'Data Fetching', 'Rendering', 'Caching']],
  ['API Reference', 'api', ['Components', 'File Conventions', 'Functions', 'CLI']],
  ['Architecture', 'architecture', ['Accessibility', 'Fast Refresh', 'Supported Browsers']],
  ['Community', 'community', ['Contribution Guide']],
]

const slugOf = (label: string): string => label.toLowerCase().replaceAll(' ', '-')

/** shadcn/ui's `sidebar-05`, composed in config. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'sidebar-05',
  shadcnBlock: 'sidebar-05',
  title: 'Sidebar 05',
  category: 'shadcn',
  tags: ['sidebar', 'navigation', 'collapsible', 'submenu', 'docs', 'search', 'shadcn'],
  description: 'A sidebar with collapsible submenus.',
  notes: [
    'The app mark and a search box head the sidebar. Each section is a row that folds and unfolds its pages; the first starts open. A section row goes nowhere itself, so it is never marked as the current page.',
    ...SHELL_NOTES,
  ],
  params: [],
  env: [],
  requires: [],
  build: ({ name }) =>
    asComponent(
      name,
      shellLayout([
        shellSidebar({
          collapsible: 'offcanvas',
          header: [
            brandRow('Documentation', 'v1.0.0', 'gallery-vertical-end', '/docs'),
            sidebarSearch('Search the docs...'),
          ],
          groups: [
            {
              items: SECTIONS.map(([label, section, entries], index) => ({
                label,
                ...(index === 0 ? { defaultExpanded: true } : {}),
                children: entries.map((page) => ({
                  label: page,
                  href: `/docs/${section}/${slugOf(page)}`,
                })),
              })),
            },
          ],
        }),
        shellInset([
          shellHeader([crumbs([['Build Your Application', '/docs/build'], ['Data Fetching']])]),
          placeholderContent(),
        ]),
      ])
    ),
})
