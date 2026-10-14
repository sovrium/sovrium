/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// `native-select` — shadcn/ui's Native Select: the browser's own `<select>`,
// styled as an input, with the chevron drawn beside it.
//
// Same options as `select`, none of its popup. The list opens in the device's
// own picker, which is the reason to reach for it: on a phone that picker is
// the one the reader already knows, and the page ships no script for it.

import type { PageComponent, TypePageBody } from './body-shape'

const STAGES = [
  { label: 'Qualification', value: 'qualification' },
  { label: 'Proposal', value: 'proposal' },
  { label: 'Negotiation', value: 'negotiation' },
  { label: 'Closed won', value: 'won' },
]

const stage = (name: string, extra: Readonly<Record<string, unknown>> = {}): PageComponent =>
  ({
    type: 'field',
    fieldLabel: 'Stage',
    children: [{ type: 'native-select', options: STAGES, props: { name }, ...extra }],
  }) as PageComponent

const nativeSelect: TypePageBody = {
  drawings: [{ label: 'default', children: [stage('stage', { defaultValue: 'proposal' })] }],
  options: [
    {
      id: 'empty-option',
      title: 'Empty option',
      configKey: 'native-select.emptyOption',
      drawings: [
        {
          label: "emptyOption: { label: 'Not set' }",
          children: [stage('stage-empty', { emptyOption: { label: 'Not set' } })],
        },
      ],
    },
  ],
}

export default nativeSelect
