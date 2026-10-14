/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { asComponent } from '@/library/manifest/block-kit'
import { defineLibraryEntry } from '@/library/manifest/define'
import {
  crumbs,
  placeholderContent,
  sidebarSearch,
  switcherRow,
} from '@/library/manifest/navigation-block-kit'
import {
  contentColumn,
  foldingGroup,
  rowLink,
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

/** shadcn/ui's `sidebar-02`, composed in config. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'sidebar-02',
  shadcnBlock: 'sidebar-02',
  title: 'Sidebar 02',
  category: 'shadcn',
  tags: ['sidebar', 'navigation', 'collapsible', 'sections', 'docs', 'version', 'shadcn'],
  description: 'A sidebar with collapsible sections.',
  notes: [
    'A version switcher and a search box head the sidebar. Each section is a heading that folds the pages under it; every section starts open.',
    "The sections are `collapsible` components holding links, so a reader without scripts still folds them with the browser's own disclosure.",
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
            switcherRow(
              'Switch version',
              { title: 'Documentation', subtitle: 'v1.0.1', icon: 'gallery-vertical-end' },
              [
                ['v1.0.1', '/docs'],
                ['v1.1.0-alpha', '/docs/1.1.0-alpha'],
                ['v2.0.0-beta1', '/docs/2.0.0-beta1'],
              ]
            ),
            sidebarSearch('Search the docs...'),
          ],
          children: [
            contentColumn(
              SECTIONS.map(([label, section, entries]) =>
                foldingGroup(
                  label,
                  entries.map((page) => rowLink(page, `/docs/${section}/${slugOf(page)}`))
                )
              )
            ),
          ],
        }),
        shellInset([
          shellHeader([crumbs([['Build Your Application', '/docs/build'], ['Data Fetching']])]),
          placeholderContent(),
        ]),
      ])
    ),
})
