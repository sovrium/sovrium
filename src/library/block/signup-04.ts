/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { asComponent, param } from '@/library/manifest/block-kit'
import { defineLibraryEntry } from '@/library/manifest/define'
import {
  COMPACT_ROW,
  SIGNUP_NOTES,
  signupParams,
  splitCardScreen,
} from '@/library/manifest/login-block-kit'
import {
  bareHeader,
  closedNotice,
  openOnly,
  orSeparator,
  signInLine,
  signUpForm,
  socials,
} from '@/library/manifest/login-block-parts'

/** shadcn/ui's `signup-04`, composed in config. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'signup-04',
  shadcnBlock: 'signup-04',
  title: 'Signup 04',
  category: 'shadcn',
  tags: ['auth', 'sign-up', 'register', 'card', 'cover image', 'shadcn'],
  description: 'A signup page with form and image.',
  notes: [
    'One wide card on a muted ground: the sign-up form on one half, a cover image on the other from the `md` breakpoint.',
    ...SIGNUP_NOTES,
  ],
  params: signupParams('google,github', { image: true }),
  env: [],
  requires: [],
  build: ({ name, params: values }) => {
    const s = { p: param(values) }
    return asComponent(
      name,
      splitCardScreen(s, [
        ...openOnly([
          bareHeader(
            'Create your account',
            'Enter your email below to create your account.',
            'gap-2'
          ),
          signUpForm('Create account', s.p('successPath')),
          ...orSeparator(s, 'Or continue with'),
          ...socials(s, 'Sign up with', { className: COMPACT_ROW, compact: true }),
          signInLine(s),
        ]),
        closedNotice(s),
      ])
    )
  },
})
