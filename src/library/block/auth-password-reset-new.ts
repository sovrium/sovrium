/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { appMark, AUTH_PLACE_NOTE, authHeading, authPage } from '@/library/manifest/auth-block-kit'
import { asComponent, param, stringParam, THEME_NOTE } from '@/library/manifest/block-kit'
import { defineLibraryEntry } from '@/library/manifest/define'

/** Step two of a password reset: the page the emailed link opens. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'auth-password-reset-new',
  title: 'Choose a new password page',
  category: 'application',
  tags: ['auth', 'password', 'reset', 'new password'],
  description:
    'The screen a password-reset link opens: one new-password field, then the reader is signed in with it.',
  notes: [
    AUTH_PLACE_NOTE,
    'Place it on the page the reset email links to (`/reset-password/new` by default). The token arrives in the address, so the page needs no parameter of its own. A link that has expired or been used says so and offers to send a new one.',
    THEME_NOTE,
  ],
  params: [
    stringParam('iconName', 'The icon drawn as the app mark.', 'box'),
    stringParam('successPath', 'Where the reader lands once the password is set.', '/sign-in'),
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
          'Choose a new password',
          'Use at least eight characters. You sign in with it from now on.'
        ),
        {
          type: 'form',
          action: {
            type: 'auth',
            method: 'setNewPassword',
            submitLabel: 'Save password',
            fields: [{ name: 'password', label: 'New password' }],
            onSuccess: { navigate: p('successPath') },
          },
        },
      ])
    )
  },
})
