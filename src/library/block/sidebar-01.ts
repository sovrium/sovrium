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
  insetHeader,
  placeholderContent,
  SIDEBAR_NOTES,
  sidebarContent,
  sidebarFrame,
  sidebarInset,
  sidebarLayout,
  sidebarSearch,
  switcherRow,
} from '@/library/manifest/navigation-block-kit'

type Section = readonly [title: string, slug: string, entries: readonly string[]]

const SECTIONS: readonly Section[] = [
  ['Getting Started', 'getting-started', ['Installation', 'Project Structure']],
  [
    'Build Your Application',
    'build',
    ['Routing', 'Data Fetching', 'Rendering', 'Caching', 'Styling', 'Testing', 'Deploying'],
  ],
  ['API Reference', 'api', ['Components', 'File Conventions', 'Functions', 'CLI']],
  ['Architecture', 'architecture', ['Accessibility', 'Fast Refresh', 'Supported Browsers']],
]

const slugOf = (label: string): string => label.toLowerCase().replaceAll(' ', '-')

/** shadcn/ui's `sidebar-01`, composed in config. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'sidebar-01',
  shadcnBlock: 'sidebar-01',
  title: 'Sidebar 01',
  category: 'shadcn',
  tags: ['sidebar', 'navigation', 'app frame', 'docs', 'search', 'shadcn'],
  description: 'A simple sidebar with navigation grouped by section.',
  notes: [
    'A version switcher and a search box head the sidebar; each section is a labelled group of links. The main region opens with a breadcrumb over placeholder tiles: replace them with the page content.',
    'The version switcher is a menu of links: point each version at the address that serves it.',
    ...SIDEBAR_NOTES,
  ],
  params: [],
  env: [],
  requires: [],
  build: ({ name }) =>
    asComponent(
      name,
      sidebarLayout([
        sidebarFrame(
          sidebarContent(
            SECTIONS.map(([label, section, entries]) => ({
              label,
              items: entries.map((entryLabel) => ({
                label: entryLabel,
                href: `/docs/${section}/${slugOf(entryLabel)}`,
              })),
            }))
          ),
          {
            header: [
              switcherRow(
                'Version',
                { title: 'Documentation', subtitle: 'v1.0.1', icon: 'gallery-vertical-end' },
                [
                  ['v1.0.1', '/docs'],
                  ['v1.1.0-alpha', '/docs/next'],
                  ['v2.0.0-beta1', '/docs/beta'],
                ]
              ),
              sidebarSearch('Search the docs…'),
            ],
          }
        ),
        sidebarInset([
          insetHeader([crumbs([['Build Your Application', '/docs/build'], ['Data Fetching']])]),
          placeholderContent(),
        ]),
      ])
    ),
})
