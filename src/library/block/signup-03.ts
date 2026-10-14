/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { asComponent, param } from '@/library/manifest/block-kit'
import { defineLibraryEntry } from '@/library/manifest/define'
import { SIGNUP_NOTES, mutedCardScreen, signupParams } from '@/library/manifest/login-block-kit'
import {
  cardContent,
  cardHeader,
  closedNotice,
  fieldGroup,
  openOnly,
  signInLine,
  signUpForm,
} from '@/library/manifest/login-block-parts'

/** shadcn/ui's `signup-03`, composed in config. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'signup-03',
  shadcnBlock: 'signup-03',
  title: 'Signup 03',
  category: 'shadcn',
  tags: ['auth', 'sign-up', 'register', 'muted', 'shadcn'],
  description: 'A signup page with a muted background color.',
  notes: [
    'The app mark above a card on a muted ground, with the sign-up form and the sign-in line.',
    ...SIGNUP_NOTES,
  ],
  params: signupParams(''),
  env: [],
  requires: [],
  build: ({ name, params: values }) => {
    const s = { p: param(values) }
    return asComponent(
      name,
      mutedCardScreen(s, [
        ...openOnly([
          cardHeader('Create your account', 'Enter your email below to create your account.', true),
        ]),
        cardContent([
          fieldGroup([
            ...openOnly([signUpForm('Create account', s.p('successPath')), signInLine(s)]),
            closedNotice(s),
          ]),
        ]),
      ])
    )
  },
})
