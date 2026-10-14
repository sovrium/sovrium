/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { asComponent, param } from '@/library/manifest/block-kit'
import { defineLibraryEntry } from '@/library/manifest/define'
import { SIGNUP_NOTES, centredCardScreen, signupParams } from '@/library/manifest/login-block-kit'
import {
  cardContent,
  cardHeader,
  closedNotice,
  fieldGroup,
  openOnly,
  signInLine,
  signUpForm,
  socials,
} from '@/library/manifest/login-block-parts'

/** shadcn/ui's `signup-01`, composed in config. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'signup-01',
  shadcnBlock: 'signup-01',
  title: 'Signup 01',
  category: 'shadcn',
  tags: ['auth', 'sign-up', 'register', 'card', 'shadcn'],
  description: 'A simple signup form.',
  notes: [
    'A card holding the sign-up form, a social button and the sign-in line, centred on the page.',
    ...SIGNUP_NOTES,
  ],
  params: signupParams('google'),
  env: [],
  requires: [],
  build: ({ name, params: values }) => {
    const s = { p: param(values) }
    return asComponent(
      name,
      centredCardScreen([
        ...openOnly([
          cardHeader('Create an account', 'Enter your email below to create your account.', false),
        ]),
        cardContent([
          fieldGroup([
            ...openOnly([
              signUpForm('Create account', s.p('successPath')),
              ...socials(s, 'Sign up with'),
              signInLine(s),
            ]),
            closedNotice(s),
          ]),
        ]),
      ])
    )
  },
})
