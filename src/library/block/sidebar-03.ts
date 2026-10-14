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
  insetHeader,
  placeholderContent,
  SIDEBAR_NOTES,
  sidebarContent,
  sidebarFrame,
  sidebarInset,
  sidebarLayout,
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
  ['Community', 'community', ['Contribution Guide']],
]

const slugOf = (label: string): string => label.toLowerCase().replaceAll(' ', '-')

/** shadcn/ui's `sidebar-03`, composed in config. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'sidebar-03',
  shadcnBlock: 'sidebar-03',
  title: 'Sidebar 03',
  category: 'shadcn',
  tags: ['sidebar', 'navigation', 'app frame', 'submenu', 'docs', 'shadcn'],
  description: 'A sidebar with submenus.',
  notes: [
    'The app mark heads the sidebar. Each section is a link with its pages listed under it, indented behind a rule; every list starts open, and its chevron folds it.',
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
          sidebarContent([
            {
              items: SECTIONS.map(([label, section, entries]) => ({
                label,
                href: `/docs/${section}`,
                defaultExpanded: true,
                children: entries.map((entryLabel) => ({
                  label: entryLabel,
                  href: `/docs/${section}/${slugOf(entryLabel)}`,
                })),
              })),
            },
          ]),
          { header: [brandRow('Documentation', 'v1.0.0', 'gallery-vertical-end', '/docs')] }
        ),
        sidebarInset([
          insetHeader([crumbs([['Build Your Application', '/docs/build'], ['Data Fetching']])]),
          placeholderContent(),
        ]),
      ])
    ),
})
