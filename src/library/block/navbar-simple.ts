/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { menuLink, menuButton, menuPanel } from '@/library/manifest/app-block-kit'
import {
  asComponent,
  flex,
  linkButton,
  logo,
  navLink,
  param,
  PLACE_NOTE,
  stringParam,
  THEME_NOTE,
} from '@/library/manifest/block-kit'
import { defineLibraryEntry } from '@/library/manifest/define'

const LINKS: readonly (readonly [string, string])[] = [
  ['[Product]', '/product'],
  ['[Pricing]', '/pricing'],
  ['[Docs]', '/docs'],
  ['[Company]', '/company'],
]

/** The site's top bar, with a menu panel below the medium breakpoint. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'navbar-simple',
  title: 'Simple site header',
  category: 'marketing',
  tags: ['header', 'navbar', 'navigation', 'menu'],
  description:
    'The site top bar: a logo, four links, a sign-in link and one primary action, collapsing into a menu panel on a phone.',
  notes: [
    PLACE_NOTE,
    THEME_NOTE,
    'Below the medium breakpoint the links and actions move into a panel the menu button opens under the bar. The panel is named after the installed block, so two installs never share one.',
    'The header scrolls with the page: no component offers sticky or fixed positioning today.',
  ],
  params: [
    stringParam('brand', 'The product name beside the logo mark.', '[Product]'),
    stringParam('signInLabel', 'The text of the sign-in link.', 'Sign in'),
    stringParam('signInHref', 'Where the sign-in link points.', '/login'),
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
            {
              type: 'container',
              element: 'nav',
              props: { 'aria-label': 'Main', className: 'hidden items-center gap-8 md:flex' },
              children: LINKS.map(([label, href]) => navLink(label, href)),
            },
            flex(
              [
                linkButton(p('signInLabel'), p('signInHref'), 'ghost'),
                linkButton(p('ctaLabel'), p('ctaHref')),
              ],
              'hidden items-center gap-2 md:flex'
            ),
            menuButton(menuId),
          ],
          'mx-auto h-16 w-full max-w-6xl items-center justify-between gap-6'
        ),
        menuPanel(menuId, [
          {
            type: 'container',
            element: 'nav',
            props: { 'aria-label': 'Main', className: 'flex flex-col' },
            children: LINKS.map(([label, href]) => menuLink(label, href)),
          },
          flex(
            [
              linkButton(p('ctaLabel'), p('ctaHref')),
              linkButton(p('signInLabel'), p('signInHref'), 'secondary'),
            ],
            'mt-6 flex-col gap-3'
          ),
        ]),
      ],
    })
  },
})
