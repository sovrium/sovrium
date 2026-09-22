/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// `navigation-menu` — a site's top navigation, shut and with one panel down.
//
// The first drawing is the real component, at rest and with a real hover-opened
// trigger in it. The second composes the panel, because that panel closes on
// pointer-out and a static page cannot keep it.
//
// This is the type the website's own header is built from, which is why the
// drawing uses the shape that header uses: plain links, one of them carrying a
// chevron because it opens something.

import { panel } from './_overlay'
import type { PageComponent, TypePageBody } from './_shape'

const NAV_ITEMS = [
  { label: 'Manifesto', href: '/design-system' },
  { label: 'Docs', href: '/design-system' },
  {
    label: 'Services',
    children: [
      {
        label: 'Sovrium Partner',
        description: 'Implementation and migration.',
        href: '/design-system',
      },
      {
        label: 'Sovrium Academy',
        description: 'Training for your own team.',
        href: '/design-system',
      },
    ],
  },
]

const panelEntry = (label: string, description: string): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: { className: 'flex flex-col gap-0.5 rounded px-2 py-1.5' },
    children: [
      {
        type: 'text',
        element: 'span',
        props: { className: 'text-foreground text-sm font-medium' },
        content: label,
      },
      {
        type: 'text',
        element: 'span',
        props: { className: 'text-foreground-subtle text-[11px]' },
        content: description,
      },
    ],
  }) as PageComponent

const navigationMenu: TypePageBody = {
  drawings: [
    {
      label: 'default',
      children: [{ type: 'navigation-menu', navItems: NAV_ITEMS, openOnHover: true }],
    },
    {
      label: 'with menu open',
      children: [
        {
          type: 'container',
          element: 'div',
          props: { className: 'flex flex-col items-start gap-1' },
          children: [
            { type: 'navigation-menu', navItems: NAV_ITEMS, openOnHover: true },
            panel({
              width: 'w-72',
              children: [
                {
                  type: 'container',
                  element: 'div',
                  props: { className: 'flex flex-col' },
                  children: [
                    panelEntry('Sovrium Partner', 'Implementation and migration.'),
                    panelEntry('Sovrium Academy', 'Training for your own team.'),
                  ],
                },
              ],
            }),
          ],
        },
      ],
    },
  ],
}

export default navigationMenu
