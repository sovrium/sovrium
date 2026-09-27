/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { defineLibraryEntry } from '@/library/manifest/define'

/** Each form submission invites the person into a Circle community. */
export const entry = defineLibraryEntry({
  kind: 'recipe',
  slug: 'form-to-circle-member',
  title: 'Invite each form submission into a Circle community',
  category: 'community',
  tags: ['circle', 'community', 'form', 'invite', 'onboarding'],
  description:
    'An automation that invites the person behind each submission of one of your forms into your Circle community, optionally into one space.',
  notes: [
    'The automation runs when the form named by `form` is submitted and invites the submitted email address, with the submitted name, through the `create-member` operation of the `circle` connection, which is installed with it. Circle sends its own invitation email.',
    'Set `spaceId` to place the new member in one space at once; find a space id in its settings in Circle. Circle refuses an address already in the community; the step then fails and the run shows the refusal.',
  ],
  params: [
    {
      name: 'form',
      description: 'The name of the form whose submissions are invited, from your `forms` list.',
      type: 'string',
      required: true,
    },
    {
      name: 'emailField',
      description: 'The form field holding the email address.',
      type: 'string',
      default: 'email',
    },
    {
      name: 'nameField',
      description: 'The form field holding the full name.',
      type: 'string',
      default: 'name',
    },
    {
      name: 'spaceId',
      description: 'The numeric id of a space to add the member to.',
      type: 'number',
    },
  ],
  env: [],
  requires: ['connection/circle'],
  provider: {
    name: 'Circle',
    docsUrl: 'https://api.circle.so/apis/admin-api',
    verifiedOn: '2026-09-24',
  },
  build: ({ name, params }) => {
    const { spaceId } = params
    return {
      name,
      trigger: { type: 'form', form: String(params['form'] ?? '') },
      actions: [
        {
          name: 'inviteMember',
          type: 'connection',
          operator: 'call',
          props: {
            connection: 'circle',
            operation: 'create-member',
            params: {
              email: `{{trigger.data.${String(params['emailField'] ?? 'email')}}}`,
              name: `{{trigger.data.${String(params['nameField'] ?? 'name')}}}`,
              ...(spaceId === undefined ? {} : { space_ids: [Number(spaceId)] }),
            },
          },
        },
      ],
    }
  },
})
