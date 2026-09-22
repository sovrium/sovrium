/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// `split-pane` — two regions and a divider a reader can drag.
//
// `orientation` is the decision and it is about what the two panes ARE, not
// about the space available. Side by side is master-detail: a list on the left,
// what the reader picked on the right, both wanted at once. Stacked is
// edit-and-see: a source above, what it produces below, where the reader's eye
// travels down rather than across.
//
// `defaultRatio` is where the divider starts, between 0 and 1, for the FIRST
// pane. `minSize` and `maxSize` bound the drag, and they are what stops a reader
// collapsing a pane to nothing and not knowing how to get it back.
//
// The resize is an island. The server renders both panes side by side before it
// hydrates, so the content is there and readable with no JavaScript at all —
// which is the property that makes this safe to use for a page's main layout.

import type { PageComponent, TypePageBody } from './_shape'

const pane = (title: string, body: string): PageComponent =>
  ({
    type: 'card',
    props: { className: 'flex h-full flex-col gap-1' },
    children: [
      {
        type: 'text',
        element: 'h4',
        content: title,
        props: { className: 'text-foreground text-sm font-medium' },
      },
      {
        type: 'text',
        element: 'p',
        content: body,
        props: { className: 'text-foreground-subtle text-xs' },
      },
    ],
  }) as PageComponent

const splitPane: TypePageBody = {
  drawings: [
    {
      label: 'horizontal',
      children: [
        {
          type: 'split-pane',
          orientation: 'horizontal',
          defaultRatio: 0.33,
          minSize: 200,
          props: { className: 'h-56 w-full gap-3' },
          children: [
            pane('Records', 'Three specimen rows, one selected.'),
            pane(
              'Ada Lovelace',
              'The record the reader picked, open beside the list rather than instead of it.'
            ),
          ],
        } as PageComponent,
      ],
    },
    {
      label: 'vertical',
      children: [
        {
          type: 'split-pane',
          orientation: 'vertical',
          defaultRatio: 0.5,
          props: { className: 'h-56 w-full gap-3' },
          children: [
            pane('Expression', 'What the author writes.'),
            pane('Result', 'What it evaluates to, against the row above.'),
          ],
        } as PageComponent,
      ],
    },
  ],
}

export default splitPane
