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
    'The form posts `{ "name", "email", "message" }` as JSON to `endpoint` and shows a toast on success or failure. It writes to no table, so the block installs into any app.',
    'Link the consent line to your privacy policy, or empty `consent` to drop it.',
  ],
  params: [
    stringParam('headline', 'The section heading.', 'Contact'),
    stringParam('subheadline', 'One sentence under the heading.', 'One line on who reads this.'),
    stringParam('endpoint', 'The URL the form posts the message to.', '/api/contact'),
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
              url: p('endpoint'),
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
