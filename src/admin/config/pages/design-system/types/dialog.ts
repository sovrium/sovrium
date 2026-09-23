/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// `dialog` — a modal panel over the whole page.
//
// The catalogue refuses to preview it, and the refusal is right: a dialog makes
// the rest of the document inert while it is open, so drawing a live one here
// would freeze the page a reader is reading. Each drawing is its panel, at the
// width the key names, over the ground it would cover. See `overlay-panel.ts`.

import { overPage, panel, panelActions, panelHead } from './overlay-panel'
import type { TypePageBody } from './body-shape'

const dialog: TypePageBody = {
  drawings: [
    {
      label: 'sm',
      children: [
        overPage([
          panel({
            width: 'w-72',
            children: [
              ...panelHead(
                'Discard changes?',
                'The three fields you edited go back to their saved values.'
              ),
              panelActions('Keep editing', 'Discard'),
            ],
          }),
        ]),
      ],
    },
    {
      label: 'lg',
      children: [
        overPage([
          panel({
            width: 'w-[28rem]',
            children: [
              ...panelHead(
                'Delete the invoices table?',
                'This removes 1,284 records and the four automations that write to them. Exports already taken are unaffected. This cannot be undone.'
              ),
              panelActions('Cancel', 'Delete table', true),
            ],
          }),
        ]),
      ],
    },
    {
      label: 'md with form',
      children: [
        overPage([
          panel({
            width: 'w-96',
            children: [
              ...panelHead('Create a share link'),
              {
                type: 'field',
                // `fieldLabel`, not `label`: a field's own keys are
                // `fieldLabel`/`fieldDescription`/`fieldError`/`required`, and
                // the schema refuses the config on anything else.
                fieldLabel: 'Expires after',
                // An option is an OBJECT with a label and a value, never a bare
                // string: the schema refuses the array outright otherwise.
                children: [
                  {
                    type: 'select',
                    options: [
                      { label: '7 days', value: '7d' },
                      { label: '30 days', value: '30d' },
                      { label: 'Never', value: 'never' },
                    ],
                  },
                ],
              },
              panelActions('Cancel', 'Create link'),
            ],
          }),
        ]),
      ],
    },
  ],
}

export default dialog
