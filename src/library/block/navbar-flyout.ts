/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { menuLink, menuButton, menuPanel, span } from '@/library/manifest/app-block-kit'
import {
  asComponent,
  flex,
  linkButton,
  logo,
  param,
  PLACE_NOTE,
  stringParam,
  THEME_NOTE,
} from '@/library/manifest/block-kit'
import { defineLibraryEntry } from '@/library/manifest/define'

const ITEMS: readonly (readonly [string, string, string])[] = [
  ['file-text', '[Item]', '/product/one'],
  ['workflow', '[Item]', '/product/two'],
  ['users', '[Item]', '/product/three'],
  ['chart-column', '[Item]', '/product/four'],
]

const flyout = (menuLabel: string, itemLine: string): Readonly<Record<string, unknown>> => ({
  type: 'navigation-menu',
  openOnHover: true,
  props: { 'aria-label': 'Main', className: 'hidden md:flex' },
  navItems: [
    {
      label: menuLabel,
      children: ITEMS.map(([iconName, label, href]) => ({
        label,
        href,
        icon: iconName,
        description: itemLine,
      })),
    },
    { label: '[Pricing]', href: '/pricing' },
    { label: '[Docs]', href: '/docs' },
  ],
})

/** The site's top bar with a mega-menu under its first entry. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'navbar-flyout',
  title: 'Site header with a flyout menu',
  category: 'marketing',
  tags: ['header', 'navbar', 'mega menu', 'flyout', 'navigation'],
  description:
    'The site top bar with a flyout under its first entry: four destinations, each with an icon and one line on what it does.',
  notes: [
    PLACE_NOTE,
    THEME_NOTE,
    'The flyout is a `navigation-menu`: each child item carries a `description` and an `icon`. It opens on click and on hover, and closes with Escape.',
    'Below the medium breakpoint the same destinations are listed in a panel the menu button opens under the bar.',
  ],
  params: [
    stringParam('brand', 'The product name beside the logo mark.', '[Product]'),
    stringParam('menuLabel', 'The label of the entry that opens the flyout.', '[Product]'),
    stringParam(
      'itemLine',
      'The line under each flyout destination.',
      '[One line on what it does]'
    ),
    stringParam('ctaLabel', 'The text of the primary action.', '[Primary action]'),
    stringParam('ctaHref', 'Where the primary action points.', '/contact'),
  ],
  env: [],
  requires: [],
  build: ({ name, params }) => {
    const p = param(params)
    const menuId = `${name}-menu`
    return asComponent(name, {
      type: 'container',
      element: 'header',
      props: { className: 'border-b border-border bg-background px-5 sm:px-8 lg:px-16' },
      children: [
        flex(
          [
            logo(p('brand')),
            flyout(p('menuLabel'), p('itemLine')),
            flex([linkButton(p('ctaLabel'), p('ctaHref'))], 'hidden md:flex'),
            menuButton(menuId),
          ],
          'mx-auto h-16 w-full max-w-6xl items-center justify-between gap-6'
        ),
        menuPanel(menuId, [
          {
            type: 'container',
            element: 'nav',
            props: { 'aria-label': 'Main', className: 'flex flex-col' },
            children: [
              span(
                p('menuLabel'),
                'border-b border-border py-3 text-lg font-medium text-foreground'
              ),
              ...ITEMS.map(([, label, href]) => menuLink(label, href, true)),
              menuLink('[Pricing]', '/pricing'),
              menuLink('[Docs]', '/docs'),
            ],
          },
          flex([linkButton(p('ctaLabel'), p('ctaHref'))], 'mt-6 flex-col'),
        ]),
      ],
    })
  },
})
