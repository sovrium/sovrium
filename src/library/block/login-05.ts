/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { asComponent, param } from '@/library/manifest/block-kit'
import { defineLibraryEntry } from '@/library/manifest/define'
import {
  LOGIN_NOTES,
  SIGN_IN_PARAM,
  bareScreen,
  loginParams,
} from '@/library/manifest/login-block-kit'
import {
  magicLinkForm,
  orSeparator,
  signUpLine,
  socials,
} from '@/library/manifest/login-block-parts'

/** shadcn/ui's `login-05`, composed in config. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'login-05',
  shadcnBlock: 'login-05',
  title: 'Login 05',
  category: 'shadcn',
  tags: ['auth', 'sign-in', 'login', 'email only', 'magic link', 'shadcn'],
  description: 'A simple email-only login page.',
  notes: [
    'No card: the app mark, a welcome heading and an email-only form that sends a sign-in link, with social buttons below.',
    ...LOGIN_NOTES,
  ],
  params: loginParams('github,google', { extra: [SIGN_IN_PARAM] }),
  env: [],
  requires: [],
  build: ({ name, params: values }) => {
    const s = { p: param(values) }
    return asComponent(
      name,
      bareScreen(s, signUpLine(s), [
        magicLinkForm('Send me a link'),
        ...orSeparator(s, 'Or'),
        ...socials(s, 'Continue with', { className: 'grid gap-4 sm:grid-cols-2' }),
        {
          type: 'link',
          props: {
            href: s.p('signInPath'),
            className: 'self-center text-sm underline-offset-4 hover:underline',
          },
          content: 'Sign in with a password',
        },
      ])
    )
  },
})
