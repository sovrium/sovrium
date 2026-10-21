/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// sovrium-library: block/login-03@0.37.0#2d692db279be

// The console sign-in surface.

// ── From pages/login.ts ────────────────────────────────────────────────────────
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
// The mark, the card's title and description, the testid of the block's
// `statusLine` (set to the console's session-ended copy), and the ways in. The
// block's field group lists every way an app may offer (social buttons,
// passkey, magic link, single sign-on, sign-up), each gated on what the app
// declares; the console's field group is its own: Sovrium Cloud, the "or"
// separator and the email form (`#admin-login-form`). The form draws its own
// "Forgot your password?" in the Password label row, because the console serves
// a password-reset request page (`/forgot-password`); without outgoing mail that
// page is dropped and the link with it. The console has no magic-link, SSO or
// sign-up page of its own, so those rows would link to nothing under its base.
//
// PATHS ARE MOUNT-RELATIVE (`/`, `/forgot-password`): the mount primitive
// prefixes them with the console's base at render time. The root carries
// `data-admin-base-path` for the same reason the shell does.

import type { AppEncoded as AppConfig } from '@/domain/models/app'

type Template = NonNullable<AppConfig['components']>[number]

// eslint-disable-next-line sovrium/no-double-assertion -- a template that declares inputs writes `$name` where the component type expects a list or an object; each placement is decoded as the page component it produces when the app starts
export const consoleLogin = {
  name: 'console-login',
  type: 'container',
  render: 'transparent',
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
                  content: '$t:admin.login.heading',
                },
                {
                  type: 'container',
                  element: 'div',
                  props: {
                    className: 'text-sm text-muted-foreground',
                    'data-slot': 'card-description',
                    'data-testid': 'login-blurb',
                  },
                  children: [
                    {
                      type: 'text',
                      element: 'span',
                      content: '$t:admin.login.blurb',
                    },
                    {
                      type: 'text',
                      element: 'span',
                      content: '$app.label',
                      props: {
                        className: 'font-medium text-foreground',
                      },
                    },
                    {
                      type: 'text',
                      element: 'span',
                      content: '.',
                    },
                  ],
                },
                {
                  type: 'text',
                  element: 'p',
                  visibility: {
                    query: {
                      name: 'next',
                      eq: 'set',
                    },
                  },
                  props: {
                    role: 'status',
                    className: 'text-sm font-medium text-foreground',
                    'data-testid': 'login-session-ended',
                  },
                  content: '$t:admin.login.sessionEnded',
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
