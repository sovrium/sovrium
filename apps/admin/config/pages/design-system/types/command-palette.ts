/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// `command-palette` — the ⌘K surface, drawn with results and without.
//
// The catalogue refuses it because it builds its overlay in the browser on the
// first keystroke and renders nothing before that: there is no resting form to
// photograph. Both drawings compose the panel.
//
// The empty case is drawn on purpose and is the more useful of the two. A
// palette that finds nothing is the state an operator meets when they have
// mistyped or when the thing they want is not searchable, and a surface that
// documents only its happy path has documented the half nobody needs help with.

import { panel } from './_overlay'
import type { PageComponent, TypePageBody } from './_shape'

const queryRow = (text: string): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: { className: 'border-border flex items-center gap-2 border-b pb-2' },
    children: [
      { type: 'icon', props: { name: 'search', size: 14 } },
      {
        type: 'text',
        element: 'span',
        props: { className: 'text-foreground text-sm' },
        content: text,
      },
    ],
  }) as PageComponent

const result = (label: string, kind: string): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: { className: 'flex items-baseline justify-between gap-3 rounded px-2 py-1.5' },
    children: [
      {
        type: 'text',
        element: 'span',
        props: { className: 'text-foreground text-sm' },
        content: label,
      },
      {
        type: 'text',
        element: 'span',
        props: { className: 'text-foreground-subtle text-[10px]' },
        content: kind,
      },
    ],
  }) as PageComponent

const commandPalette: TypePageBody = {
  drawings: [
    {
      label: 'results',
      children: [
        panel({
          width: 'w-[26rem]',
          children: [
            queryRow('invoice'),
            result('Invoices', 'Table'),
            result('INV-0042', 'Record'),
            result('Send invoice reminder', 'Automation'),
          ],
        }),
      ],
    },
    {
      label: 'empty',
      children: [
        panel({
          width: 'w-[26rem]',
          children: [
            queryRow('invocie'),
            {
              type: 'text',
              element: 'p',
              props: { className: 'text-foreground-subtle px-2 py-3 text-sm leading-relaxed' },
              content:
                'Nothing matches “invocie”. This searches tables, records, automations and pages.',
            },
          ],
        }),
      ],
    },
  ],
}

export default commandPalette
