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
  userRow,
} from '@/library/manifest/navigation-block-kit'
import {
  platformGroup,
  projectsGroup,
  secondaryGroup,
  SHELL_NOTES,
  shellHeader,
  shellInset,
  shellLayout,
  shellSidebar,
} from '@/library/manifest/sidebar-shell-block-kit'

/** shadcn/ui's `sidebar-08`, composed in config. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'sidebar-08',
  shadcnBlock: 'sidebar-08',
  title: 'Sidebar 08',
  category: 'shadcn',
  tags: ['sidebar', 'navigation', 'app frame', 'inset', 'secondary navigation', 'shadcn'],
  description: 'An inset sidebar with secondary navigation.',
  notes: [
    'The main region is raised as a rounded panel on the sidebar ground. The Platform sections unfold their pages, the projects carry a "More" control, and Support and Feedback sit under them as a secondary list; the account menu is at the foot.',
    ...SHELL_NOTES,
  ],
  params: [],
  env: [],
  requires: [],
  build: ({ name }) =>
    asComponent(
      name,
      shellLayout(
        [
          shellSidebar({
            collapsible: 'offcanvas',
            variant: 'inset',
            header: [brandRow('Acme Inc', 'Enterprise', 'command', '/')],
            groups: [platformGroup(), projectsGroup(), secondaryGroup()],
            footer: [userRow('shadcn', 'm@example.com', 'CN')],
          }),
          shellInset(
            [
              shellHeader([crumbs([['Build Your Application', '/docs'], ['Data Fetching']])]),
              placeholderContent(),
            ],
            true
          ),
        ],
        true
      )
    ),
})
