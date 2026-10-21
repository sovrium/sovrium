/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// sovrium-library: block/login-03@0.37.0#599c3676dc57

// The password-recovery card shared by `/forgot-password` and `/reset-password`: the copy, the
// form id and the form action are passed per page.

// ── From pages/forgot-password.ts ──────────────────────────────────────────────
// Password-recovery request.
//
// Public like `/login` — an operator who cannot sign in must be able to reach
// it — but SMTP-gated: without outgoing mail the platform drops this path from
// the carve-out entirely, so a hand-typed URL 404s rather than
// opening a form that can never send anything.
//
// PATHS ARE MOUNT-RELATIVE (`/login`). The mount primitive prefixes them.
//
// INSTALLED, like `/login`, from the library's `login-03` block: the same muted
// screen and card, with the field group bound to this step of the reset flow
// (the form, the way back to sign in, and the one note the step needs).
// Re-install with `sovrium library add block/login-03 --update`.
// ── From pages/reset-password.ts ───────────────────────────────────────────────
// Password-recovery completion.
//
// Reached from the emailed link, which carries `?token=…`. Public like
// `/login` — but unlike `/login` and `/forgot-password` it must NOT redirect a
// signed-in admin away: that would swallow the token and strand the reset
// half-finished. The signed-in-redirect set is therefore narrower than the
// public carve-out.
//
// PATHS ARE MOUNT-RELATIVE (`/login`). The mount primitive prefixes them.
//
// INSTALLED, like `/login`, from the library's `login-03` block: the same muted
// screen and card, with the field group bound to this step of the reset flow
// (the form, the way back to sign in, and the one note the step needs).
// Re-install with `sovrium library add block/login-03 --update`.

import type { AppEncoded as AppConfig } from '@/domain/models/app'

type Template = NonNullable<AppConfig['components']>[number]

// eslint-disable-next-line sovrium/no-double-assertion -- a template that declares inputs writes `$name` where the component type expects a list or an object; each placement is decoded as the page component it produces when the app starts
export const consolePasswordCard = {
  name: 'console-password-card',
  type: 'container',
  render: 'transparent',
  inputs: {
    content: {
      kind: 'text',
      required: true,
    },
    content2: {
      kind: 'text',
      required: true,
    },
  },
  element: 'section',
  props: {
    className:
      'flex min-h-svh w-full flex-col items-center justify-center gap-6 p-6 md:p-10 bg-muted',
    'data-admin-base-path': '/',
  },
  children: [
    {
      type: 'flex',
      props: {
        className: 'flex w-full max-w-sm flex-col gap-6',
      },
      children: [
        {
          type: 'link',
          props: {
            href: '/',
            className: 'flex items-center gap-2 text-sm font-medium text-foreground self-center',
          },
          children: [
            {
              type: 'container',
              props: {
                className:
                  'flex size-6 items-center justify-center overflow-hidden rounded-md bg-primary text-xs font-semibold text-primary-foreground data-[app-mark=logo]:bg-transparent',
                'data-app-mark': 'tile',
              },
            },
            {
              type: 'text',
              element: 'span',
              content: '$app.label',
            },
          ],
        },
        {
          type: 'card',
          props: {
            'data-slot': 'card',
            className: 'flex flex-col gap-4 overflow-hidden px-0 py-4 text-sm',
          },
          children: [
            {
              type: 'container',
              props: {
                'data-slot': 'card-header',
                className: 'grid auto-rows-min gap-1 px-4 text-center',
              },
              children: [
                {
                  type: 'text',
                  element: 'h1',
                  props: {
                    className: 'font-medium leading-snug text-foreground text-xl',
                    'data-slot': 'card-title',
                  },
                  content: '$content',
                },
                {
                  type: 'text',
                  element: 'p',
                  props: {
                    className: 'text-sm text-muted-foreground',
                    'data-slot': 'card-description',
                  },
                  content: '$content2',
                },
              ],
            },
            {
              type: 'container',
              props: {
                'data-slot': 'card-content',
                className: 'px-4',
              },
              children: [
                {
                  type: 'flex',
                  props: {
                    'data-slot': 'field-group',
                    className: 'flex w-full flex-col gap-5',
                  },
                  children: '$children',
                },
              ],
            },
          ],
        },
      ],
    },
  ],
} as unknown as Template
