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
// Unlike a dialog it draws no corner close: the only ways out are the two
// buttons in its footer band. The labels are its own keys, and the drawings
// spend both — the confirm names the consequence rather than agreeing, which is
// the whole reason this type exists beside `dialog`. `variant: destructive`
// shows on the confirm button alone.

import { dialogPanel, overPage } from './overlay-panel'
import type { TypePageBody } from './body-shape'

const alertDialog: TypePageBody = {
  drawings: [
    {
      label: 'default',
      children: [
        overPage(
          'alert-dialog',
          dialogPanel({
            kind: 'alert-dialog',
            title: 'Make the new prices live?',
            description:
              'Customers see them on their next visit. The old prices stay in the history.',
            cancel: 'Not yet',
            confirm: 'Go live',
          })
        ),
      ],
    },
    {
      label: 'destructive',
      children: [
        overPage(
          'alert-dialog',
          dialogPanel({
            kind: 'alert-dialog',
            title: 'Revoke this share link?',
            description:
              'Anyone holding it loses access immediately. The link cannot be restored, and a new one will have a different address.',
            cancel: 'Keep the link',
            confirm: 'Revoke link',
            destructive: true,
          })
        ),
      ],
    },
  ],
}

export default alertDialog
