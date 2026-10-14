/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { ifDeclared } from '@/library/manifest/auth-block-kit'
import { asComponent, param } from '@/library/manifest/block-kit'
import { defineLibraryEntry } from '@/library/manifest/define'
import {
  ALTERNATIVE_PARAMS,
  LOGIN_NOTES,
  loginParams,
  mutedCardScreen,
} from '@/library/manifest/login-block-kit'
import {
  cardContent,
  cardHeader,
  fieldGroup,
  orSeparator,
  outlineLink,
  passwordColumn,
  signUpLine,
  socials,
} from '@/library/manifest/login-block-parts'

/** shadcn/ui's `login-03`, composed in config. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'login-03',
  shadcnBlock: 'login-03',
  title: 'Login 03',
  category: 'shadcn',
  tags: ['auth', 'sign-in', 'login', 'muted', 'social', 'passkey', 'single sign-on', 'shadcn'],
  description: 'A login page with a muted background color.',
  notes: [
    'The app mark above a card on a muted ground: social buttons first, then the email form, then every other way in your app offers.',
    ...LOGIN_NOTES,
  ],
  params: loginParams('github,google', { extra: ALTERNATIVE_PARAMS }),
  env: [],
  requires: [],
  build: ({ name, params: values }) => {
    const s = { p: param(values) }
    return asComponent(
      name,
      mutedCardScreen(s, [
        cardHeader('Welcome back', 'Sign in with your email, or the way your team uses.', true),
        cardContent([
          fieldGroup([
            ...socials(s, 'Sign in with'),
            ifDeclared('auth.passkeys', {
              type: 'form',
              action: {
                type: 'auth',
                method: 'login',
                strategy: 'passkey',
                onSuccess: { navigate: s.p('successPath') },
              },
            }),
            ...orSeparator(s, 'Or continue with'),
            ...passwordColumn(s),
            ifDeclared(
              'auth.magicLink',
              outlineLink('Email me a sign-in link', s.p('magicLinkPath'))
            ),
            ifDeclared('auth.sso', outlineLink('Use single sign-on', s.p('ssoPath'))),
            signUpLine(s),
          ]),
        ]),
      ])
    )
  },
})
