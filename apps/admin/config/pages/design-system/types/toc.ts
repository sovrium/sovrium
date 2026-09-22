/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// `toc` — a table of contents, which has nothing to index on its own.
//
// The component reads the headings of the page it sits on. On a specimen frame
// there are none, so the derived page drew an empty bordered box: a correct
// rendering of the component and a useless drawing of it. Both variants here put
// it beside a page, because beside a page is the only place it means anything.
//
// ─── THE RAIL IS A RULE, AND THAT IS THE ONE RULE IT FOLLOWS ───────────────
//
// A navigation that IS a rule marks its current entry with a bar ON that rule —
// square, no radius, no fill. A navigation that is a COLUMN marks with a rounded
// fill instead. This is the first kind, which is why the drawing shows a bar and
// not a pill, and why the console's own sidebar two columns to the left shows a
// pill and not a bar.

import type { PageComponent, TypePageBody } from './_shape'

/** A run of page text, standing in for the article the rail indexes. */
const line = (width: string, strong = false): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: {
      className: `${strong ? 'bg-foreground-subtle' : 'bg-border'} rounded-sm`,
      style: { width, height: strong ? '10px' : '6px' },
    },
    children: [],
  }) as PageComponent

/** One entry of the drawn rail. */
const entry = (label: string, current: boolean): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: {
      className: current
        ? 'border-foreground text-foreground border-l-2 pl-3 text-[11px] font-medium'
        : 'text-foreground-subtle border-l-2 border-transparent pl-3 text-[11px]',
    },
    children: [{ type: 'text', element: 'span', content: label }],
  }) as PageComponent

const page = (entries: readonly (readonly [string, boolean])[]): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: { className: 'flex w-full items-start gap-8' },
    children: [
      {
        type: 'container',
        element: 'div',
        props: { className: 'flex min-w-0 flex-1 flex-col gap-2.5' },
        children: [
          line('62%', true),
          line('100%'),
          line('88%'),
          line('94%'),
          line('40%', true),
          line('100%'),
          line('72%'),
        ],
      },
      {
        type: 'container',
        element: 'div',
        props: { className: 'flex w-40 flex-none flex-col gap-1.5' },
        children: [
          {
            type: 'text',
            element: 'p',
            props: {
              className:
                'text-foreground-subtle pl-3 text-[10px] font-medium tracking-[0.04em] uppercase',
            },
            content: 'On this page',
          },
          ...entries.map(([label, current]) => entry(label, current)),
        ],
      },
    ],
  }) as PageComponent

const toc: TypePageBody = {
  drawings: [
    {
      label: 'on this page',
      children: [
        page([
          ['Getting started', false],
          ['Install', false],
          ['Configure', false],
          ['Deploy', false],
        ]),
      ],
    },
    {
      label: 'current heading',
      children: [
        page([
          ['Getting started', false],
          ['Install', true],
          ['Configure', false],
          ['Deploy', false],
        ]),
      ],
    },
  ],
}

export default toc
