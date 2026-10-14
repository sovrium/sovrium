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
// would freeze the page a reader is reading. Each drawing is its panel over the
// tinted ground it would cover. See `overlay-panel.ts`.
//
// A dialog has no size key: base-nova fixes its width at `sm:max-w-sm`, and an
// app that wants it wider says so in `props.className`. So the drawings vary
// what the panel HOLDS — the header and the footer band, a form between them,
// or the header alone with the corner close — not how wide it is.

import { dialogPanel, overPage } from './overlay-panel'
import type { TypePageBody } from './body-shape'

const dialog: TypePageBody = {
  drawings: [
    {
      label: 'default',
      children: [
        overPage(
          'dialog',
          dialogPanel({
            kind: 'dialog',
            title: 'Discard changes?',
            description: 'The three fields you edited go back to their saved values.',
            cancel: 'Keep editing',
            confirm: 'Discard',
          })
        ),
      ],
    },
    {
      label: 'with a form',
      children: [
        overPage(
          'dialog',
          dialogPanel({
            kind: 'dialog',
            title: 'Create a share link',
            description: 'Anyone with the link can read this table.',
            body: [
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
            ],
            cancel: 'Cancel',
            confirm: 'Create link',
          })
        ),
      ],
    },
    {
      label: 'without a footer',
      children: [
        overPage(
          'dialog',
          dialogPanel({
            kind: 'dialog',
            title: 'Keyboard shortcuts',
            description: 'Press ? anywhere to open this list. Escape closes it.',
          })
        ),
      ],
    },
  ],
}

export default dialog
