/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { asComponent, param } from '@/library/manifest/block-kit'
import { defineLibraryEntry } from '@/library/manifest/define'
import { LOGIN_NOTES, coverScreen, loginParams } from '@/library/manifest/login-block-kit'
import {
  bareHeader,
  orSeparator,
  passwordColumn,
  signUpLine,
  socials,
} from '@/library/manifest/login-block-parts'

/** shadcn/ui's `login-02`, composed in config. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'login-02',
  shadcnBlock: 'login-02',
  title: 'Login 02',
  category: 'shadcn',
  tags: ['auth', 'sign-in', 'login', 'two column', 'cover image', 'shadcn'],
  description: 'A two column login page with a cover image.',
  notes: [
    'Two columns: the app mark and the form on one side, a cover image on the other from the `lg` breakpoint.',
    ...LOGIN_NOTES,
  ],
  params: loginParams('github', { image: true }),
  env: [],
  requires: [],
  build: ({ name, params: values }) => {
    const s = { p: param(values) }
    return asComponent(
      name,
      coverScreen(s, [
        bareHeader('Sign in to your account', 'Enter your email below to sign in.'),
        ...passwordColumn(s),
        ...orSeparator(s, 'Or continue with'),
        ...socials(s, 'Sign in with'),
        signUpLine(s),
      ])
    )
  },
})
