/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// `comments` — a thread on a record, and the one part of it this page cannot draw.
//
// The component hydrates a composer: a live control that posts a comment onto a
// record. The design system is a preview frame and carries no write path, so
// every drawing below is composed from the pieces a thread is made of. The
// composer is drawn as the control a reader sees; what it does is the part that
// has to be read rather than shown.
//
// The decision the type carries is `display`: a full thread, or a count that
// opens one. A record page with three threads on it wants counts; the thread
// itself wants the thread.

import type { PageComponent, TypePageBody } from './_shape'

const avatar = (initials: string, label: string) => ({
  type: 'avatar' as const,
  initials,
  label,
})

const comment = (
  author: string,
  initials: string,
  when: string,
  body: string,
  indented = false
) => ({
  type: 'container' as const,
  element: 'div' as const,
  props: { className: indented ? 'flex gap-3 pl-10' : 'flex gap-3' },
  children: [
    avatar(initials, author),
    {
      type: 'container' as const,
      element: 'div' as const,
      props: { className: 'flex min-w-0 flex-col gap-0.5' },
      children: [
        {
          type: 'container' as const,
          element: 'div' as const,
          props: { className: 'flex items-baseline gap-2' },
          children: [
            {
              type: 'text' as const,
              element: 'span' as const,
              content: author,
              props: { className: 'text-foreground text-sm font-medium' },
            },
            {
              type: 'text' as const,
              element: 'span' as const,
              content: when,
              props: { className: 'text-foreground-subtle text-xs' },
            },
          ],
        },
        {
          type: 'text' as const,
          element: 'p' as const,
          content: body,
          props: { className: 'text-foreground text-sm' },
        },
      ],
    },
  ],
})

const thread = (children: readonly unknown[]) => ({
  type: 'container' as const,
  element: 'div' as const,
  props: { className: 'flex w-96 max-w-full flex-col gap-4' },
  children,
})

const note = (content: string): PageComponent =>
  ({
    type: 'text',
    element: 'p',
    content,
    props: { className: 'text-foreground-subtle text-[11px]' },
  }) as PageComponent

const composer = (placeholder: string, action: string): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: { className: 'flex w-96 max-w-full flex-col gap-2' },
    children: [
      { type: 'textarea', rows: 2, props: { name: 'c', placeholder } },
      {
        type: 'container',
        element: 'div',
        props: { className: 'flex justify-end' },
        children: [
          { type: 'button', children: [{ type: 'text', element: 'span', content: action }] },
        ],
      },
    ],
  }) as PageComponent

const comments: TypePageBody = {
  drawings: [
    {
      label: 'thread',
      children: [
        thread([
          comment(
            'Grace Hopper',
            'GH',
            '2 days ago',
            'Moved the close date out a week — legal is still reading.'
          ),
          comment(
            'Ada Lovelace',
            'AL',
            'yesterday',
            'Noted. I will hold the invoice until it clears.'
          ),
        ]),
      ],
    },
    {
      label: 'with replies',
      children: [
        thread([
          comment(
            'Grace Hopper',
            'GH',
            '2 days ago',
            'Moved the close date out a week — legal is still reading.'
          ),
          comment('Alan Turing', 'AT', '2 days ago', 'Which clause?', true),
          comment('Grace Hopper', 'GH', '2 days ago', 'Liability cap. Should be quick.', true),
        ]),
      ],
    },
    {
      label: 'count',
      children: [
        {
          type: 'button',
          variant: 'secondary',
          children: [{ type: 'text', element: 'span', content: '3 comments' }],
        },
      ],
    },
    {
      label: 'with composer',
      children: [
        thread([
          comment(
            'Ada Lovelace',
            'AL',
            'yesterday',
            'Noted. I will hold the invoice until it clears.'
          ),
          {
            type: 'container',
            element: 'div',
            props: { className: 'flex flex-col gap-2' },
            children: [
              {
                type: 'textarea',
                rows: 2,
                props: { name: 'comment', placeholder: 'Write a comment' },
              },
              {
                type: 'container',
                element: 'div',
                props: { className: 'flex justify-end' },
                children: [
                  {
                    type: 'button',
                    children: [{ type: 'text', element: 'span', content: 'Comment' }],
                  },
                ],
              },
            ],
          },
        ]),
      ],
    },
  ],
  options: [
    {
      id: 'sort',
      title: 'Sort',
      configKey: 'comments.sort',
      drawings: [
        {
          label: "sort: 'newest'",
          children: [
            thread([
              comment(
                'Ada Lovelace',
                'AL',
                'yesterday',
                'Noted. I will hold the invoice until it clears.'
              ),
              comment('Grace Hopper', 'GH', '2 days ago', 'Moved the close date out a week.'),
            ]),
          ],
        },
        {
          label: "sort: 'oldest'",
          children: [
            thread([
              comment('Grace Hopper', 'GH', '2 days ago', 'Moved the close date out a week.'),
              comment(
                'Ada Lovelace',
                'AL',
                'yesterday',
                'Noted. I will hold the invoice until it clears.'
              ),
            ]),
          ],
        },
      ],
    },
    {
      id: 'threading',
      title: 'Threading',
      configKey: 'table.comments.threading',
      drawings: [
        {
          label: 'threading: false',
          children: [
            thread([
              comment('Grace Hopper', 'GH', '2 days ago', 'Moved the close date out a week.'),
              comment('Alan Turing', 'AT', '2 days ago', 'Which clause?'),
            ]),
          ],
        },
        {
          label: 'threading: true',
          children: [
            thread([
              comment('Grace Hopper', 'GH', '2 days ago', 'Moved the close date out a week.'),
              comment('Alan Turing', 'AT', '2 days ago', 'Which clause?', true),
            ]),
          ],
        },
      ],
    },
    {
      id: 'pagination',
      title: 'Pagination',
      configKey: 'comments.paginationStyle | limit',
      drawings: [
        {
          label: "paginationStyle: 'loadMore' · limit: 3",
          children: [
            thread([
              comment('Grace Hopper', 'GH', '2 days ago', 'Moved the close date out a week.'),
              comment('Alan Turing', 'AT', '2 days ago', 'Which clause?'),
              comment('Ada Lovelace', 'AL', 'yesterday', 'Liability cap.'),
              {
                type: 'button',
                variant: 'secondary',
                children: [{ type: 'text', element: 'span', content: 'Load more' }],
              } as PageComponent,
            ]),
          ],
        },
        {
          label: "paginationStyle: 'numbered'",
          children: [
            thread([
              comment('Grace Hopper', 'GH', '2 days ago', 'Moved the close date out a week.'),
              comment('Alan Turing', 'AT', '2 days ago', 'Which clause?'),
              { type: 'pagination', totalPages: 4, currentPage: 1 } as PageComponent,
            ]),
          ],
        },
      ],
    },
    {
      id: 'empty',
      title: 'Empty',
      configKey: 'comments.emptyText',
      drawings: [
        {
          label: 'emptyText: (omitted)',
          children: [thread([note('No comments yet')])],
        },
        {
          label: "emptyText: 'No notes on this deal yet. Add the first.'",
          children: [thread([note('No notes on this deal yet. Add the first.')])],
        },
      ],
    },
    {
      id: 'access',
      title: 'Access',
      configKey: 'comments.guestComments | guestEmailRequired',
      drawings: [
        {
          label: 'signed in',
          children: [composer('Write a comment', 'Comment')],
        },
        {
          label: 'signed out · guestComments: false',
          children: [
            {
              type: 'container',
              element: 'div',
              props: {
                className:
                  'border-border flex w-96 max-w-full justify-center rounded-md border border-dashed px-4 py-6',
              },
              children: [
                {
                  type: 'link',
                  props: { href: '#', className: 'text-primary text-sm' },
                  content: 'Sign in to comment',
                },
              ],
            } as PageComponent,
          ],
        },
        {
          label: 'guestComments: true · guestEmailRequired: true',
          children: [
            {
              type: 'container',
              element: 'div',
              props: { className: 'flex w-96 max-w-full flex-col gap-2' },
              children: [
                {
                  type: 'field',
                  fieldLabel: 'Email',
                  required: true,
                  children: [
                    {
                      type: 'input',
                      inputType: 'email',
                      props: { name: 'ge', placeholder: 'name@company.com' },
                    },
                  ],
                },
                composer('Write a comment', 'Comment'),
              ],
            } as PageComponent,
          ],
        },
      ],
    },
    {
      id: 'moderation',
      title: 'Moderation',
      configKey: 'table.comments.moderation',
      drawings: [
        {
          label: "moderation: 'auto'",
          children: [
            thread([
              comment('Ada Lovelace', 'AL', 'just now', 'Holding the invoice until legal clears.'),
            ]),
          ],
        },
        {
          label: "moderation: 'manual'",
          children: [
            thread([
              {
                type: 'container',
                element: 'div',
                props: { className: 'flex items-center gap-2' },
                children: [
                  {
                    type: 'badge',
                    badgeVariant: 'secondary',
                    children: [{ type: 'text', element: 'span', content: 'Pending' }],
                  },
                  note('Visible to you until an admin approves it.'),
                ],
              } as PageComponent,
              comment('Ada Lovelace', 'AL', 'just now', 'Holding the invoice until legal clears.'),
            ]),
          ],
        },
        {
          label: "moderation: 'auth-required'",
          children: [
            thread([
              comment('Grace Hopper', 'GH', '2 days ago', 'Moved the close date out a week.'),
              {
                type: 'link',
                props: { href: '#', className: 'text-primary text-sm' },
                content: 'Sign in to comment',
              } as PageComponent,
            ]),
          ],
        },
      ],
    },
    {
      id: 'read-tracking',
      title: 'Read tracking',
      configKey: 'comments.readTracking',
      drawings: [
        {
          label: 'readTracking: false',
          children: [
            thread([
              comment('Grace Hopper', 'GH', '2 days ago', 'Moved the close date out a week.'),
            ]),
          ],
        },
        {
          label: 'readTracking: true',
          children: [
            thread([
              {
                type: 'container',
                element: 'div',
                props: { className: 'flex items-center gap-2' },
                children: [
                  { type: 'badge', variant: 'status', statusColor: 'green', status: '2 unread' },
                ],
              } as PageComponent,
              comment('Grace Hopper', 'GH', '2 days ago', 'Moved the close date out a week.'),
            ]),
          ],
        },
      ],
    },
    {
      id: 'count',
      title: 'Count',
      configKey: 'commentCount.format | emptyText',
      drawings: [
        {
          label: "format: '{count} comments'",
          children: [
            {
              type: 'button',
              variant: 'secondary',
              children: [{ type: 'text', element: 'span', content: '3 comments' }],
            } as PageComponent,
          ],
        },
        {
          label: "emptyText: 'No comments yet'",
          children: [
            {
              type: 'button',
              variant: 'secondary',
              children: [{ type: 'text', element: 'span', content: 'No comments yet' }],
            } as PageComponent,
          ],
        },
      ],
    },
  ],
}

export default comments
