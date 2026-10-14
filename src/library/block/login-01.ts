/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { asComponent, param } from '@/library/manifest/block-kit'
import { defineLibraryEntry } from '@/library/manifest/define'
import { LOGIN_NOTES, centredCardScreen, loginParams } from '@/library/manifest/login-block-kit'
import {
  cardContent,
  cardHeader,
  fieldGroup,
  passwordColumn,
  signUpLine,
  socials,
} from '@/library/manifest/login-block-parts'

/** shadcn/ui's `login-01`, composed in config. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'login-01',
  shadcnBlock: 'login-01',
  title: 'Login 01',
  category: 'shadcn',
  tags: ['auth', 'sign-in', 'login', 'email', 'password', 'card', 'shadcn'],
  description: 'A simple login form.',
  notes: [
    'A card holding the email and password form, a social button and the sign-up line, centred on the page.',
    ...LOGIN_NOTES,
  ],
  params: loginParams('google'),
  env: [],
  requires: [],
  build: ({ name, params: values }) => {
    const s = { p: param(values) }
    return asComponent(
      name,
      centredCardScreen([
        cardHeader('Sign in to your account', 'Enter your email below to sign in.', false),
        cardContent([
          fieldGroup([...passwordColumn(s), ...socials(s, 'Sign in with'), signUpLine(s)]),
        ]),
      ])
    )
  },
})
