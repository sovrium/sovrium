/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { asComponent, param, stringParam, THEME_NOTE } from '@/library/manifest/block-kit'
import { defineLibraryEntry } from '@/library/manifest/define'
import {
  accountEndpointForm,
  SETTINGS_PLACE_NOTE,
  settingsColumn,
  settingsGroup,
  settingsRow,
  settingsTitle,
} from '@/library/manifest/settings-block-kit'

type Node = Readonly<Record<string, unknown>>

/** The profile and email groups: each row one self-service form. */
const identityGroups = (): readonly Node[] => [
  settingsGroup('Profile', 'How you appear to the people you work with.', [
    settingsRow('Name', 'Shown on your comments and activity.', [
      accountEndpointForm({
        url: '/api/auth/update-user',
        label: 'Name',
        submitLabel: 'Save name',
        saved: 'Name saved.',
        failed: 'Your name could not be saved. Try again.',
        fields: [
          {
            field: 'name',
            control: 'text',
            label: 'Name',
            defaultValue: '$session.name',
            autocomplete: 'name',
          },
        ],
      }),
    ]),
  ]),
  settingsGroup('Email', 'Where sign-in links and notifications go.', [
    settingsRow(
      'Email address',
      'We send a link to the new address; it changes once you open it.',
      [
        accountEndpointForm({
          url: '/api/auth/change-email',
          label: 'Email address',
          submitLabel: 'Change email',
          saved: 'Check the new inbox for a confirmation link.',
          failed: 'The email could not be changed. Check the address and try again.',
          fields: [
            {
              field: 'newEmail',
              control: 'email',
              label: 'New email',
              defaultValue: '$session.email',
              autocomplete: 'email',
            },
          ],
        }),
      ]
    ),
  ]),
]

/** The password group. */
const passwordGroup = (): Node =>
  settingsGroup('Password', 'Use one you do not use anywhere else.', [
    settingsRow('Change password', 'Your other devices stay signed in.', [
      accountEndpointForm({
        url: '/api/auth/change-password',
        label: 'Change password',
        submitLabel: 'Change password',
        saved: 'Password changed.',
        failed: 'The password could not be changed. Check the current one and try again.',
        fields: [
          {
            field: 'currentPassword',
            control: 'password',
            label: 'Current password',
            autocomplete: 'current-password',
          },
          {
            field: 'newPassword',
            control: 'password',
            label: 'New password',
            autocomplete: 'new-password',
          },
        ],
      }),
    ]),
  ])

/**
 * The export group, for a signed-in reader only: one button saving the account
 * export — everything the app holds about that reader, and nothing about anyone
 * else — as a JSON file.
 */
const downloadGroup = (): Node => ({
  ...settingsGroup('Download my data', 'A copy of everything this app holds about you.', [
    settingsRow(
      'Your data',
      'Your profile, your sessions and what you created, as one JSON file.',
      [
        {
          type: 'button',
          label: 'Download my data',
          variant: 'outline',
          props: { className: 'self-start' },
          action: {
            type: 'fetch',
            mode: 'download',
            url: '/api/account/export',
            filename: 'my-account-data.json',
            onError: {
              type: 'toast',
              variant: 'destructive',
              message: 'Your data could not be downloaded. Try again.',
            },
          },
        },
      ]
    ),
  ]),
  visibility: { when: 'authenticated' },
})

/** The delete group: one button opening a confirmation that needs the reader's email typed. */
const deleteGroup = (dialogId: string): Node =>
  settingsGroup(
    'Delete account',
    'This removes your account and everything only you can see. It cannot be undone.',
    [
      settingsRow('Delete your account', 'You are signed out everywhere, at once.', [
        {
          type: 'button',
          variant: 'destructive',
          props: {
            label: 'Delete account…',
            className: 'self-start',
            interactions: { click: { modal: dialogId } },
          },
        },
        {
          type: 'alert-dialog',
          props: { id: dialogId, title: 'Delete your account?' },
          content:
            'Your account, your sessions and everything only you can see are deleted. Records you shared stay with the team. Type your email to confirm.',
          confirmLabel: 'Delete account',
          cancelLabel: 'Keep my account',
          confirmText: '$session.email',
          action: {
            type: 'fetch',
            url: '/api/auth/delete-user',
            method: 'POST',
            onSuccess: {
              type: 'toast',
              variant: 'success',
              message: 'Your account is deleted.',
              reload: true,
            },
          },
        },
      ]),
    ],
    { danger: true }
  )

/** The reader's own account: name, email, password, a copy of their data, and a guarded delete. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'settings-account',
  title: 'Account settings',
  category: 'application',
  tags: [
    'settings',
    'account',
    'profile',
    'password',
    'email',
    'download my data',
    'data export',
    'gdpr',
    'delete account',
  ],
  description:
    'The signed-in reader’s own account page: change the name, the email and the password, each from its own row, download a copy of their own data, and delete the account behind a confirmation that needs the email typed.',
  notes: [
    SETTINGS_PLACE_NOTE,
    'Every row talks to the built-in account endpoints, so the block needs `auth` and nothing else — no table of your own.',
    '“Download my data” saves the account export, `GET /api/account/export`, as a JSON file: the reader’s profile, sessions and the records they created, never anyone else’s. It is drawn for a signed-in reader only.',
    'Deleting the account asks the reader to type their own email before the button wakes up, and names what goes with it. Once it is gone the page reloads, signed out.',
    THEME_NOTE,
  ],
  params: [stringParam('headline', 'The page heading.', 'Account')],
  env: [],
  requires: [],
  build: ({ name, params }) => {
    const p = param(params)
    return asComponent(
      name,
      settingsColumn([
        settingsTitle(p('headline'), 'Your name, how you sign in, and your account itself.'),
        ...identityGroups(),
        passwordGroup(),
        downloadGroup(),
        deleteGroup(`${name}-delete`),
      ])
    )
  },
})
