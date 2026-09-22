/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// `toast` — what the app says after something happened.
//
// The type draws, and it draws where it would appear rather than in the page
// flow — so each drawing puts one in the corner it lands in. Two tones, because
// a toast reporting a failure and one reporting a success are read at different
// speeds and only one of them may be dismissed without being read.

import type { PageComponent, TypePageBody } from './_shape'

const inCorner = (children: readonly PageComponent[]): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: {
      className: 'border-border bg-background-subtle flex w-full justify-end rounded-lg border p-6',
    },
    children: [...children],
  }) as PageComponent

const toastOf = (variant: string, title: string, body: string): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: {
      className:
        'border-border bg-background-raised flex w-72 flex-col gap-1 rounded-lg border p-3 shadow-md',
    },
    children: [
      {
        type: 'container',
        element: 'div',
        props: { className: 'flex items-center gap-2' },
        children: [
          {
            type: 'badge',
            variant: 'status',
            statusColor: variant === 'error' ? 'red' : 'green',
            status: title,
          },
        ],
      },
      {
        type: 'text',
        element: 'p',
        props: { className: 'text-foreground-subtle text-[11px] leading-relaxed' },
        content: body,
      },
    ],
  }) as PageComponent

const toast: TypePageBody = {
  drawings: [
    {
      label: 'success',
      children: [
        inCorner([
          toastOf('success', 'Link created', 'Copied to your clipboard. It expires in 30 days.'),
        ]),
      ],
    },
    {
      label: 'error',
      children: [
        inCorner([
          toastOf(
            'error',
            'Import failed',
            'Row 42 has no value for a required field. Nothing was written.'
          ),
        ]),
      ],
    },
  ],
}

export default toast
