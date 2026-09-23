/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// `hover-card` — what a name expands into when a pointer rests on it.
//
// Renders its trigger; the card is composed. It differs from a popover in what
// opens it and therefore in what it may hold: nobody clicked, so nothing in here
// may be the only way to reach something.

import { panel } from './overlay-panel'
import type { TypePageBody } from './body-shape'

const hoverCard: TypePageBody = {
  drawings: [
    {
      label: 'open',
      children: [
        {
          type: 'container',
          element: 'div',
          props: { className: 'flex flex-col items-start gap-1.5' },
          children: [
            {
              type: 'link',
              props: { href: '/design-system/ui-kit/avatar' },
              content: 'Léa Fontaine',
            },
            panel({
              width: 'w-72',
              children: [
                {
                  type: 'container',
                  element: 'div',
                  props: { className: 'flex items-center gap-3' },
                  children: [
                    { type: 'avatar', initials: 'LF', label: 'Léa Fontaine' },
                    {
                      type: 'container',
                      element: 'div',
                      props: { className: 'flex flex-col' },
                      children: [
                        {
                          type: 'text',
                          element: 'span',
                          props: { className: 'text-foreground text-sm font-medium' },
                          content: 'Léa Fontaine',
                        },
                        {
                          type: 'text',
                          element: 'span',
                          props: { className: 'text-foreground-subtle text-[11px]' },
                          content: 'Owner · 14 open deals',
                        },
                      ],
                    },
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

export default hoverCard
