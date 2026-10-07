/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { appRegion, span } from '@/library/manifest/app-block-kit'
import { asComponent, PLACE_NOTE, stack } from '@/library/manifest/block-kit'
import { defineLibraryEntry } from '@/library/manifest/define'

/** The list of fields a form refused, each linking to the field. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'alert-validation-summary',
  title: 'Validation summary',
  category: 'application',
  tags: ['alert', 'form', 'validation', 'errors'],
  description:
    'An error alert that counts the fields needing attention and lists each one as a link to the field, so a reader can fix a long form from the top.',
  notes: [
    PLACE_NOTE,
    'Point each link at the `id` of its field (`#legal-name`) so following it moves focus to the field.',
    'The error tone comes from your theme; it is the one place colour carries consequence.',
  ],
  params: [],
  env: [],
  requires: [],
  build: ({ name }) =>
    asComponent(
      name,
      appRegion([
        {
          type: 'alert',
          alertVariant: 'destructive',
          props: { className: 'w-full max-w-3xl' },
          children: [
            stack(
              [
                span('3 fields need attention', 'text-md font-semibold'),
                {
                  type: 'container',
                  element: 'nav',
                  props: { 'aria-label': 'Fields to fix' },
                  children: [
                    {
                      type: 'text',
                      props: { format: 'markdown', className: 'text-sm' },
                      classes: {
                        parts: {
                          link: 'underline underline-offset-4',
                          list: 'list-disc pl-5',
                        },
                      },
                      content: [
                        '- [Legal name is required](#legal-name)',
                        '- [VAT number must start with a country code](#vat-number)',
                        '- [Payment terms must be between 0 and 90 days](#payment-terms)',
                      ].join('\n'),
                    },
                  ],
                },
              ],
              'gap-2'
            ),
          ],
        },
      ])
    ),
})
