/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// `aspect-ratio` — a frame that keeps its shape whatever its width.
//
// `ratio` is the whole component, and it has no default: a frame with no shape
// is not one. Each drawing gives the same image a different ratio at the
// same width, so the only thing that changes down the page is the height — which
// is the one thing the type decides. The frame holds one medium (an image, a
// video, an iframe, a map or a QR code) and nothing else; the image here is the
// binary's own mark, so the page fetches nothing from outside the instance.

import type { PageComponent, TypePageBody } from './body-shape'

const tile = (ratio: string | number): PageComponent =>
  ({
    type: 'aspect-ratio',
    ratio,
    props: { className: 'w-64' },
    children: [
      {
        type: 'image',
        props: {
          src: '/assets/brand/sovrium/mark-light-outline.svg',
          alt: '',
          className: 'bg-muted size-full rounded-lg object-contain p-8',
        },
      },
    ],
  }) as PageComponent

const aspectRatio: TypePageBody = {
  drawings: [
    { label: "ratio: '16/9'", children: [tile('16/9')] },
    { label: "ratio: '4/3'", children: [tile('4/3')] },
    { label: 'ratio: 1', children: [tile(1)] },
  ],
}

export default aspectRatio
