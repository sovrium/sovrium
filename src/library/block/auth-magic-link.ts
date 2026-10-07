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

/** Sign in by emailed link: one field, then a sent state naming the address. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'auth-magic-link',
  title: 'Magic link sign-in page',
  category: 'application',
  tags: ['auth', 'magic link', 'passwordless', 'sign-in', 'email'],
  description:
    'A passwordless sign-in screen: the reader types an email, and the form is replaced by a "check your inbox" state naming the address the link went to.',
  notes: [
    AUTH_PLACE_NOTE,
    'It needs the `magicLink` strategy in `auth.strategies`, and an email sender: without one the link is written to the server log, which is enough while you build.',
    'The sent state names the address and never says whether an account exists for it, so the page cannot be used to find out who has one.',
    THEME_NOTE,
  ],
  params: [
    stringParam('iconName', 'The icon drawn as the app mark.', 'box'),
    stringParam('signInPath', 'The password sign-in page.', '/sign-in'),
  ],
  env: [],
  requires: [],
  build: ({ name, params }) => {
    const p = param(params)
    return asComponent(
      name,
      authPage([
        appMark(p('iconName')),
        authHeading(
          'Sign in with a link',
          'We email you a link that signs you in. No password needed.'
        ),
        {
          type: 'form',
          action: {
            type: 'auth',
            method: 'login',
            strategy: 'magicLink',
            submitLabel: 'Send me a link',
            onSuccess: {
              type: 'successPage',
              title: 'Check your inbox',
              message:
                'We sent a sign-in link to $form.email. It works once and expires soon. Nothing there? Check your spam folder, or send a new one.',
            },
          },
        },
        footerLink('', 'Sign in with a password', p('signInPath')),
      ])
    )
  },
})
