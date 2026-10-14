/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// `breadcrumb` — where this page sits, drawn three ways.
//
// The catalogue refuses to preview it, and for a reason none of the overlays
// share: a breadcrumb names its own navigation landmark, and this console page
// already has one. Two landmarks with the same name is a real defect for anyone
// cycling them, so the refusal protects the PAGE rather than the component.
//
// Each drawing is therefore a composition on shadcn's anatomy, every part
// tagged with its `data-slot` as the live component tags it: the trail in the
// muted ink, a link lifting to the foreground on hover, the current page in the
// foreground and not a link. The separator is the one key this type takes, and
// it stays a string — `/` unless the config names another.

import type { PageComponent, TypePageBody } from './body-shape'

const crumb = (label: string, last = false): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: { className: 'inline-flex items-center gap-1.5', 'data-slot': 'breadcrumb-item' },
    children: [
      last
        ? {
            type: 'text',
            element: 'span',
            props: { className: 'text-foreground font-normal', 'data-slot': 'breadcrumb-page' },
            content: label,
          }
        : {
            type: 'link',
            props: {
              href: '/design-system',
              className: 'hover:text-foreground transition-colors',
              'data-slot': 'breadcrumb-link',
            },
            content: label,
          },
    ],
  }) as PageComponent

const sep = (glyph: string): PageComponent =>
  ({
    type: 'text',
    element: 'span',
    props: { 'aria-hidden': 'true', 'data-slot': 'breadcrumb-separator' },
    content: glyph,
  }) as PageComponent

const trail = (children: readonly PageComponent[]): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: {
      className:
        'text-muted-foreground flex flex-wrap items-center gap-1.5 text-sm break-words sm:gap-2.5',
      'data-slot': 'breadcrumb-list',
    },
    children: [...children],
  }) as PageComponent

const breadcrumb: TypePageBody = {
  drawings: [
    {
      label: 'default',
      children: [
        trail([
          crumb('Sovrium'),
          sep('/'),
          crumb('Design system'),
          sep('/'),
          crumb('UI kit', true),
        ]),
      ],
    },
    {
      label: 'chevrons',
      children: [
        trail([crumb('Records'), sep('›'), crumb('Invoices'), sep('›'), crumb('INV-0042', true)]),
      ],
    },
    {
      label: 'with home',
      children: [
        trail([
          {
            type: 'link',
            props: {
              href: '/',
              'aria-label': 'Home',
              className: 'hover:text-foreground inline-flex items-center transition-colors',
              'data-slot': 'breadcrumb-link',
            },
            children: [{ type: 'icon', props: { name: 'house', size: 14 } }],
          } as PageComponent,
          sep('/'),
          crumb('Design system'),
          sep('/'),
          crumb('Brand', true),
        ]),
      ],
    },
  ],
}

export default breadcrumb
