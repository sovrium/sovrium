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

/** The second step after a password: the code, or a recovery code instead. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'auth-two-factor',
  title: 'Two-step verification page',
  category: 'application',
  tags: ['auth', 'two-step', 'two-factor', '2fa', 'otp', 'recovery code'],
  description:
    'The second sign-in step for accounts with two-step on: the six-digit code from an authenticator app, autofilled where the device can, with a swap to a recovery code.',
  notes: [
    AUTH_PLACE_NOTE,
    'It needs `auth.twoFactor`. Place it on the page your sign-in sends two-step accounts to — the `twoStepPath` of the `auth-sign-in` block, `/two-step` by default, which a sign-in form names in `onTwoFactor.navigate`. The code field accepts the device’s one-time-code autofill.',
    'Opened with no sign-in waiting for its code, the page says the sign-in has expired and links to your sign-in page (`auth.loginPage`), and draws nothing else of the step: no code field, no recovery-code toggle, no second link. Set `auth.loginPage` to the page this block’s `signInPath` names.',
    'The recovery-code form is folded under "Use a recovery code instead", for a reader who lost the authenticator.',
    THEME_NOTE,
  ],
  params: [
    stringParam('iconName', 'The icon drawn as the app mark.', 'box'),
    stringParam('successPath', 'Where a verified reader lands.', '/'),
    stringParam('signInPath', 'The sign-in page.', '/sign-in'),
  ],
  env: [],
  requires: [],
  build: ({ name, params }) => {
    const p = param(params)
    const onSuccess = { navigate: p('successPath') }
    const recoveryId = `${name}-recovery`
    return asComponent(
      name,
      authPage([
        appMark(p('iconName')),
        authHeading(
          'Enter your code',
          'Open your authenticator app and type the six-digit code for $app.label.'
        ),
        {
          type: 'form',
          action: {
            type: 'auth',
            method: 'verifyTwoFactor',
            factor: 'totp',
            trustDevice: true,
            submitLabel: 'Verify',
            onSuccess,
          },
        },
        {
          type: 'button',
          variant: 'ghost',
          label: 'Use a recovery code instead',
          props: { 'aria-controls': recoveryId, className: 'self-start px-0' },
          interactions: { click: { toggleElement: `#${recoveryId}` } },
        },
        {
          type: 'container',
          props: { id: recoveryId, style: { display: 'none' }, className: 'flex flex-col gap-3' },
          children: [
            {
              type: 'form',
              action: {
                type: 'auth',
                method: 'verifyTwoFactor',
                factor: 'backupCode',
                submitLabel: 'Verify recovery code',
                onSuccess,
              },
            },
          ],
        },
        footerLink('', 'Back to sign in', p('signInPath')),
      ])
    )
  },
})
