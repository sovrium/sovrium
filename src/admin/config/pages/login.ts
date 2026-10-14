/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// sovrium-library: block/login-03@0.37.0#56d380093c82

// The public operator sign-in surface, INSTALLED from the library's `login-03`
// block (shadcn's login on a muted ground: the app's mark above a card).
// `Console Block Parity` holds this copy to the block with its bindings dropped;
// re-install with `sovrium library add block/login-03 --update`, never hand-edit
// the structure.
//
// The ONLY unguarded page under the console's base: the auth seam exempts
// `/_admin/login` so an anonymous operator can sign in, while the base itself
// stays 404-anonymous (standing rule S1). That carve-out is an EXACT-MATCH set,
// never a prefix.
//
// ─── THE BINDINGS ───────────────────────────────────────────────────────────
//
// The mark's icon, the card's title and description, and the ways in. The
// block's field group lists every way an app may offer (social buttons,
// passkey, magic link, single sign-on, sign-up), each gated on what the app
// declares; the console's field group is its own: Sovrium Cloud, the "or"
// separator, the email form (`#admin-login-form`) and the reset link. The
// console has no magic-link, SSO or sign-up page of its own, so those rows
// would link to nothing under its base.
//
// PATHS ARE MOUNT-RELATIVE (`/`, `/forgot-password`): the mount primitive
// prefixes them with the console's base at render time. The root carries
// `data-admin-base-path` for the same reason the shell does.

import type { Page as PageConfig } from '@/domain/models/app'

export const loginCopy = {
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
                  content: '$t:admin.login.heading',
                },
                {
                  // The card description, as a line that names the OPERATOR's
                  // app: `$app.label` does not resolve inside a translated
                  // value, so the sentence is composed here.
                  type: 'container',
                  element: 'div',
                  props: {
                    className: 'text-sm text-muted-foreground',
                    'data-slot': 'card-description',
                    'data-testid': 'login-blurb',
                  },
                  children: [
                    { type: 'text', element: 'span', content: '$t:admin.login.blurb' },
                    {
                      type: 'text',
                      element: 'span',
                      content: '$app.label',
                      props: { className: 'font-medium text-foreground' },
                    },
                    { type: 'text', element: 'span', content: '.' },
                  ],
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
                      type: 'flex',
                      props: {
                        'data-slot': 'field',
                        className: 'flex flex-col gap-3 [&_button]:w-full',
                      },
                      children: [
                        {
                          type: 'form',
                          action: {
                            type: 'auth',
                            method: 'login',
                            strategy: 'oauth',
                            provider: 'sovrium-cloud',
                            submitLabel: '$t:admin.login.cloudSignIn',
                            onSuccess: {
                              navigate: '/',
                            },
                          },
                          props: {
                            id: 'admin-cloud-sign-in',
                          },
                        },
                      ],
                    },
                    {
                      type: 'flex',
                      props: {
                        'data-slot': 'field-separator',
                        className: 'flex h-5 items-center gap-2 text-sm text-muted-foreground',
                      },
                      children: [
                        {
                          type: 'separator',
                          props: {
                            className: 'flex-1',
                          },
                        },
                        {
                          type: 'text',
                          element: 'span',
                          props: {
                            className: 'shrink-0 px-2',
                            'data-slot': 'field-separator-content',
                          },
                          content: '$t:admin.login.orEmail',
                        },
                        {
                          type: 'separator',
                          props: {
                            className: 'flex-1',
                          },
                        },
                      ],
                    },
                    {
                      type: 'form',
                      action: {
                        type: 'auth',
                        method: 'login',
                        strategy: 'email',
                        submitLabel: '$t:admin.login.submit',
                        pendingLabel: '$t:admin.login.pending',
                        fields: [
                          {
                            name: 'email',
                            label: '$t:admin.field.email',
                            placeholder: 'm@example.com',
                          },
                          {
                            name: 'password',
                            label: '$t:admin.field.password',
                          },
                        ],
                        onSuccess: {
                          navigate: '/',
                        },
                      },
                      props: {
                        id: 'admin-login-form',
                      },
                    },
                    {
                      type: 'link',
                      props: {
                        href: '/forgot-password',
                        className: 'self-end text-sm underline-offset-4 hover:underline',
                      },
                      content: '$t:admin.login.forgotLink',
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
  id: 'dashboard-login',
  name: 'dashboard-login',
  path: '/login',
  meta: {
    title: '$t:admin.meta.login',
    noindex: true,
  },
  components: [loginCopy],
} satisfies PageConfig
