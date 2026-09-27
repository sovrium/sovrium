/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { appTitle, para, plainButton, slot } from '@/library/manifest/app-block-kit'
import {
  asComponent,
  flex,
  param,
  PLACE_NOTE,
  stack,
  stringParam,
  THEME_NOTE,
} from '@/library/manifest/block-kit'
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

/** The frame every screen of an app sits in: a navigation rail and a main region. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'shell-sidebar',
  title: 'Application shell with a sidebar',
  category: 'application',
  tags: ['shell', 'layout', 'sidebar', 'app frame', 'navigation'],
  description:
    'An application frame: a sidebar with grouped, iconed entries and a count, beside a main region holding the page heading and a slot for its content.',
  notes: [
    PLACE_NOTE,
    THEME_NOTE,
    'The sidebar entries mark themselves current from the request path, so the same shell can sit on every page of the app. Edit `groups` in the installed fragment to list your own pages.',
    'Below the medium breakpoint the sidebar shrinks to an icon rail (`rail: { below: md }`).',
    'Replace the dashed content slot with the components of the page.',
  ],
  params: [
    stringParam('title', 'The page heading in the main region.', 'Invoices'),
    stringParam(
      'description',
      'One line under the page heading.',
      'Everything billed this quarter.'
    ),
  ],
  env: [],
  requires: [],
  build: ({ name, params }) => {
    const p = param(params)
    return asComponent(
      name,
      flex(
        [
          SIDEBAR,
          {
            type: 'container',
            element: 'main',
            props: { className: 'min-w-0 flex-1 px-4 py-6 sm:px-10 sm:py-8' },
            children: [
              flex(
                [
                  stack(
                    [appTitle(p('title')), para(p('description'), 'text-md text-foreground-muted')],
                    'gap-1'
                  ),
                  flex(
                    [plainButton('Export', 'outline'), plainButton('New invoice')],
                    'items-center gap-2'
                  ),
                ],
                'flex-col gap-4 sm:flex-row sm:items-start sm:justify-between'
              ),
              slot('[Page content]', 'mt-6 h-72'),
            ],
          },
        ],
        'min-h-[40rem] w-full items-stretch'
      )
    )
  },
})
