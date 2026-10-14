/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// `message` — one turn of a conversation: who said it, when, and what.
//
// The words go in a `bubble` child; this type is the turn around it — the
// avatar, the author, the time. `align` puts the turn on the sender's side or
// the reply's, and is logical rather than left and right, so a right-to-left
// page mirrors it. Two turns in a row by one author print the name once, which
// is what the thread drawing shows.

import type { PageComponent, TypePageBody } from './body-shape'

const turn = (input: {
  readonly content: string
  readonly author?: string
  readonly initials?: string
  readonly align?: 'start' | 'end'
  readonly timestamp?: string
}): PageComponent =>
  ({
    type: 'message',
    ...(input.author === undefined ? {} : { author: input.author }),
    ...(input.initials === undefined ? {} : { avatar: { initials: input.initials } }),
    ...(input.align === undefined ? {} : { align: input.align }),
    ...(input.timestamp === undefined ? {} : { timestamp: input.timestamp }),
    children: [
      {
        type: 'bubble',
        content: input.content,
        ...(input.align === undefined ? {} : { align: input.align }),
      },
    ],
  }) as PageComponent

const thread = (children: readonly PageComponent[]): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: { className: 'flex w-full max-w-md flex-col gap-3' },
    children: [...children],
  }) as PageComponent

const message: TypePageBody = {
  drawings: [
    {
      label: 'start',
      children: [
        turn({
          author: 'Léa Moreau',
          initials: 'LM',
          timestamp: '2026-10-12T09:14:00Z',
          content: 'The invoice for September is attached.',
        }),
      ],
    },
    {
      label: "align: 'end'",
      children: [
        turn({
          author: 'Support',
          initials: 'SU',
          align: 'end',
          timestamp: '2026-10-12T09:16:00Z',
          content: 'Thanks, it is filed under Atelier Verne.',
        }),
      ],
    },
    {
      label: 'thread',
      children: [
        thread([
          turn({
            author: 'Léa Moreau',
            initials: 'LM',
            content: 'Can the invoice be split in two?',
          }),
          turn({ author: 'Léa Moreau', initials: 'LM', content: 'One for each site.' }),
          turn({ author: 'Support', initials: 'SU', align: 'end', content: 'Yes, that is done.' }),
        ]),
      ],
    },
  ],
}

export default message
