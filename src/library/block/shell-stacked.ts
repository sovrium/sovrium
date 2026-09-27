/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  accountMenu,
  appHeader,
  appTitle,
  menuButton,
  menuLink,
  menuPanel,
  para,
  slot,
} from '@/library/manifest/app-block-kit'
import {
  asComponent,
  flex,
  grid,
  logo,
  navLink,
  param,
  PLACE_NOTE,
  stack,
  stringParam,
  THEME_NOTE,
} from '@/library/manifest/block-kit'
import { defineLibraryEntry } from '@/library/manifest/define'

const LINKS: readonly (readonly [string, string])[] = [
  ['Overview', '/'],
  ['Invoices', '/invoices'],
  ['Clients', '/clients'],
  ['Reports', '/reports'],
]

const topBar = (brand: string, menuId: string): readonly Readonly<Record<string, unknown>>[] => [
  appHeader(
    [
      logo(brand),
      {
        type: 'container',
        element: 'nav',
        props: { 'aria-label': 'Main', className: 'hidden items-center gap-6 md:flex' },
        children: LINKS.map(([label, href]) => navLink(label, href)),
      },
      flex(
        [
          {
            type: 'search-input',
            scope: 'page',
            props: {
              placeholder: 'Search',
              'aria-label': 'Search',
              className: 'hidden w-56 lg:flex',
            },
          },
          accountMenu([
            ['Overview', 'house', '/'],
            ['Invoices', 'file-text', '/invoices'],
            ['Settings', 'settings', '/settings'],
          ]),
          menuButton(menuId),
        ],
        'items-center gap-2'
      ),
    ],
    'h-16 gap-6'
  ),
  menuPanel(menuId, [
    {
      type: 'container',
      element: 'nav',
      props: { 'aria-label': 'Main', className: 'flex flex-col px-4' },
      children: LINKS.map(([label, href]) => menuLink(label, href)),
    },
  ]),
]

/** An application frame with the navigation across the top. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'shell-stacked',
  title: 'Stacked application shell',
  category: 'application',
  tags: ['shell', 'layout', 'top bar', 'app frame', 'navigation'],
  description:
    'An application frame with the navigation across the top: logo, four sections, search and an account menu, then a page heading band and the content region.',
  notes: [
    PLACE_NOTE,
    THEME_NOTE,
    'Below the medium breakpoint the section links move into a panel the menu button opens under the bar. Replace the dashed slots with the page content.',
    'The search box searches the public pages of the app (`scope: page`); bind it to a list instead with `scope: subscribers`.',
  ],
  params: [
    stringParam('brand', 'The app name beside the logo mark.', '[App]'),
    stringParam('title', 'The page heading.', 'Overview'),
    stringParam(
      'description',
      'One line under the page heading.',
      'This week, across every client.'
    ),
  ],
  env: [],
  requires: [],
  build: ({ name, params }) => {
    const p = param(params)
    return asComponent(name, {
      type: 'container',
      props: { className: 'w-full' },
      children: [
        ...topBar(p('brand'), `${name}-menu`),
        {
          type: 'container',
          props: { className: 'border-b border-border px-4 py-7 sm:px-8' },
          children: [
            stack(
              [appTitle(p('title')), para(p('description'), 'text-md text-foreground-muted')],
              'gap-1'
            ),
          ],
        },
        {
          type: 'container',
          element: 'main',
          props: { className: 'px-4 py-8 sm:px-8' },
          children: [
            grid(
              [slot('[Summary]', 'h-32'), slot('[Summary]', 'h-32'), slot('[Summary]', 'h-32')],
              'gap-6 md:grid-cols-3'
            ),
            slot('[Page content]', 'mt-6 h-56'),
          ],
        },
      ],
    })
  },
})
