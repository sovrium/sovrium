/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { asComponent, type BlockNode } from '@/library/manifest/block-kit'
import { defineLibraryEntry } from '@/library/manifest/define'
import { crumbs, sidebarSearch, userRow } from '@/library/manifest/navigation-block-kit'
import {
  shellHeader,
  shellInset,
  shellLayout,
  shellSidebar,
} from '@/library/manifest/sidebar-shell-block-kit'

type Folder = readonly [label: string, icon: string]

/** shadcn's demo folders; the first is the one open. */
const FOLDERS: readonly Folder[] = [
  ['Inbox', 'inbox'],
  ['Drafts', 'file'],
  ['Sent', 'send'],
  ['Junk', 'archive-x'],
  ['Trash', 'trash-2'],
]

type Mail = readonly [name: string, date: string, subject: string, teaser: string]

/** shadcn's demo mails, in its order. */
const MAILS: readonly Mail[] = [
  [
    'William Smith',
    '09:34 AM',
    'Meeting Tomorrow',
    'Hi team, just a reminder about our meeting tomorrow at 10 AM.\nPlease come prepared with your project updates.',
  ],
  [
    'Alice Smith',
    'Yesterday',
    'Re: Project Update',
    "Thanks for the update. The progress looks great so far.\nLet's schedule a call to discuss the next steps.",
  ],
  [
    'Bob Johnson',
    '2 days ago',
    'Weekend Plans',
    "Hey everyone! I'm thinking of organizing a team outing this weekend.\nWould you be interested in a hiking trip or a beach day?",
  ],
  [
    'Emily Davis',
    '2 days ago',
    'Re: Question about Budget',
    "I've reviewed the budget numbers you sent over.\nCan we set up a quick call to discuss some potential adjustments?",
  ],
  [
    'Michael Wilson',
    '1 week ago',
    'Important Announcement',
    "Please join us for an all-hands meeting this Friday at 3 PM.\nWe have some exciting news to share about the company's future.",
  ],
  [
    'Sarah Brown',
    '1 week ago',
    'Re: Feedback on Proposal',
    "Thank you for sending over the proposal. I've reviewed it and have some thoughts.\nCould we schedule a meeting to discuss my feedback in detail?",
  ],
  [
    'David Lee',
    '1 week ago',
    'New Project Idea',
    "I've been brainstorming and came up with an interesting project concept.\nDo you have time this week to discuss its potential impact and feasibility?",
  ],
  [
    'Olivia Wilson',
    '1 week ago',
    'Vacation Plans',
    "Just a heads up that I'll be taking a two-week vacation next month.\nI'll make sure all my projects are up to date before I leave.",
  ],
  [
    'James Martin',
    '1 week ago',
    'Re: Conference Registration',
    "I've completed the registration for the upcoming tech conference.\nLet me know if you need any additional information from my end.",
  ],
  [
    'Sophia White',
    '1 week ago',
    'Team Dinner',
    "To celebrate our recent project success, I'd like to organize a team dinner.\nAre you available next Friday evening? Please let me know your preferences.",
  ],
]

const slugOf = (label: string): string => label.toLowerCase().replaceAll(' ', '-')

/** `SidebarMenuButton` sized to the rail: the glyph alone, its name in a tooltip. */
const RAIL_BUTTON =
  'flex size-8 shrink-0 items-center justify-center rounded-md text-sidebar-foreground no-underline outline-hidden hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:no-underline focus-visible:ring-2 focus-visible:ring-sidebar-ring aria-[current=page]:bg-sidebar-accent aria-[current=page]:font-medium aria-[current=page]:text-sidebar-accent-foreground [&_svg]:size-4 [&_svg]:shrink-0'

/** One folder in the rail; its name stays in the tooltip whether the sidebar is open or folded. */
const railEntry = ([label, icon]: Folder, index: number): BlockNode => ({
  type: 'tooltip',
  tooltipContent: label,
  floatingSide: 'right',
  children: [
    {
      type: 'link',
      props: {
        href: `/mail/${slugOf(label)}`,
        'aria-label': label,
        ...(index === 0 ? { 'aria-current': 'page' } : {}),
        className: RAIL_BUTTON,
      },
      children: [{ type: 'icon', props: { name: icon, size: 16 } }],
    },
  ],
})

/** The team mark at the head of the rail. */
const railMark = (): BlockNode => ({
  type: 'link',
  props: {
    href: '/',
    'aria-label': 'Acme Inc',
    className:
      'flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground no-underline hover:no-underline [&_svg]:size-4',
  },
  children: [{ type: 'icon', props: { name: 'terminal', size: 16 } }],
})

/** The first sidebar: a strip one icon wide that never folds further. */
const rail = (): BlockNode => ({
  type: 'flex',
  props: {
    className:
      'flex h-full w-[calc(var(--sidebar-width-icon)+1px)] shrink-0 flex-col overflow-hidden border-r border-sidebar-border',
  },
  children: [
    { type: 'container', props: { className: 'flex flex-col gap-2 p-2' }, children: [railMark()] },
    {
      type: 'container',
      element: 'nav',
      props: { 'aria-label': 'Folders', className: 'flex flex-col items-center gap-1 p-2' },
      children: FOLDERS.map(railEntry),
    },
    {
      type: 'container',
      props: { className: 'mt-auto flex flex-col gap-2 p-2 [&>*]:h-8 [&>*]:p-0' },
      children: [userRow('shadcn', 'm@example.com', 'CN')],
    },
  ],
})

/** The open folder's heading, its unread filter and its search. */
const paneHeader = (name: string): BlockNode => ({
  type: 'container',
  props: { className: 'flex flex-col gap-3.5 border-b border-sidebar-border p-4' },
  children: [
    {
      type: 'flex',
      props: { className: 'flex w-full items-center justify-between' },
      children: [
        {
          type: 'text',
          element: 'p',
          props: { className: 'text-base font-medium text-foreground' },
          content: 'Inbox',
        },
        {
          type: 'flex',
          props: { className: 'flex items-center gap-2 text-sm' },
          children: [
            { type: 'label', text: 'Unreads', for: `${name}-unreads` },
            { type: 'switch', props: { id: `${name}-unreads`, className: 'shadow-none' } },
          ],
        },
      ],
    },
    sidebarSearch('Type to search...'),
  ],
})

/** One mail: sender and date, subject, two lines of the message. */
const mailRow = ([sender, date, subject, teaser]: Mail): BlockNode => ({
  type: 'link',
  props: {
    href: `/mail/inbox/${slugOf(sender)}`,
    className:
      'flex flex-col items-start gap-2 border-b border-sidebar-border p-4 text-sm leading-tight whitespace-nowrap text-sidebar-foreground no-underline last:border-b-0 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:no-underline',
  },
  children: [
    {
      type: 'flex',
      props: { className: 'flex w-full items-center gap-2' },
      children: [
        { type: 'text', element: 'span', content: sender },
        { type: 'text', element: 'span', props: { className: 'ml-auto text-xs' }, content: date },
      ],
    },
    { type: 'text', element: 'span', props: { className: 'font-medium' }, content: subject },
    {
      type: 'text',
      element: 'span',
      props: { className: 'line-clamp-2 w-[260px] text-xs whitespace-break-spaces' },
      content: teaser,
    },
  ],
})

/** The second sidebar: the open folder's mails, filling the rest of the width. */
const pane = (name: string): BlockNode => ({
  type: 'flex',
  props: { className: 'hidden h-full min-w-0 flex-1 flex-col md:flex' },
  children: [
    paneHeader(name),
    {
      type: 'container',
      props: { className: 'flex min-h-0 flex-1 flex-col overflow-auto' },
      children: MAILS.map(mailRow),
    },
  ],
})

/** shadcn's demo content: twenty-four quiet rows. */
const insetRows = (): BlockNode => ({
  type: 'flex',
  props: { className: 'flex flex-1 flex-col gap-4 p-4' },
  children: Array.from({ length: 24 }, () => ({
    type: 'container',
    props: { className: 'aspect-video h-12 w-full rounded-lg bg-muted/50' },
  })),
})

const sidebar = (name: string): BlockNode => ({
  ...shellSidebar({
    collapsible: 'icon',
    extra: '[--sidebar-width:350px]',
    children: [
      {
        type: 'flex',
        props: { className: 'flex h-full w-full flex-row overflow-hidden' },
        children: [rail(), pane(name)],
      },
    ],
  }),
  persist: 'none',
})

/** shadcn/ui's `sidebar-09`, composed in config. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'sidebar-09',
  shadcnBlock: 'sidebar-09',
  title: 'Sidebar 09',
  category: 'shadcn',
  tags: ['sidebar', 'navigation', 'two sidebars', 'collapsible', 'icons', 'mail', 'shadcn'],
  description: 'Collapsible nested sidebars.',
  notes: [
    'Two sidebars side by side inside one: a strip of folder icons, each naming itself in a tooltip, beside the open folder with an unread filter, a search and its mails. Folded, only the strip of icons stays.',
    'Each folder is a link: give every folder its own page and the strip marks the one you are on. A reload serves the sidebar open, as the block it mirrors does.',
    'Place it on a page with `component: <name>`. It fills the page: the sidebar and the main region beside it.',
    'Colours come from the `sidebar` roles of your `design`, so the block follows it without edits.',
    'Below the medium breakpoint the strip of folders moves into a sheet a menu button opens. Edit the folders and the mails in the installed fragment.',
  ],
  params: [],
  env: [],
  requires: [],
  build: ({ name }) =>
    asComponent(
      name,
      shellLayout([
        sidebar(name),
        shellInset([shellHeader([crumbs([['All Inboxes', '/mail'], ['Inbox']])]), insetRows()]),
      ])
    ),
})
