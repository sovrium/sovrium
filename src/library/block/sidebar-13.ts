/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { asComponent } from '@/library/manifest/block-kit'
import { defineLibraryEntry } from '@/library/manifest/define'
import { crumbs, tile } from '@/library/manifest/navigation-block-kit'
import type { BlockNode } from '@/library/manifest/block-kit'

const SECTIONS: readonly (readonly [label: string, icon: string, slug: string])[] = [
  ['Notifications', 'bell', 'notifications'],
  ['Navigation', 'menu', 'navigation'],
  ['Home', 'house', 'home'],
  ['Appearance', 'paintbrush', 'appearance'],
  ['Messages & media', 'message-circle', 'messages'],
  ['Language & region', 'globe', 'language'],
  ['Accessibility', 'keyboard', 'accessibility'],
  ['Mark as read', 'check', 'mark-as-read'],
  ['Audio & video', 'video', 'audio-video'],
  ['Connected accounts', 'link', 'connected-accounts'],
  ['Privacy & visibility', 'lock', 'privacy'],
  ['Advanced', 'settings', 'advanced'],
]

/** The panel beside the sidebar: where the reader is, then the section's settings. */
const settingsPanel = (): BlockNode => ({
  type: 'container',
  element: 'div',
  props: { className: 'flex h-[480px] min-w-0 flex-1 flex-col overflow-hidden' },
  children: [
    {
      type: 'container',
      element: 'header',
      props: { className: 'flex h-16 shrink-0 items-center gap-2 px-4' },
      children: [crumbs([['Settings', '/settings'], ['Messages & media']])],
    },
    {
      type: 'flex',
      props: { className: 'flex flex-1 flex-col gap-4 overflow-y-auto p-4 pt-0' },
      children: Array.from({ length: 4 }, () => tile('aspect-video w-full max-w-3xl')),
    },
  ],
})

/** shadcn/ui's `sidebar-13`, composed in config. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'sidebar-13',
  shadcnBlock: 'sidebar-13',
  title: 'Sidebar 13',
  category: 'shadcn',
  tags: ['sidebar', 'navigation', 'dialog', 'settings', 'shadcn'],
  description: 'A sidebar in a dialog.',
  notes: [
    'A button opens a settings dialog: a sidebar of twelve sections beside the panel of the one being read. The dialog is named after the installed block, so two installs never share one.',
    'Each section links to its own address under `/settings`; the entry for the page being viewed is marked current. Edit the sections in the installed fragment.',
    'Below the medium breakpoint the sidebar is left out of the dialog and the panel takes its width, as shadcn draws it.',
    'Colours come from the `sidebar` roles of your `design`, so the block follows it without edits.',
  ],
  params: [],
  env: [],
  requires: [],
  build: ({ name }) => {
    const dialogId = `${name}-settings`
    return asComponent(name, {
      type: 'flex',
      props: { className: 'flex min-h-96 w-full items-center justify-center' },
      children: [
        {
          type: 'button',
          props: { label: 'Open Dialog', interactions: { click: { modal: dialogId } } },
        },
        {
          type: 'dialog',
          props: {
            id: dialogId,
            title: 'Settings',
            description: 'Customize your settings here.',
            className: 'overflow-hidden md:max-h-[500px] md:max-w-[700px] lg:max-w-[800px]',
          },
          children: [
            {
              type: 'flex',
              props: { className: 'flex items-stretch' },
              children: [
                {
                  type: 'sidebar',
                  props: { className: 'hidden w-56 flex-none md:flex' },
                  groups: [
                    {
                      items: SECTIONS.map(([label, icon, slug]) => ({
                        label,
                        icon,
                        href: `/settings/${slug}`,
                      })),
                    },
                  ],
                },
                settingsPanel(),
              ],
            },
          ],
        },
      ],
    })
  },
})
