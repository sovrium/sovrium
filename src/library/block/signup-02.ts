/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { asComponent, param } from '@/library/manifest/block-kit'
import { defineLibraryEntry } from '@/library/manifest/define'
import { SIGNUP_NOTES, coverScreen, signupParams } from '@/library/manifest/login-block-kit'
import {
  bareHeader,
  closedNotice,
  openOnly,
  orSeparator,
  signInLine,
  signUpForm,
  socials,
} from '@/library/manifest/login-block-parts'

/** shadcn/ui's `signup-02`, composed in config. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'signup-02',
  shadcnBlock: 'signup-02',
  title: 'Signup 02',
  category: 'shadcn',
  tags: ['auth', 'sign-up', 'register', 'two column', 'cover image', 'shadcn'],
  description: 'A two column signup page with a cover image.',
  notes: [
    'Two columns: the app mark and the sign-up form on one side, a cover image on the other from the `lg` breakpoint.',
    ...SIGNUP_NOTES,
  ],
  params: signupParams('github', { image: true }),
  env: [],
  requires: [],
  build: ({ name, params: values }) => {
    const s = { p: param(values) }
    return asComponent(
      name,
      coverScreen(s, [
        ...openOnly([
          bareHeader('Create your account', 'Fill in the form below to create your account.'),
          signUpForm('Create account', s.p('successPath')),
          ...orSeparator(s, 'Or continue with'),
          ...socials(s, 'Sign up with'),
          signInLine(s),
        ]),
        closedNotice(s),
      ])
    )
  },
})
