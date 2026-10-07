/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  appMark,
  AUTH_GATE_NOTE,
  AUTH_PLACE_NOTE,
  authColumn,
  authHeading,
  authPage,
  footerLink,
  ifDeclared,
  orDivider,
  unlessDeclared,
} from '@/library/manifest/auth-block-kit'
import { asComponent, param, stringParam, THEME_NOTE } from '@/library/manifest/block-kit'
import { defineLibraryEntry } from '@/library/manifest/define'

/** The sign-up screen, with the closed variant an app that closed sign-up shows instead. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'auth-sign-up',
  title: 'Sign-up page',
  category: 'application',
  tags: ['auth', 'sign-up', 'register', 'account'],
  description:
    'A create-your-account screen with the email form and the social alternative, which turns into a short "ask for access" page when your app has closed sign-up.',
  notes: [
    AUTH_PLACE_NOTE,
    'When `auth.allowSignUp` is `false` the form is not drawn at all: the page says sign-up is closed, how to get access, and links to sign-in. Open sign-up again and the form comes back, with no edit to the block.',
    AUTH_GATE_NOTE,
    THEME_NOTE,
  ],
  params: [
    stringParam('iconName', 'The icon drawn as the app mark.', 'box'),
    stringParam('successPath', 'Where a new account lands.', '/'),
    stringParam('signInPath', 'The sign-in page.', '/sign-in'),
    stringParam('provider', 'The social provider of the "Continue with" button.', 'google'),
    stringParam(
      'closedMessage',
      'What the closed variant says about getting access.',
      'Ask an administrator of $app.label to invite you. The invitation email has a link that creates your account.'
    ),
  ],
  env: [],
  requires: [],
  build: ({ name, params }) => {
    const p = param(params)
    const onSuccess = { navigate: p('successPath') }
    return asComponent(
      name,
      authPage([
        appMark(p('iconName')),
        ifDeclared(
          'auth.signUp',
          authColumn([
            authHeading(
              'Create your account',
              'It takes a minute. You can change everything later.'
            ),
            {
              type: 'form',
              action: {
                type: 'auth',
                method: 'signup',
                strategy: 'email',
                submitLabel: 'Create account',
                onSuccess,
              },
            },
            ifDeclared('auth.oauth', orDivider()),
            ifDeclared('auth.oauth', {
              type: 'form',
              action: {
                type: 'auth',
                method: 'login',
                strategy: 'oauth',
                provider: p('provider'),
                onSuccess,
              },
            }),
            footerLink('Already have an account?', 'Sign in', p('signInPath')),
          ])
        ),
        unlessDeclared(
          'auth.signUp',
          authColumn([
            authHeading('Sign-up is closed', p('closedMessage')),
            footerLink('Already have an account?', 'Sign in', p('signInPath')),
          ])
        ),
      ])
    )
  },
})
