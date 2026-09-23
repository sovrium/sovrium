/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// `time-picker` — a time, shut and open.
//
// Shut is the real component: that is its resting state and what a form shows.
// Open is composed, for the reason every overlay on this page is composed — the
// list exists only while the control is focused.
//
// `minuteStep` is the key worth knowing about, and it is drawn rather than
// described: it decides what the list even contains.

import { panel } from './overlay-panel'
import type { PageComponent, TypePageBody } from './body-shape'

const slot = (label: string, current = false): PageComponent =>
  ({
    type: 'text',
    element: 'span',
    props: {
      className: current
        ? 'bg-background-subtle text-foreground rounded px-2 py-1 text-sm font-medium'
        : 'text-foreground rounded px-2 py-1 text-sm',
    },
    content: label,
  }) as PageComponent

const timePicker: TypePageBody = {
  drawings: [
    {
      label: 'closed',
      children: [
        { type: 'time-picker', timeFormat: '24h', minuteStep: 15, props: { className: 'w-40' } },
      ],
    },
    {
      label: 'open',
      children: [
        {
          type: 'container',
          element: 'div',
          props: { className: 'flex flex-col items-start gap-1.5' },
          children: [
            {
              type: 'time-picker',
              timeFormat: '24h',
              minuteStep: 15,
              props: { className: 'w-40' },
            },
            panel({
              width: 'w-40',
              children: [
                {
                  type: 'container',
                  element: 'div',
                  props: { className: 'flex flex-col' },
                  children: [slot('09:00'), slot('09:15', true), slot('09:30'), slot('09:45')],
                },
              ],
            }),
          ],
        },
      ],
    },
  ],
}

export default timePicker
