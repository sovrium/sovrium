/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { ifDeclared } from '@/library/manifest/auth-block-kit'
import { asComponent, param, stringParam, THEME_NOTE } from '@/library/manifest/block-kit'
import { defineLibraryEntry } from '@/library/manifest/define'
import {
  SETTINGS_PLACE_NOTE,
  settingsColumn,
  settingsGroup,
  settingsListRow,
  settingsRow,
  settingsTitle,
} from '@/library/manifest/settings-block-kit'

type Node = Readonly<Record<string, unknown>>

/** The passkeys group: the add button, and the reader's passkeys with rename and remove. */
const passkeysGroup = (): Node =>
  ifDeclared(
    'auth.passkeys',
    settingsGroup(
      'Passkeys',
      'Sign in with your fingerprint, face or device PIN instead of a password.',
      [
        settingsListRow([
          {
            type: 'table',
            props: { 'aria-label': 'Passkeys' },
            dataSource: { auth: 'passkeys' },
            columns: [
              { field: 'name', label: 'Name' },
              { field: 'deviceType', label: 'Type' },
              { field: 'createdAt', label: 'Added', format: 'short-date' },
              {
                type: 'actions',
                actions: [
                  {
                    label: 'Remove',
                    variant: 'ghost',
                    action: { type: 'auth', method: 'removePasskey', target: '$record.id' },
                    confirm: {
                      title: 'Remove this passkey?',
                      message: 'You can no longer sign in with $record.name.',
                      confirmLabel: 'Remove passkey',
                    },
                  },
                ],
              },
            ],
            emptyMessage: 'No passkey yet. Add one to sign in without a password.',
          },
        ]),
      ],
      {
        side: [
          {
            type: 'form',
            action: { type: 'auth', method: 'registerPasskey', submitLabel: 'Add a passkey' },
          },
        ],
      }
    )
  )

/** The two-step group: turn it on with an authenticator app, or off again. */
const twoStepGroup = (): Node =>
  ifDeclared(
    'auth.twoFactor',
    settingsGroup('Two-step verification', 'Ask for a code from your phone after your password.', [
      settingsRow('Authenticator app', 'Confirm your password, then scan the code with the app.', [
        {
          type: 'form',
          action: { type: 'auth', method: 'enableTwoFactor', submitLabel: 'Turn on two-step' },
        },
      ]),
      settingsRow('Turn it off', 'Your account goes back to password only.', [
        {
          type: 'form',
          action: { type: 'auth', method: 'disableTwoFactor', submitLabel: 'Turn off two-step' },
        },
      ]),
    ])
  )

/** The devices group: every signed-in session, this one marked, the others revocable. */
const devicesGroup = (): Node =>
  settingsGroup(
    'Signed-in devices',
    'Where your account is signed in right now. Sign a device out if you do not recognise it.',
    [
      settingsListRow([
        {
          type: 'table',
          props: { 'aria-label': 'Signed-in devices' },
          dataSource: { auth: 'sessions' },
          columns: [
            { field: 'device', label: 'Device' },
            { field: 'ipAddress', label: 'Address' },
            { field: 'lastActiveAt', label: 'Last active', format: 'relative-date' },
            {
              type: 'actions',
              actions: [
                {
                  label: 'Sign out',
                  variant: 'ghost',
                  action: { type: 'auth', method: 'revokeSession', target: '$record.id' },
                  visibleWhen: { field: 'current', eq: false },
                },
              ],
            },
          ],
        },
      ]),
    ],
    {
      side: [
        {
          type: 'form',
          action: {
            type: 'auth',
            method: 'revokeOtherSessions',
            submitLabel: 'Sign out everywhere else',
          },
        },
      ],
    }
  )

/** Passkeys, two-step verification and the devices signed in. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'settings-security',
  title: 'Security settings',
  category: 'application',
  tags: ['settings', 'security', 'passkeys', 'two-step', '2fa', 'sessions', 'devices'],
  description:
    'The signed-in reader’s security page: add and remove passkeys, turn two-step verification on or off, and see every device signed in — this one marked, the others one click from signed out.',
  notes: [
    SETTINGS_PLACE_NOTE,
    'The passkeys group is drawn when `auth.passkeys` is on, the two-step group when `auth.twoFactor` is; the devices group is always drawn. Each list shows only the reader’s own items — no config can widen it.',
    'This device is marked in the list and cannot be signed out from it; "Sign out everywhere else" ends every other session at once.',
    THEME_NOTE,
  ],
  params: [stringParam('headline', 'The page heading.', 'Security')],
  env: [],
  requires: [],
  build: ({ name, params }) => {
    const p = param(params)
    return asComponent(
      name,
      settingsColumn([
        settingsTitle(p('headline'), 'How you prove it is you, and where you are signed in.'),
        passkeysGroup(),
        twoStepGroup(),
        devicesGroup(),
      ])
    )
  },
})
