/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// sovrium-library: block/login-03@0.37.0#599c3676dc57

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

import type { Page as PageConfig } from '@/domain/models/app'

export const forgotPasswordCopy = {
  type: 'container',
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
              // Sovrium's own mark, served by the engine at a root path (the
              // mount does not rewrite it), one ground per colour scheme.
              type: 'container',
              props: { className: 'flex size-6 items-center justify-center' },
              children: [
                {
                  type: 'image',
                  props: {
                    src: '/assets/brand/sovrium/mark-light-outline.svg',
                    alt: 'Sovrium',
                    className: 'block size-6 shrink-0 dark:hidden',
                  },
                },
                {
                  type: 'image',
                  props: {
                    src: '/assets/brand/sovrium/mark-dark-outline.svg',
                    alt: 'Sovrium',
                    className: 'hidden size-6 shrink-0 dark:block',
                  },
                },
              ],
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
                  content: '$t:admin.forgotPassword.heading',
                },
                {
                  type: 'text',
                  element: 'p',
                  props: {
                    className: 'text-sm text-muted-foreground',
                    'data-slot': 'card-description',
                  },
                  content: '$t:admin.forgotPassword.blurb',
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
                  children: [
                    {
                      type: 'form',
                      props: {
                        id: 'admin-forgot-password-form',
                      },
                      action: {
                        type: 'auth',
                        method: 'resetPassword',
                        strategy: 'email',
                        submitLabel: '$t:admin.forgotPassword.submit',
                        pendingLabel: '$t:admin.forgotPassword.pending',
                        fields: [
                          {
                            name: 'email',
                            label: '$t:admin.field.email',
                            placeholder: 'm@example.com',
                          },
                        ],
                        onSuccess: {
                          toast: {
                            message: '$t:admin.forgotPassword.sent',
                            variant: 'success',
                          },
                        },
                      },
                    },
                    {
                      type: 'link',
                      props: {
                        href: '/login',
                        className: 'text-center text-sm underline-offset-4 hover:underline',
                      },
                      content: '$t:admin.auth.backToSignIn',
                    },
                    {
                      type: 'text',
                      element: 'p',
                      props: {
                        className: 'text-center text-sm text-muted-foreground',
                        'data-slot': 'field-description',
                      },
                      content: '$t:admin.forgotPassword.expiry',
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
} as const

export default {
  id: 'dashboard-forgot-password',
  name: 'dashboard-forgot-password',
  path: '/forgot-password',
  meta: {
    title: '$t:admin.meta.forgotPassword',
    noindex: true,
  },
  components: [forgotPasswordCopy],
} satisfies PageConfig
