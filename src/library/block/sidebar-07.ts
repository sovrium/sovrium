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
  switcherRow,
  userRow,
} from '@/library/manifest/navigation-block-kit'
import {
  platformGroup,
  projectsGroup,
  SHELL_NOTES,
  shellHeader,
  shellInset,
  shellLayout,
  shellSidebar,
} from '@/library/manifest/sidebar-shell-block-kit'

/** shadcn/ui's `sidebar-07`, composed in config. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'sidebar-07',
  shadcnBlock: 'sidebar-07',
  title: 'Sidebar 07',
  category: 'shadcn',
  tags: ['sidebar', 'navigation', 'app frame', 'collapsible', 'icons', 'shadcn'],
  description: 'A sidebar that collapses to icons.',
  notes: [
    'A team switcher heads the sidebar and the account menu sits at its foot. The Platform sections unfold their pages; each project carries its own "More" control. Folded, the sidebar keeps a strip of icons whose links keep their names.',
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
          collapsible: 'icon',
          railHandle: true,
          header: [
            switcherRow(
              'Switch team',
              { title: 'Acme Inc', subtitle: 'Enterprise', icon: 'gallery-vertical-end' },
              [
                ['Acme Inc', '/teams/acme-inc'],
                ['Acme Corp.', '/teams/acme-corp'],
                ['Evil Corp.', '/teams/evil-corp'],
              ]
            ),
          ],
          groups: [platformGroup(), projectsGroup()],
          footer: [userRow('shadcn', 'm@example.com', 'CN')],
        }),
        shellInset([
          shellHeader([crumbs([['Build Your Application', '/docs'], ['Data Fetching']])]),
          placeholderContent(),
        ]),
      ])
    ),
})
