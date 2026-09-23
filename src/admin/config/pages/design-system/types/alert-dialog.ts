/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// `alert-dialog` — a dialog that will not be dismissed by accident.
//
// The catalogue refuses it for a sharper reason than a plain dialog: this one
// holds focus until it is answered, so a live one on a documentation page would
// trap a reader inside an example. Drawn as its panel. See `overlay-panel.ts`.
//
// The two labels are its only own keys, and the drawing spends both: the
// confirm names the consequence rather than agreeing, which is the whole reason
// this type exists beside `dialog`.

import { overPage, panel, panelActions, panelHead } from './overlay-panel'
import type { TypePageBody } from './body-shape'

const alertDialog: TypePageBody = {
  drawings: [
    {
      label: 'open',
      children: [
        overPage([
          panel({
            width: 'w-[26rem]',
            children: [
              ...panelHead(
                'Revoke this share link?',
                'Anyone holding it loses access immediately. The link cannot be restored, and a new one will have a different address.'
              ),
              panelActions('Keep the link', 'Revoke link', true),
            ],
          }),
        ]),
      ],
    },
  ],
}

export default alertDialog
