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
  settingsTitle,
} from '@/library/manifest/settings-block-kit'

type Node = Readonly<Record<string, unknown>>

/** The reader's keys by name and prefix, never the key itself. */
const keysGrid = (): Node => ({
  type: 'table',
  props: { 'aria-label': 'API keys' },
  dataSource: { auth: 'apiKeys' },
  columns: [
    { field: 'name', label: 'Name' },
    { field: 'prefix', label: 'Key' },
    { field: 'lastUsedAt', label: 'Last used', format: 'relative-date' },
    { field: 'expiresAt', label: 'Expires', format: 'short-date' },
    {
      type: 'actions',
      actions: [
        {
          label: 'Revoke',
          variant: 'ghost',
          action: { type: 'auth', method: 'revokeApiKey', target: '$record.id' },
          confirm: {
            title: 'Revoke this key?',
            message: 'Anything using this key stops working at once.',
            confirmLabel: 'Revoke key',
          },
        },
      ],
    },
  ],
  emptyMessage: 'No key yet. Create one to call the API from a script.',
})

/** The create dialog; the new key is shown in it once, then never again. */
const createDialog = (dialogId: string): Node => ({
  type: 'dialog',
  props: {
    id: dialogId,
    title: 'Create an API key',
    description: 'Name it after what will use it, so you know which one to revoke.',
  },
  children: [
    { type: 'form', action: { type: 'auth', method: 'createApiKey', submitLabel: 'Create key' } },
  ],
})

/** The reader's API keys: listed by name and prefix, created in a dialog, revealed once. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'settings-api-keys',
  title: 'API keys settings',
  category: 'application',
  tags: ['settings', 'api keys', 'tokens', 'developer', 'integration'],
  description:
    'The signed-in reader’s API keys: each listed by name, prefix, last use and expiry, created from a dialog that shows the new key once, and revoked behind a confirmation.',
  notes: [
    SETTINGS_PLACE_NOTE,
    'It needs `auth.apiKeys: true`; without it the page draws nothing but its heading. A new key is shown once, in the dialog, and never again — the reader confirms they copied it before the dialog closes.',
    'The list never holds a key itself, only its first characters, so a key cannot be read back from the page.',
    THEME_NOTE,
  ],
  params: [stringParam('headline', 'The page heading.', 'API keys')],
  env: [],
  requires: [],
  build: ({ name, params }) => {
    const p = param(params)
    const dialogId = `${name}-create`
    return asComponent(
      name,
      settingsColumn(
        [
          settingsTitle(
            p('headline'),
            'Keys let a script or another tool act as you through the API.'
          ),
          ifDeclared(
            'auth.apiKeys',
            settingsGroup(
              'Your keys',
              'Revoke a key the moment you stop using it.',
              [settingsListRow([keysGrid()])],
              {
                side: [
                  {
                    type: 'button',
                    props: { label: 'Create key', interactions: { click: { modal: dialogId } } },
                  },
                ],
              }
            )
          ),
          createDialog(dialogId),
        ],
        true
      )
    )
  },
})
