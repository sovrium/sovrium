/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { para } from '@/library/manifest/app-block-kit'
import {
  asComponent,
  BARE_FORM,
  endpointForm,
  card,
  h3,
  param,
  PLACE_NOTE,
  section,
  small,
  stack,
  stringParam,
  THEME_NOTE,
  when,
  wrap,
} from '@/library/manifest/block-kit'
import { defineLibraryEntry } from '@/library/manifest/define'

/** A wide card: the promise on the left, an email field beside its button on the right. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'newsletter-inline',
  title: 'Newsletter sign-up, inline field',
  category: 'marketing',
  tags: ['newsletter', 'email', 'sign-up', 'form'],
  description:
    'A wide card with the newsletter name and its promise on one side, and the email field sitting beside its submit button on the other.',
  notes: [
    PLACE_NOTE,
    THEME_NOTE,
    'The form posts `{ "email": "…" }` to the submissions route of the app form named by `form` (`/api/forms/<form>/submissions`) and shows a toast on success or failure. Declare that form under `forms:` with an `email` field — it decides where an address goes (a table through `submitTo`, a mailing tool through a `form` trigger or a library recipe) and who may sign up. Until it exists, a sign-up answers 404 and the error toast shows.',
    'The field and the button sit side by side from the small breakpoint up and stack on a phone.',
  ],
  params: [
    stringParam('headline', 'The newsletter name.', '[Newsletter name]'),
    stringParam(
      'subheadline',
      'What arrives and how often.',
      'What arrives, how often, and that one click unsubscribes.'
    ),
    stringParam(
      'form',
      'The name of the app form (under `forms:`) that receives the address.',
      'newsletter'
    ),
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
        wrap([
          card(
            [
              stack(
                [h3(p('headline')), para(p('subheadline'), 'text-md text-foreground-muted')],
                'max-w-md gap-2'
              ),
              stack(
                [
                  endpointForm({
                    url: `/api/forms/${encodeURIComponent(p('form'))}/submissions`,
                    submitLabel: p('submitLabel'),
                    successMessage: p('successMessage'),
                    errorMessage: 'The address could not be saved. Try again.',
                    className: `${BARE_FORM} sm:flex-row sm:items-end *:first:flex-1`,
                    fields: [
                      {
                        field: 'email',
                        control: 'email',
                        label: 'Email',
                        placeholder: 'you@example.com',
                      },
                    ],
                  }),
                  ...when(p('privacy'), small(p('privacy'))),
                ],
                'w-full max-w-md gap-2'
              ),
            ],
            'flex flex-col gap-8 p-6 sm:p-8 lg:flex-row lg:items-center lg:justify-between'
          ),
        ]),
      ])
    )
  },
})
