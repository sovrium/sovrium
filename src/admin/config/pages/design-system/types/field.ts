/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// `field` — the row every other control sits in.
//
// This type draws nothing of its own: it supplies the label, the description and
// the error message, and wraps whatever control it is given. So the three
// drawings are three CONTROLS in the same wrapper, and what is being compared is
// the wrapper's parts rather than the controls.
//
// The rule the page states: the description answers a question a reader has
// BEFORE they answer, the error answers one they have after. Anything that only
// makes sense after a failed attempt belongs in the error, never in the help.

import type { TypePageBody } from './body-shape'

const field: TypePageBody = {
  drawings: [
    {
      label: 'input',
      children: [
        {
          type: 'field',
          fieldLabel: 'Workspace URL',
          fieldDescription:
            'Lowercase letters and hyphens. This becomes part of every link you share.',
          required: true,
          children: [{ type: 'input', props: { name: 'slug', placeholder: 'acme-europe' } }],
        },
      ],
    },
    {
      label: 'select',
      children: [
        {
          type: 'field',
          fieldLabel: 'Stage',
          children: [
            {
              type: 'select',
              emptyOption: { label: 'Not set' },
              options: [
                { label: 'Qualification', value: 'qualification' },
                { label: 'Proposal', value: 'proposal' },
              ],
              props: { name: 'field-stage' },
            },
          ],
        },
      ],
    },
    {
      label: 'textarea',
      children: [
        {
          type: 'field',
          fieldLabel: 'Summary',
          fieldError:
            'Add a summary of at least 20 characters — this is what the weekly digest sends.',
          children: [{ type: 'textarea', rows: 3, props: { name: 'field-summary' } }],
        },
      ],
    },
  ],
}

export default field
