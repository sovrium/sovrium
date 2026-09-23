/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// Password-recovery request.
//
// Public like `/login` — an operator who cannot sign in must be able to reach
// it — but SMTP-gated: without outgoing mail the platform drops this path from
// the carve-out entirely, so a hand-typed URL 404s rather than
// opening a form that can never send anything.
//
// PATHS ARE MOUNT-RELATIVE (`/login`). The mount primitive prefixes them.
//
// Mirrors the login page shell one-to-one so it introduces no new CSS candidate:
// the console renders against the OPERATOR's compiled stylesheet, so a class
// absent from BUILTIN_CSS_CANDIDATES renders bare.

import type { Page as PageConfig } from '@/domain/models/app'

export default {
  id: 'dashboard-forgot-password',
  name: 'dashboard-forgot-password',
  path: '/forgot-password',
  meta: {
    title: '$t:admin.meta.forgotPassword',
    noindex: true,
  },
  components: [
    {
      type: 'container',
      element: 'div',
      props: {
        // The console root as THIS document sees it, mount-relative like every
        // other link on the page. The mount primitive rewrites it to the real
        // base, which is how the client islands on an unauthenticated page —
        // the sign-in form's password-reset callback above all — learn which
        // mount they are being served from.
        'data-admin-base-path': '/',
        className:
          'min-h-screen flex flex-col items-center justify-center gap-8 px-6 py-16 bg-background text-foreground',
      },
      children: [
        {
          type: 'container',
          props: { className: 'flex flex-col items-center gap-3 text-center' },
          children: [
            {
              type: 'text',
              element: 'span',
              content: 'S',
              props: {
                className:
                  'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-foreground text-background text-lg font-semibold',
              },
            },
            {
              type: 'text',
              element: 'h1',
              content: '$t:admin.forgotPassword.heading',
              props: {
                className: 'text-3xl font-bold tracking-tight leading-tight text-foreground',
              },
            },
            {
              type: 'text',
              element: 'p',
              content: '$t:admin.forgotPassword.blurb',
              props: {
                className: 'text-md leading-relaxed text-foreground-muted max-w-sm',
              },
            },
          ],
        },
        // `stripAuthActionsIfUnconfigured` drops TOP-LEVEL auth-action components
        // when the app declares no `auth:` key — and this config declares none. The
        // strip is SHALLOW, so the form must stay nested container → card → form.
        {
          type: 'card',
          props: {
            className: 'w-full max-w-sm bg-background-raised border border-border rounded-lg p-8',
          },
          children: [
            {
              type: 'form',
              props: { id: 'admin-forgot-password-form' },
              action: {
                type: 'auth',
                method: 'resetPassword',
                strategy: 'email',
                submitLabel: '$t:admin.forgotPassword.submit',
                pendingLabel: '$t:admin.forgotPassword.pending',
                fields: [{ name: 'email', label: '$t:admin.field.email' }],
                onSuccess: {
                  // Conditional phrasing, deliberately: the endpoint always answers
                  // 200 so it never confirms whether an address has an account. The
                  // banner must not assert one exists.
                  toast: {
                    message: 'If an account exists for that address, a reset link has been sent.',
                    variant: 'success',
                  },
                },
              },
            },
            {
              type: 'link',
              props: {
                href: '/login',
                className: 'text-md text-center mt-4 text-foreground-muted',
              },
              content: '$t:admin.auth.backToSignIn',
            },
          ],
        },
        {
          type: 'text',
          element: 'p',
          content: '$t:admin.forgotPassword.expiry',
          props: { className: 'text-foreground-subtle font-serif text-md italic' },
        },
      ],
    },
  ],
} satisfies PageConfig
