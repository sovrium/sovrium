/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  asComponent,
  BARE_FORM,
  endpointForm,
  card,
  h2,
  icon,
  param,
  PLACE_NOTE,
  section,
  small,
  stringParam,
  THEME_NOTE,
  when,
  wrap,
} from '@/library/manifest/block-kit'
import { defineLibraryEntry } from '@/library/manifest/define'

/** A centred card with one email field that posts to your own endpoint. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'newsletter-centered',
  title: 'Newsletter sign-up in a centred card',
  category: 'marketing',
  tags: ['newsletter', 'email', 'sign-up', 'form'],
  description:
    'A centred card with an icon, a promise of what arrives and how often, and one email field with its submit button.',
  notes: [
    PLACE_NOTE,
    THEME_NOTE,
    'The form posts `{ "email": "…" }` as JSON to `endpoint` — your own route, or an automation webhook — and shows a toast on success or failure. It writes to no table, so the block installs into any app.',
    'To store sign-ups in a table instead, replace `endpoint` in the fragment with a `dataSource` naming the table and its email field.',
  ],
  params: [
    stringParam('headline', 'The heading.', 'Get [the thing] by email'),
    stringParam(
      'subheadline',
      'One sentence on cadence and content.',
      'One sentence on cadence and content. Nothing else.'
    ),
    stringParam('endpoint', 'The URL the form posts the email address to.', '/api/newsletter'),
    stringParam('submitLabel', 'The text of the submit button.', 'Subscribe'),
    stringParam(
      'successMessage',
      'The toast shown once the address is accepted.',
      'You are subscribed.'
    ),
    stringParam(
      'privacy',
      'A small line under the form. Empty to omit.',
      '[Privacy line — link to the policy]'
    ),
  ],
  env: [],
  requires: [],
  build: ({ name, params }) => {
    const p = param(params)
    return asComponent(
      name,
      section([
        wrap(
          [
            card(
              [
                icon('mail', 'text-foreground', 26),
                h2(p('headline'), 'sm:text-4xl'),
                small(p('subheadline'), 'max-w-md text-md text-foreground-muted'),
                {
                  type: 'container',
                  props: { className: 'mt-2 w-full max-w-sm text-left' },
                  children: [
                    endpointForm({
                      className: BARE_FORM,
                      url: p('endpoint'),
                      submitLabel: p('submitLabel'),
                      successMessage: p('successMessage'),
                      errorMessage: 'The address could not be saved. Try again.',
                      fields: [
                        {
                          field: 'email',
                          control: 'email',
                          label: 'Email',
                          placeholder: 'you@example.com',
                        },
                      ],
                    }),
                  ],
                },
                ...when(p('privacy'), small(p('privacy'))),
              ],
              'flex flex-col items-center gap-4 px-6 py-12 text-center sm:px-10 sm:py-14'
            ),
          ],
          'max-w-2xl'
        ),
      ])
    )
  },
})
