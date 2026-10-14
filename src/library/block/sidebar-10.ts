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
  iconButtonLink,
  SIDEBAR_NOTES,
  sidebarContent,
  sidebarFrame,
  sidebarInset,
  sidebarLayout,
  switcherRow,
  tile,
} from '@/library/manifest/navigation-block-kit'
import type { BlockNode } from '@/library/manifest/block-kit'

type Entry = readonly [label: string, icon: string, href: string]

const MAIN: readonly Entry[] = [
  ['Search', 'search', '/search'],
  ['Ask AI', 'sparkles', '/ask'],
  ['Home', 'house', '/'],
  ['Inbox', 'inbox', '/inbox'],
]

const FAVORITES: readonly Entry[] = [
  ['Project Management & Task Tracking', 'chart-column', '/pages/projects'],
  ['Family Recipe Collection & Meal Planning', 'utensils', '/pages/recipes'],
  ['Fitness Tracker & Workout Routines', 'dumbbell', '/pages/fitness'],
  ['Book Notes & Reading List', 'book-open', '/pages/books'],
  ['Daily Habit Tracker & Goal Setting', 'circle-check', '/pages/habits'],
]

type Workspace = readonly [label: string, icon: string, pages: readonly Entry[]]

const WORKSPACES: readonly Workspace[] = [
  [
    'Personal Life Management',
    'house',
    [
      ['Daily Journal & Reflection', 'notebook', '/pages/journal'],
      ['Health & Wellness Tracker', 'heart-pulse', '/pages/health'],
    ],
  ],
  [
    'Professional Development',
    'briefcase',
    [
      ['Career Objectives & Milestones', 'target', '/pages/career'],
      ['Networking Contacts & Events', 'users', '/pages/network'],
    ],
  ],
  [
    'Creative Projects',
    'palette',
    [
      ['Writing Ideas & Story Outlines', 'pen-line', '/pages/writing'],
      ['Art & Design Portfolio', 'image', '/pages/portfolio'],
    ],
  ],
]

const SECONDARY: readonly Entry[] = [
  ['Calendar', 'calendar', '/calendar'],
  ['Settings', 'settings-2', '/settings'],
  ['Templates', 'blocks', '/templates'],
  ['Trash', 'trash-2', '/trash'],
  ['Help', 'message-circle-question', '/help'],
]

/** The page actions, grouped as shadcn groups them. */
const ACTIONS: readonly (readonly Entry[])[] = [
  [
    ['Customize Page', 'settings-2', '/page/customize'],
    ['Turn into wiki', 'file-text', '/page/wiki'],
  ],
  [
    ['Copy Link', 'link', '/page/link'],
    ['Duplicate', 'copy', '/page/duplicate'],
    ['Move to', 'corner-up-right', '/page/move'],
    ['Move to Trash', 'trash-2', '/page/trash'],
  ],
  [
    ['Undo', 'corner-up-left', '/page/undo'],
    ['View analytics', 'chart-line', '/page/analytics'],
    ['Version History', 'gallery-vertical-end', '/page/history'],
    ['Notifications', 'bell', '/page/notifications'],
  ],
  [
    ['Import', 'arrow-up', '/page/import'],
    ['Export', 'arrow-down', '/page/export'],
  ],
]

const item = ([label, icon, href]: Entry): Readonly<Record<string, unknown>> => ({
  label,
  icon,
  href,
})

/** The sidebar of page actions inside a popover — what the block is named for. */
const pageActions = (): BlockNode => ({
  type: 'popover',
  floatingAlign: 'end',
  children: [
    { type: 'button', variant: 'ghost', props: { label: 'More' } },
    {
      type: 'sidebar',
      props: { className: 'w-56 bg-transparent' },
      groups: ACTIONS.map((group) => ({ items: group.map(item) })),
    },
  ],
})

/** The top of the page: its title on the left, its actions on the right. */
const pageHeader = (): BlockNode => ({
  type: 'container',
  element: 'header',
  props: { className: 'flex h-14 shrink-0 items-center gap-2 px-3' },
  children: [
    {
      type: 'container',
      props: { className: 'flex min-w-0 flex-1 items-center gap-2' },
      children: [crumbs([['Project Management & Task Tracking']])],
    },
    {
      type: 'flex',
      props: { className: 'ml-auto flex items-center gap-2 text-sm' },
      children: [
        {
          type: 'text',
          element: 'span',
          props: { className: 'hidden font-medium text-muted-foreground md:inline-block' },
          content: 'Edited Oct 08',
        },
        iconButtonLink('star', 'Favorites', '/favorites'),
        pageActions(),
      ],
    },
  ],
})

/** shadcn/ui's `sidebar-10`, composed in config. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'sidebar-10',
  shadcnBlock: 'sidebar-10',
  title: 'Sidebar 10',
  category: 'shadcn',
  tags: ['sidebar', 'navigation', 'app frame', 'popover', 'workspace', 'shadcn'],
  description: 'A sidebar in a popover.',
  notes: [
    'The page header ends with More, which opens a popover holding a second sidebar: the page actions, in four groups. Point each action at the page that performs it.',
    'The app sidebar holds a team switcher, the main entries with a count beside Inbox, the favourite pages, the workspaces — each a list that folds — and the secondary entries.',
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
              items: MAIN.map(([label, icon, href]) =>
                label === 'Inbox'
                  ? { ...item([label, icon, href]), badge: '10' }
                  : item([label, icon, href])
              ),
            },
            { label: 'Favorites', items: FAVORITES.map(item) },
            {
              label: 'Workspaces',
              items: WORKSPACES.map(([label, icon, pages]) => ({
                label,
                icon,
                children: pages.map(item),
              })),
            },
            { items: SECONDARY.map(item) },
          ]),
          {
            header: [
              switcherRow('Team', { title: 'Acme Inc', subtitle: 'Enterprise', icon: 'terminal' }, [
                ['Acme Inc', '/teams/acme-inc'],
                ['Acme Corp.', '/teams/acme-corp'],
                ['Evil Corp.', '/teams/evil-corp'],
              ]),
            ],
          }
        ),
        sidebarInset([
          pageHeader(),
          {
            type: 'flex',
            props: { className: 'flex flex-1 flex-col gap-4 px-4 py-10' },
            children: [
              tile('mx-auto h-24 w-full max-w-3xl'),
              tile('mx-auto min-h-96 w-full max-w-3xl flex-1'),
            ],
          },
        ]),
      ])
    ),
})
