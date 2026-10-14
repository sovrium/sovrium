/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { asComponent } from '@/library/manifest/block-kit'
import { defineLibraryEntry } from '@/library/manifest/define'
import { crumbs, placeholderContent } from '@/library/manifest/navigation-block-kit'
import {
  SHELL_NOTES,
  shellHeader,
  shellInset,
  shellLayout,
  shellSidebar,
} from '@/library/manifest/sidebar-shell-block-kit'

type Section = readonly [title: string, slug: string, entries: readonly string[]]

const CONTENTS: readonly Section[] = [
  ['Getting Started', 'getting-started', ['Installation', 'Project Structure']],
  ['Build Your Application', 'build', ['Routing', 'Data Fetching', 'Rendering', 'Caching']],
  ['API Reference', 'api', ['Components', 'File Conventions', 'Functions']],
  ['Architecture', 'architecture', ['Accessibility', 'Fast Refresh']],
]

const slugOf = (label: string): string => label.toLowerCase().replaceAll(' ', '-')

/** shadcn/ui's `sidebar-14`, composed in config. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'sidebar-14',
  shadcnBlock: 'sidebar-14',
  title: 'Sidebar 14',
  category: 'shadcn',
  tags: ['sidebar', 'navigation', 'right', 'table of contents', 'docs', 'shadcn'],
  description: 'A sidebar on the right.',
  notes: [
    'The sidebar stands after the content, against the right edge, as a table of contents: each section with its pages under it. Its trigger moves it off the page.',
    ...SHELL_NOTES,
  ],
  params: [],
  env: [],
  requires: [],
  build: ({ name }) =>
    asComponent(
      name,
      shellLayout([
        shellInset([
          shellHeader(
            [crumbs([['Build Your Application', '/docs/build'], ['Data Fetching']])],
            'right'
          ),
          placeholderContent(),
        ]),
        shellSidebar({
          collapsible: 'offcanvas',
          side: 'right',
          groups: [
            {
              label: 'Table of Contents',
              items: CONTENTS.map(([label, section, entries]) => ({
                label,
                href: `/docs/${section}`,
                defaultExpanded: true,
                children: entries.map((page) => ({
                  label: page,
                  href: `/docs/${section}/${slugOf(page)}`,
                })),
              })),
            },
          ],
        }),
      ])
    ),
})
