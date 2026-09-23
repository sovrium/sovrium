/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// Password-recovery completion.
//
// Reached from the emailed link, which carries `?token=…`. Public like
// `/login` — but unlike `/login` and `/forgot-password` it must NOT redirect a
// signed-in admin away: that would swallow the token and strand the reset
// half-finished. The signed-in-redirect set is therefore narrower than the
// public carve-out.
//
// PATHS ARE MOUNT-RELATIVE (`/login`). The mount primitive prefixes them.

import type { Page as PageConfig } from '@/domain/models/app'

export default {
  id: 'dashboard-reset-password',
  name: 'dashboard-reset-password',
  path: '/reset-password',
  meta: {
    title: '$t:admin.meta.resetPassword',
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
              content: '$t:admin.resetPassword.heading',
              props: {
                className: 'text-3xl font-bold tracking-tight leading-tight text-foreground',
              },
            },
            {
              type: 'text',
              element: 'p',
              // No character count here on purpose: the minimum comes from the
              // OPERATOR's password policy (`resolvePasswordPolicy`, default 8 but
              // overridable per app), and this config ships in every binary — a
              // hardcoded number would be wrong on any app with a stricter policy.
              content: '$t:admin.resetPassword.blurb',
              props: {
                className: 'text-md leading-relaxed text-foreground-muted max-w-sm',
              },
            },
          ],
        },
        {
          type: 'card',
          props: {
            className: 'w-full max-w-sm bg-background-raised border border-border rounded-lg p-8',
          },
          children: [
            {
              type: 'form',
              props: { id: 'admin-reset-password-form' },
              action: {
                type: 'auth',
                method: 'setNewPassword',
                strategy: 'email',
                submitLabel: '$t:admin.resetPassword.submit',
                pendingLabel: '$t:admin.resetPassword.pending',
                fields: [{ name: 'password', label: '$t:admin.field.newPassword' }],
                onSuccess: {
                  navigate: '/login',
                  toast: {
                    message: 'Password updated. You can sign in.',
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
          content: '$t:admin.resetPassword.singleUse',
          props: { className: 'text-foreground-subtle font-serif text-md italic' },
        },
      ],
    },
  ],
} satisfies PageConfig
