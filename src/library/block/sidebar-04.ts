/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { asComponent } from '@/library/manifest/block-kit'
import { defineLibraryEntry } from '@/library/manifest/define'
import { brandRow, crumbs, placeholderContent } from '@/library/manifest/navigation-block-kit'
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

/** shadcn/ui's `sidebar-04`, composed in config. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'sidebar-04',
  shadcnBlock: 'sidebar-04',
  title: 'Sidebar 04',
  category: 'shadcn',
  tags: ['sidebar', 'navigation', 'app frame', 'floating', 'submenu', 'docs', 'shadcn'],
  description: 'A floating sidebar with submenus.',
  notes: [
    'The sidebar stands off the page edge as a rounded panel. Each section is a link with its pages listed under it, all open; the trigger moves the panel off the page and gives its width to the content.',
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
          variant: 'floating',
          header: [brandRow('Documentation', 'v1.0.0', 'gallery-vertical-end', '/docs')],
          groups: [
            {
              items: SECTIONS.map(([label, section, entries]) => ({
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
        shellInset([
          shellHeader([crumbs([['Build Your Application', '/docs/build'], ['Data Fetching']])]),
          placeholderContent(),
        ]),
      ])
    ),
})
