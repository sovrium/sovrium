/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  appMark,
  AUTH_PLACE_NOTE,
  authHeading,
  authPage,
  footerLink,
} from '@/library/manifest/auth-block-kit'
import { asComponent, param, stringParam, THEME_NOTE } from '@/library/manifest/block-kit'
import { defineLibraryEntry } from '@/library/manifest/define'

/** The single sign-on screen: a work email routed to the provider owning its domain. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'auth-sso',
  title: 'Single sign-on page',
  category: 'application',
  tags: ['auth', 'single sign-on', 'sso', 'saml', 'openid'],
  description:
    'A single sign-on screen that sends a work email to the identity provider owning its domain, with one button per provider for people who know which one is theirs.',
  notes: [
    AUTH_PLACE_NOTE,
    'The providers come from `auth.sso`: each one draws a button, and a provider listing `domains` routes any email on those domains to itself. An email on a domain no provider owns gets a message naming the domain, and nobody is contacted.',
    'Link to this page from the sign-in screen: the `auth-sign-in` block draws "Use single sign-on" when a provider is set, pointing at `/sso`.',
    THEME_NOTE,
  ],
  params: [
    stringParam('iconName', 'The icon drawn as the app mark.', 'box'),
    stringParam('successPath', 'Where a signed-in reader lands.', '/'),
    stringParam('signInPath', 'The ordinary sign-in page.', '/sign-in'),
  ],
  env: [],
  requires: [],
  build: ({ name, params }) => {
    const p = param(params)
    return asComponent(
      name,
      authPage([
        appMark(p('iconName')),
        authHeading(
          'Sign in with single sign-on',
          'Enter your work email and we send you to your company’s sign-in page.'
        ),
        {
          type: 'form',
          action: {
            type: 'auth',
            method: 'login',
            strategy: 'sso',
            onSuccess: { navigate: p('successPath') },
          },
        },
        footerLink('', 'Sign in another way', p('signInPath')),
      ])
    )
  },
})
