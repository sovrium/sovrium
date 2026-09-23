/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// `menubar` — the application menu bar, shut and with one menu down.
//
// The first drawing is the real component: a menubar at rest is its row of
// triggers, which is a real resting state and worth drawing as one. The second
// composes the open menu under it, for the same reason every other overlay here
// is composed — a live one closes the moment focus leaves it.

import { panel } from './overlay-panel'
import type { PageComponent, TypePageBody } from './body-shape'

const item = (label: string, shortcut?: string): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: { className: 'flex items-baseline justify-between gap-6 rounded px-2 py-1.5' },
    children: [
      {
        type: 'text',
        element: 'span',
        props: { className: 'text-foreground text-sm' },
        content: label,
      },
      ...(shortcut === undefined
        ? []
        : [
            {
              type: 'text',
              element: 'span',
              props: { className: 'text-foreground-subtle font-mono text-[10px]' },
              content: shortcut,
            } as PageComponent,
          ]),
    ],
  }) as PageComponent

const bar = (openIndex: number): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: { className: 'border-border flex items-center gap-1 rounded-md border px-1 py-1' },
    children: ['File', 'Edit', 'View', 'Help'].map(
      (label, i) =>
        ({
          type: 'text',
          element: 'span',
          props: {
            className:
              i === openIndex
                ? 'bg-background-subtle text-foreground rounded px-2 py-1 text-sm font-medium'
                : 'text-foreground rounded px-2 py-1 text-sm',
          },
          content: label,
        }) as PageComponent
    ),
  }) as PageComponent

const menubar: TypePageBody = {
  drawings: [
    {
      label: 'default',
      children: [bar(-1)],
    },
    {
      label: 'with open menu',
      children: [
        {
          type: 'container',
          element: 'div',
          props: { className: 'flex flex-col items-start gap-1' },
          children: [
            bar(0),
            panel({
              width: 'w-56',
              children: [
                {
                  type: 'container',
                  element: 'div',
                  props: { className: 'flex flex-col' },
                  children: [item('New record', '⌘N'), item('Import CSV'), item('Export', '⌘E')],
                },
              ],
            }),
          ],
        },
      ],
    },
  ],
}

export default menubar
