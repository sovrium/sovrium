/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  asComponent,
  endpointForm,
  param,
  PLACE_NOTE,
  section,
  sectionHead,
  small,
  stack,
  stringParam,
  THEME_NOTE,
  when,
} from '@/library/manifest/block-kit'
import { defineLibraryEntry } from '@/library/manifest/define'

/** A narrow, centred contact form. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'contact-centered',
  title: 'Centered contact form',
  category: 'marketing',
  tags: ['contact', 'form', 'email'],
  description:
    'A centred heading and one sentence over a single-column name, email and message form.',
  notes: [
    PLACE_NOTE,
    THEME_NOTE,
    'The form posts `{ "name", "email", "message" }` to the submissions route of the app form named by `form` (`/api/forms/<form>/submissions`) and shows a toast on success or failure. Declare that form under `forms:` with `name`, `email` and `message` fields — it decides where a message goes (a table through `submitTo`, an automation through a `form` trigger) and who may send one. Until it exists, a submission answers 404 and the error toast shows.',
    'Link the consent line to your privacy policy, or empty `consent` to drop it.',
  ],
  params: [
    stringParam('headline', 'The section heading.', 'Contact'),
    stringParam('subheadline', 'One sentence under the heading.', 'One line on who reads this.'),
    stringParam(
      'form',
      'The name of the app form (under `forms:`) that receives the message.',
      'contact'
    ),
    stringParam('submitLabel', 'The text of the submit button.', 'Send message'),
    stringParam(
      'successMessage',
      'The toast shown once the message is sent.',
      'Message sent. We will reply soon.'
    ),
    stringParam(
      'consent',
      'A small line under the form. Empty to omit.',
      '[Consent line, linked to the privacy policy]'
    ),
  ],
  env: [],
  requires: [],
  build: ({ name, params }) => {
    const p = param(params)
    return asComponent(
      name,
      section([
        stack(
          [
            sectionHead({ title: p('headline'), lead: p('subheadline') }, 'center'),
            endpointForm({
              url: `/api/forms/${encodeURIComponent(p('form'))}/submissions`,
              submitLabel: p('submitLabel'),
              successMessage: p('successMessage'),
              errorMessage: 'The message could not be sent. Try again.',
              className: 'mt-4',
              fields: [
                { field: 'name', control: 'text', label: 'Name' },
                { field: 'email', control: 'email', label: 'Email' },
                { field: 'message', control: 'textarea', label: 'Message' },
              ],
            }),
            ...when(p('consent'), small(p('consent'))),
          ],
          'mx-auto max-w-xl gap-6'
        ),
      ])
    )
  },
})
