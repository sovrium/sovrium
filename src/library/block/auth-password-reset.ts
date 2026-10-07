/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  appMark,
  AUTH_PLACE_NOTE,
  authHeading,
  authPage,
  footerLink,
} from '@/library/manifest/auth-block-kit'
import { asComponent, param, stringParam, THEME_NOTE } from '@/library/manifest/block-kit'
import { defineLibraryEntry } from '@/library/manifest/define'

/** Step one of a password reset: ask for the email the link goes to. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'auth-password-reset',
  title: 'Password reset page',
  category: 'application',
  tags: ['auth', 'password', 'reset', 'forgot password'],
  description:
    'The first of the two password-reset screens: the reader types an email and the form is replaced by a "check your inbox" state. Install `auth-password-reset-new` for the second.',
  notes: [
    AUTH_PLACE_NOTE,
    'Installing this block also installs `auth-password-reset-new`, the screen the emailed link opens. Place it on the page the link points to — `/reset-password/new` by default — and the two together make the whole flow.',
    'The sent state reads the same whether or not an account exists for the address.',
    THEME_NOTE,
  ],
  params: [
    stringParam('iconName', 'The icon drawn as the app mark.', 'box'),
    stringParam('signInPath', 'The sign-in page.', '/sign-in'),
  ],
  env: [],
  requires: ['block/auth-password-reset-new'],
  build: ({ name, params }) => {
    const p = param(params)
    return asComponent(
      name,
      authPage([
        appMark(p('iconName')),
        authHeading(
          'Reset your password',
          'Enter your email and we send you a link to choose a new one.'
        ),
        {
          type: 'form',
          action: {
            type: 'auth',
            method: 'resetPassword',
            submitLabel: 'Send reset link',
            onSuccess: {
              type: 'successPage',
              title: 'Check your inbox',
              message:
                'If $form.email has an account, a link to choose a new password is on its way. It expires in an hour.',
            },
          },
        },
        footerLink('Remembered it?', 'Back to sign in', p('signInPath')),
      ])
    )
  },
})
