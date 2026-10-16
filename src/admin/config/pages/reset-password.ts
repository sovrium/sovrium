/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// sovrium-library: block/login-03@0.37.0#599c3676dc57

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

import type { Page as PageConfig } from '@/domain/models/app'

export const resetPasswordCopy = {
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
                  content: '$t:admin.resetPassword.heading',
                },
                {
                  type: 'text',
                  element: 'p',
                  props: {
                    className: 'text-sm text-muted-foreground',
                    'data-slot': 'card-description',
                  },
                  content: '$t:admin.resetPassword.blurb',
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
                        id: 'admin-reset-password-form',
                      },
                      action: {
                        type: 'auth',
                        method: 'setNewPassword',
                        strategy: 'email',
                        submitLabel: '$t:admin.resetPassword.submit',
                        pendingLabel: '$t:admin.resetPassword.pending',
                        fields: [
                          {
                            name: 'password',
                            label: '$t:admin.field.newPassword',
                          },
                        ],
                        onSuccess: {
                          navigate: '/login',
                          toast: {
                            message: '$t:admin.resetPassword.done',
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
                      content: '$t:admin.resetPassword.singleUse',
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
  id: 'dashboard-reset-password',
  name: 'dashboard-reset-password',
  path: '/reset-password',
  meta: {
    title: '$t:admin.meta.resetPassword',
    noindex: true,
  },
  components: [resetPasswordCopy],
} satisfies PageConfig
