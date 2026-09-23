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
// Each drawing is therefore a composition, and each is a trail of links with a
// different separator — which is the one key this type takes.

import type { PageComponent, TypePageBody } from './body-shape'

const crumb = (label: string, last = false): PageComponent =>
  last
    ? ({
        type: 'text',
        element: 'span',
        props: { className: 'text-foreground text-sm font-medium' },
        content: label,
      } as PageComponent)
    : ({
        type: 'link',
        props: { href: '/design-system', className: 'text-foreground-subtle text-sm' },
        content: label,
      } as PageComponent)

const sep = (glyph: string): PageComponent =>
  ({
    type: 'text',
    element: 'span',
    props: { className: 'text-foreground-subtle text-sm' },
    content: glyph,
  }) as PageComponent

const trail = (children: readonly PageComponent[]): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: { className: 'flex flex-wrap items-center gap-2' },
    children: [...children],
  }) as PageComponent

const breadcrumb: TypePageBody = {
  drawings: [
    {
      label: 'slashes',
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
            props: { href: '/', className: 'text-foreground-subtle inline-flex items-center' },
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
