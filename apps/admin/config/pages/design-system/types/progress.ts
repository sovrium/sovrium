/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// `progress` — how far a known task has run, and the one case where it is not
// known.
//
// The three SHAPES are `progressVariant`'s own members — `bar circle steps` —
// so the page derives them and this file no longer lists them. It used to, and
// it listed four: `bar`, `labelled`, `indeterminate`, `steps`. Two of those are
// not members of any union, so a reader copying the heading wrote config the
// decoder refuses, and `circle` — which IS a member — was never drawn at all.
//
// What the two extra headings were really demonstrating is two OPTIONS, and
// options have a home on this page: whether the figure is shown is `showLabel`,
// and whether the task's extent is known is whether `progressValue` is set.
// Each is drawn at both its values under the key an author writes.

import type { TypePageBody } from './_shape'

const bar = (extra: Readonly<Record<string, unknown>>) => ({
  type: 'progress' as const,
  progressMax: 100,
  props: { className: 'w-full' },
  ...extra,
})

const progress: TypePageBody = {
  options: [
    {
      id: 'label',
      title: 'Label',
      configKey: 'showLabel',
      drawings: [
        { label: 'showLabel: false', children: [bar({ progressValue: 62 })] },
        { label: 'showLabel: true', children: [bar({ progressValue: 62, showLabel: true })] },
      ],
    },
    {
      id: 'determinacy',
      title: 'Determinacy',
      configKey: 'progressValue',
      drawings: [
        { label: 'progressValue: 62', children: [bar({ progressValue: 62 })] },
        // No value at all: the component has no extent to draw, so it animates
        // rather than filling. This is the one case the axis cannot express —
        // an indeterminate bar is still `progressVariant: 'bar'`.
        { label: 'progressValue: (unset)', children: [bar({})] },
      ],
    },
  ],
}

export default progress
