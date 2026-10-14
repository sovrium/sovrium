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
  SIDEBAR_NOTES,
  sidebarContent,
  sidebarFrame,
  sidebarInset,
  sidebarLayout,
  sidebarSearch,
  userRow,
} from '@/library/manifest/navigation-block-kit'
import type { BlockNode } from '@/library/manifest/block-kit'

type Entry = readonly [label: string, icon: string, href: string]

const PLATFORM: readonly (readonly [
  label: string,
  icon: string,
  slug: string,
  pages: readonly string[],
])[] = [
  ['Playground', 'square-terminal', 'playground', ['History', 'Starred', 'Settings']],
  ['Models', 'bot', 'models', ['Genesis', 'Explorer', 'Quantum']],
  ['Documentation', 'book-open', 'docs', ['Introduction', 'Get Started', 'Tutorials', 'Changelog']],
  ['Settings', 'settings-2', 'settings', ['General', 'Team', 'Billing', 'Limits']],
]

const PROJECTS: readonly Entry[] = [
  ['Design Engineering', 'frame', '/projects/design-engineering'],
  ['Sales & Marketing', 'chart-pie', '/projects/sales-marketing'],
  ['Travel', 'map', '/projects/travel'],
]

const SECONDARY: readonly Entry[] = [
  ['Support', 'life-buoy', '/support'],
  ['Feedback', 'send', '/feedback'],
]

const slugOf = (label: string): string => label.toLowerCase().replaceAll(' ', '-')

const item = ([label, icon, href]: Entry): Readonly<Record<string, unknown>> => ({
  label,
  icon,
  href,
})

/** The site header across the top, held in view while the page scrolls. */
const siteHeader = (): BlockNode => ({
  type: 'container',
  element: 'header',
  props: {
    className: 'sticky top-0 z-50 flex w-full items-center border-b border-border bg-background',
  },
  children: [
    {
      type: 'flex',
      props: { className: 'flex h-14 w-full items-center gap-2 px-4' },
      children: [
        {
          type: 'container',
          props: { className: 'hidden sm:block' },
          children: [crumbs([['Build Your Application', '/docs'], ['Data Fetching']])],
        },
        sidebarSearch('Type to search…', 'sm:ml-auto sm:w-64'),
      ],
    },
  ],
})

/** shadcn/ui's `sidebar-16`, composed in config. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'sidebar-16',
  shadcnBlock: 'sidebar-16',
  title: 'Sidebar 16',
  category: 'shadcn',
  tags: ['sidebar', 'navigation', 'app frame', 'header', 'sticky', 'account', 'shadcn'],
  description: 'A sidebar with a sticky site header.',
  notes: [
    'A site header with a breadcrumb and a search box runs across the top and stays in view while the page scrolls; the sidebar sits under it.',
    'The sidebar holds the app mark, a Platform group whose entries each fold a list of pages, a Projects group, two secondary entries, and the account at its foot, which opens a menu with Log out.',
    ...SIDEBAR_NOTES,
  ],
  params: [],
  env: [],
  requires: [],
  build: ({ name }) =>
    asComponent(name, {
      type: 'container',
      props: { className: 'flex w-full flex-col' },
      children: [
        siteHeader(),
        sidebarLayout(
          [
            sidebarFrame(
              sidebarContent([
                {
                  label: 'Platform',
                  items: PLATFORM.map(([label, icon, slug, pages], index) => ({
                    label,
                    icon,
                    href: `/${slug}`,
                    ...(index === 0 ? { defaultExpanded: true } : {}),
                    children: pages.map((page) => ({
                      label: page,
                      href: `/${slug}/${slugOf(page)}`,
                    })),
                  })),
                },
                { label: 'Projects', items: PROJECTS.map(item) },
                { items: SECONDARY.map(item) },
              ]),
              {
                header: [brandRow('Acme Inc', 'Enterprise', 'terminal')],
                footer: [userRow('shadcn', 'm@example.com', 'CN')],
              },
              'md:sticky md:top-14 md:h-[calc(100svh-3.5rem)] md:self-start'
            ),
            sidebarInset([placeholderContent()]),
          ],
          'min-h-[calc(100svh-3.5rem)]'
        ),
      ],
    }),
})
