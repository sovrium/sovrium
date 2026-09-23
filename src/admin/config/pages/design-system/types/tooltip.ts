/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// `tooltip` — a word that appears beside a control, drawn on both sides.
//
// The component renders, but what it renders at rest is its TRIGGER: the bubble
// exists only while a pointer is on it. A static page cannot hold that, so each
// drawing composes the bubble in the position `floatingSide` would put it — the
// one axis a reader is choosing between.

import type { PageComponent, TypePageBody } from './body-shape'

const bubble = (text: string): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: { className: 'bg-foreground text-background rounded-md px-2 py-1 text-[11px]' },
    children: [{ type: 'text', element: 'span', content: text }],
  }) as PageComponent

const trigger = (): PageComponent =>
  ({
    type: 'button',
    variant: 'outline',
    size: 'sm',
    label: 'Revoke',
    props: { type: 'button' },
  }) as PageComponent

const tooltip: TypePageBody = {
  drawings: [
    {
      label: 'top',
      children: [
        {
          type: 'container',
          element: 'div',
          props: { className: 'flex flex-col items-center gap-1.5' },
          children: [bubble('Stops the link working immediately'), trigger()],
        },
      ],
    },
    {
      label: 'bottom',
      children: [
        {
          type: 'container',
          element: 'div',
          props: { className: 'flex flex-col items-center gap-1.5' },
          children: [trigger(), bubble('Stops the link working immediately')],
        },
      ],
    },
  ],
}

export default tooltip
