/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// `attachment` — one file, as a chip: its name, what it is, and where it stands.
//
// `state` is the option a reader most needs to see, because four of its five
// values are moments an app passes through and a static page never shows:
// waiting, uploading, processing, failed. Only `done` is linked, whatever
// `href` says — a link to a file that is not there yet is a dead end. The
// thumbnail face (`media: 'image'`) is not drawn: it needs a picture, and a
// design page fetches none. Its three sizes are a closed `size` union, so the
// page derives that section itself.

import type { PageComponent, TypePageBody } from './body-shape'

const chip = (extra: Readonly<Record<string, unknown>>): PageComponent =>
  ({
    type: 'attachment',
    name: 'signed-contract-2026.pdf',
    description: 'PDF, 2.4 MB',
    ...extra,
  }) as PageComponent

const STATES = ['done', 'idle', 'uploading', 'processing', 'error'] as const

const attachment: TypePageBody = {
  drawings: [{ label: 'default', children: [chip({})] }],
  options: [
    {
      id: 'state',
      title: 'State',
      configKey: 'attachment.state',
      drawings: STATES.map((state) => ({
        label: `state: '${state}'`,
        children: [chip({ state })],
      })),
    },
    {
      id: 'orientation',
      title: 'Orientation',
      configKey: 'attachment.orientation',
      drawings: [
        { label: "orientation: 'horizontal'", children: [chip({})] },
        { label: "orientation: 'vertical'", children: [chip({ orientation: 'vertical' })] },
      ],
    },
  ],
}

export default attachment
