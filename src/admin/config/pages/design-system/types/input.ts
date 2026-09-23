/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// `input` — the one-line control everything else is measured against.
//
// Four drawings, and the fourth is the one worth the page: `inputType` carries
// `one-time-code`, which is not a cosmetic variant — it changes what the browser
// offers to autofill, and getting it wrong is why a reader retypes a code they
// were just sent.
//
// Two authoring facts the schema makes and the page shows. The control's own
// keys are `inputType` and nothing else; its name, placeholder and value ride in
// `props`. And the label belongs to the `field` around it, which is why three of
// these four drawings are a field with an input inside.
//
// There is no `size` key on this type. What the reference calls its size ladder
// is the recipe's, so this page draws no Sizes section.

import type { TypePageBody } from './body-shape'

const input: TypePageBody = {
  drawings: [
    {
      label: 'default',
      children: [
        {
          type: 'field',
          fieldLabel: 'Company',
          children: [{ type: 'input', props: { name: 'company', placeholder: 'Acme' } }],
        },
      ],
    },
    {
      label: 'with help',
      children: [
        {
          type: 'field',
          fieldLabel: 'Workspace URL',
          fieldDescription:
            'Lowercase letters and hyphens. This becomes part of every link you share.',
          children: [{ type: 'input', props: { name: 'slug', placeholder: 'acme-europe' } }],
        },
      ],
    },
    {
      label: 'with leading icon',
      children: [
        {
          type: 'field',
          fieldLabel: 'Search contacts',
          children: [{ type: 'input-group', name: 'q', placeholder: 'Name or email', prefix: '⌕' }],
        },
      ],
    },
    {
      label: 'one-time-code',
      children: [
        {
          type: 'field',
          fieldLabel: 'Verification code',
          children: [
            {
              type: 'input',
              inputType: 'one-time-code',
              props: { name: 'code', placeholder: '123456' },
            },
          ],
        },
      ],
    },
  ],
}

export default input
