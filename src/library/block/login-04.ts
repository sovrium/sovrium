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
  LOGIN_NOTES,
  loginParams,
  splitCardScreen,
} from '@/library/manifest/login-block-kit'
import {
  bareHeader,
  orSeparator,
  passwordColumn,
  signUpLine,
  socials,
} from '@/library/manifest/login-block-parts'

/** shadcn/ui's `login-04`, composed in config. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'login-04',
  shadcnBlock: 'login-04',
  title: 'Login 04',
  category: 'shadcn',
  tags: ['auth', 'sign-in', 'login', 'card', 'cover image', 'shadcn'],
  description: 'A login page with form and image.',
  notes: [
    'One wide card on a muted ground: the form on one half, a cover image on the other from the `md` breakpoint.',
    ...LOGIN_NOTES,
  ],
  params: loginParams('google,github', { image: true }),
  env: [],
  requires: [],
  build: ({ name, params: values }) => {
    const s = { p: param(values) }
    return asComponent(
      name,
      splitCardScreen(s, [
        bareHeader('Welcome back', 'Sign in to your $app.label account.', 'gap-2'),
        ...passwordColumn(s),
        ...orSeparator(s, 'Or continue with'),
        ...socials(s, 'Sign in with', { className: COMPACT_ROW, compact: true }),
        signUpLine(s),
      ])
    )
  },
})
