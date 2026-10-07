/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  alternativeLink,
  appMark,
  AUTH_GATE_NOTE,
  AUTH_PLACE_NOTE,
  authHeading,
  authPage,
  footerLink,
  ifDeclared,
  quietLink,
} from '@/library/manifest/auth-block-kit'
import { asComponent, param, stringParam, THEME_NOTE } from '@/library/manifest/block-kit'
import { defineLibraryEntry } from '@/library/manifest/define'

/** The sign-in screen: email and password first, then every other way in the app offers. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'auth-sign-in',
  title: 'Sign-in page',
  category: 'application',
  tags: ['auth', 'sign-in', 'login', 'passkey', 'single sign-on'],
  description:
    'A sign-in screen with the email and password form, a link to reset a forgotten password, and the passkey, social and single sign-on alternatives your app turns on.',
  notes: [
    AUTH_PLACE_NOTE,
    AUTH_GATE_NOTE,
    'A wrong email or password reads as one message that never says whether the account exists. While the form is sending, its fields are inert and the button says so.',
    THEME_NOTE,
  ],
  params: [
    stringParam('iconName', 'The icon drawn as the app mark.', 'box'),
    stringParam('successPath', 'Where a signed-in reader lands.', '/'),
    stringParam('resetPath', 'The password-reset page.', '/reset-password'),
    stringParam('signUpPath', 'The sign-up page, linked when sign-up is open.', '/sign-up'),
    stringParam('ssoPath', 'The single sign-on page, linked when a provider is set.', '/sso'),
    stringParam(
      'magicLinkPath',
      'The magic-link page, linked when that way in is on.',
      '/magic-link'
    ),
    stringParam('provider', 'The social provider of the "Continue with" button.', 'google'),
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
        authHeading('Sign in', 'Welcome back. Use the email you signed up with.'),
        {
          type: 'form',
          action: {
            type: 'auth',
            method: 'login',
            strategy: 'email',
            submitLabel: 'Sign in',
            onSuccess,
          },
        },
        quietLink('Forgot password?', p('resetPath')),
        {
          // The other ways in, each drawn only when the app offers it. The
          // rule above them disappears with them when none is offered.
          type: 'flex',
          props: { className: 'flex flex-col gap-3 border-t border-border pt-6 empty:hidden' },
          children: [
            ifDeclared('auth.passkeys', {
              type: 'form',
              action: { type: 'auth', method: 'login', strategy: 'passkey', onSuccess },
            }),
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
            ifDeclared(
              'auth.magicLink',
              alternativeLink('Email me a sign-in link', p('magicLinkPath'))
            ),
            ifDeclared('auth.sso', alternativeLink('Use single sign-on', p('ssoPath'))),
          ],
        },
        ifDeclared('auth.signUp', footerLink('No account yet?', 'Create one', p('signUpPath'))),
      ])
    )
  },
})
