/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { asComponent, flex, THEME_NOTE } from '@/library/manifest/block-kit'
import { defineLibraryEntry } from '@/library/manifest/define'

const SIDEBAR: Readonly<Record<string, unknown>> = {
  type: 'sidebar',
  rail: { below: 'md' },
  props: {
    className: 'flex-none border-r border-border bg-background-subtle py-4 md:w-60 md:px-2',
  },
  groups: [
    {
      label: 'Workspace',
      items: [
        { label: 'Overview', href: '/', icon: 'house' },
        {
          label: 'Invoices',
          href: '/invoices',
          icon: 'file-text',
          badge: '12',
          activeMatch: 'prefix',
        },
        { label: 'Clients', href: '/clients', icon: 'users', activeMatch: 'prefix' },
        {
          label: 'Automations',
          href: '/automations',
          icon: 'workflow',
          activeMatch: 'prefix',
        },
        {
          label: 'Reports',
          href: '/reports',
          icon: 'chart-column',
          activeMatch: 'prefix',
        },
      ],
    },
    {
      label: 'Settings',
      items: [
        { label: 'General', href: '/settings', icon: 'settings' },
        { label: 'Members', href: '/settings/members', icon: 'users' },
      ],
    },
  ],
}

/**
 * The frame every screen of an app sits in: a navigation rail and a main region
 * whose content is the page's own — the main region is the template's slot, so
 * the shell is declared once and each page places it with its components.
 */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'shell-sidebar',
  title: 'Application shell with a sidebar',
  category: 'application',
  tags: ['shell', 'layout', 'sidebar', 'app frame', 'navigation', 'slot'],
  description:
    "An application frame: a sidebar with grouped, iconed entries and a count, beside a main region that holds each page's own components.",
  notes: [
    "Place it on every page of the app with `- component: shell-sidebar` and give it the page's components as `children:` — they fill the main region, where the template writes `children: $children`.",
    THEME_NOTE,
    'The sidebar entries mark themselves current from the request path, so the same shell can sit on every page of the app. Edit `groups` in the installed fragment to list your own pages.',
    'Below the medium breakpoint the sidebar shrinks to an icon rail (`rail: { below: md }`).',
    "The page's components are read in the page's scope: a page bound to a record shows that record inside the shell.",
  ],
  params: [],
  env: [],
  requires: [],
  build: ({ name }) =>
    asComponent(
      name,
      flex(
        [
          SIDEBAR,
          {
            type: 'container',
            element: 'main',
            props: { className: 'min-w-0 flex-1 px-4 py-6 sm:px-10 sm:py-8' },
            children: '$children',
          },
        ],
        'min-h-[40rem] w-full items-stretch'
      )
    ),
})
