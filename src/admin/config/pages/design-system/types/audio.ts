/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// `audio` — the browser's own transport, across its column.
//
// Drawn as the component itself rather than through the specimen frame: the
// frame hugs a childless element, and a player that spans its column has no
// width of its own to hug, so inside the frame it collapsed to a one-pixel
// line. On the page the player is a direct child and takes the column.

import type { TypePageBody } from './body-shape'

const audio: TypePageBody = {
  drawings: [
    {
      label: 'default',
      children: [
        {
          type: 'audio',
          props: {
            src: '/assets/design-system/sample-chime.mp3',
            controls: true,
            preload: 'metadata',
            'aria-label': 'Sample chime',
          },
        },
      ],
    },
  ],
}

export default audio
