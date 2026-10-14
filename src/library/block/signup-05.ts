/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { asComponent, param } from '@/library/manifest/block-kit'
import { defineLibraryEntry } from '@/library/manifest/define'
import { SIGNUP_NOTES, bareScreen, signupParams } from '@/library/manifest/login-block-kit'
import {
  closedNotice,
  openOnly,
  orSeparator,
  signInLine,
  signUpForm,
  socials,
} from '@/library/manifest/login-block-parts'

/** shadcn/ui's `signup-05`, composed in config. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'signup-05',
  shadcnBlock: 'signup-05',
  title: 'Signup 05',
  category: 'shadcn',
  tags: ['auth', 'sign-up', 'register', 'social', 'shadcn'],
  description: 'A simple signup form with social providers.',
  notes: [
    'No card: the app mark, a welcome heading, the sign-up form and social buttons below.',
    ...SIGNUP_NOTES,
  ],
  params: signupParams('github,google'),
  env: [],
  requires: [],
  build: ({ name, params: values }) => {
    const s = { p: param(values) }
    return asComponent(
      name,
      bareScreen(s, signInLine(s), [
        ...openOnly([
          signUpForm('Create account', s.p('successPath')),
          ...orSeparator(s, 'Or'),
          ...socials(s, 'Continue with', { className: 'grid gap-4 sm:grid-cols-2' }),
        ]),
        closedNotice(s),
      ])
    )
  },
})
