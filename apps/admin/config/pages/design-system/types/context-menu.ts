/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// `context-menu` — the same list, opened by the right button.
//
// It renders nothing at rest: a context menu has no trigger to draw, because
// the trigger is a gesture on something else. So the drawing is the row it was
// opened on and the panel beside it, which is also the only way to show what
// makes this type different from a dropdown — the target stays visible and
// marked.

import { panel } from './_overlay'
import type { PageComponent, TypePageBody } from './_shape'

const item = (label: string, destructive = false): PageComponent =>
  ({
    type: 'text',
    element: 'span',
    props: {
      className: `${destructive ? 'text-error-fg' : 'text-foreground'} rounded px-2 py-1.5 text-sm`,
    },
    content: label,
  }) as PageComponent

const contextMenu: TypePageBody = {
  drawings: [
    {
      label: 'open',
      children: [
        {
          type: 'container',
          element: 'div',
          props: { className: 'flex w-full flex-col items-start gap-1' },
          children: [
            {
              type: 'container',
              element: 'div',
              props: {
                className:
                  'border-border bg-background-subtle w-full rounded border px-3 py-2 text-sm',
              },
              children: [{ type: 'text', element: 'span', content: 'Rénovation atelier' }],
            },
            panel({
              width: 'w-48',
              children: [
                {
                  type: 'container',
                  element: 'div',
                  props: { className: 'flex flex-col' },
                  children: [item('Open'), item('Duplicate'), item('Delete', true)],
                },
              ],
            }),
          ],
        },
      ],
    },
  ],
}

export default contextMenu
