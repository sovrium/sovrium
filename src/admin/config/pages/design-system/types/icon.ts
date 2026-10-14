/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// `icon` — a lucide glyph at its default size, at an explicit one, and beside
// the text it labels.
//
// The default is 16 pixels on lucide's own 2-pixel stroke, the size and weight
// every shadcn/ui component draws its icons at. `props.size` is the size drawn,
// so the ladder below is three real icons, not one icon scaled by a class.

import type { PageComponent, TypePageBody } from './body-shape'

const glyph = (name: string, label: string, size?: number): PageComponent => ({
  type: 'icon',
  props: { name, 'aria-label': label, ...(size === undefined ? {} : { size }) },
})

const row = (children: readonly PageComponent[]): PageComponent => ({
  type: 'container',
  element: 'div',
  props: { className: 'text-foreground flex flex-wrap items-center gap-3' },
  children: [...children],
})

const icon: TypePageBody = {
  drawings: [
    {
      label: 'default',
      children: [
        row([
          glyph('check-circle', 'Success'),
          glyph('alert-triangle', 'Warning'),
          glyph('info', 'Information'),
          glyph('arrow-right', 'Next'),
        ]),
      ],
    },
    {
      label: 'size',
      children: [
        row([
          glyph('folder', '16 pixels'),
          glyph('folder', '20 pixels', 20),
          glyph('folder', '24 pixels', 24),
        ]),
      ],
    },
    {
      label: 'beside text',
      children: [
        {
          type: 'container',
          element: 'div',
          props: { className: 'text-muted-foreground flex items-center gap-2 text-sm' },
          children: [
            glyph('clock', 'Pending'),
            { type: 'text', element: 'span', content: 'Waiting for approval' },
          ],
        },
      ],
    },
  ],
}

export default icon
