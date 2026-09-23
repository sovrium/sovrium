/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// `select` — a choice from a list the author knows.
//
// Three drawings. The third is the decision an author actually makes:
// `searchable` is not a nicety, it is the difference between a list a reader
// scans and one they cannot. The rule worth carrying away — past roughly a dozen
// options, a plain select stops being usable.
//
// The closed and open forms are the same control in the two states a reader meets
// it in; the popup is the component's own and nothing here positions it.

import type { PageComponent, TypePageBody } from './body-shape'

const STAGES = [
  { label: 'Qualification', value: 'qualification' },
  { label: 'Proposal', value: 'proposal' },
  { label: 'Negotiation', value: 'negotiation' },
  { label: 'Closed won', value: 'won' },
]

const sel = (id: string, extra: Readonly<Record<string, unknown>>) =>
  ({
    type: 'field' as const,
    fieldLabel: 'Stage',
    children: [{ type: 'select' as const, options: STAGES, props: { name: id }, ...extra }],
  }) as PageComponent

const select: TypePageBody = {
  drawings: [
    {
      label: 'closed',
      children: [
        {
          type: 'field',
          fieldLabel: 'Stage',
          children: [
            {
              type: 'select',
              options: STAGES,
              emptyOption: { label: 'Not set' },
              defaultValue: 'proposal',
              props: { name: 'stage' },
            },
          ],
        },
      ],
    },
    {
      label: 'open',
      children: [
        {
          type: 'field',
          fieldLabel: 'Stage',
          children: [
            {
              type: 'select',
              options: STAGES,
              defaultValue: 'negotiation',
              props: { name: 'stage-open' },
            },
          ],
        },
      ],
    },
    {
      label: 'searchable',
      children: [
        {
          type: 'field',
          fieldLabel: 'Owner',
          children: [
            {
              type: 'select',
              searchable: true,
              searchPlaceholder: 'Search people',
              options: [
                { label: 'Amélie Roux', value: 'aroux' },
                { label: 'Bastien Leroy', value: 'bleroy' },
                { label: 'Chloé Marchand', value: 'cmarchand' },
                { label: 'Damien Fontaine', value: 'dfontaine' },
              ],
              props: { name: 'owner' },
            },
          ],
        },
      ],
    },
  ],
  options: [
    {
      id: 'options',
      title: 'Options',
      configKey: 'select.options[] | dataSource',
      drawings: [
        {
          label: 'options: [{ label, value }]',
          children: [sel('sel-static', { defaultValue: 'proposal' })],
        },
        {
          label: 'dataSource: { table, labelField, valueField }',
          children: [
            {
              type: 'code',
              props: { language: 'yaml' },
              content: 'dataSource:\n  table: stages\n  labelField: name\n  valueField: slug',
            } as PageComponent,
          ],
        },
      ],
    },
    {
      id: 'empty-option',
      title: 'Empty option',
      configKey: 'select.emptyOption | props.placeholder',
      drawings: [
        {
          label: "emptyOption: { label: 'Not set' }",
          children: [sel('sel-empty', { emptyOption: { label: 'Not set' } })],
        },
        {
          label: "props: { placeholder: 'Choose a stage' }",
          children: [
            sel('sel-placeholder', {
              props: { name: 'sel-placeholder', placeholder: 'Choose a stage' },
            }),
          ],
        },
      ],
    },
    {
      id: 'multiple',
      title: 'Multiple',
      configKey: 'select.multiple',
      drawings: [
        {
          label: 'multiple: false',
          children: [sel('sel-single', { defaultValue: 'proposal' })],
        },
        {
          label: 'multiple: true',
          children: [sel('sel-multi', { multiple: true })],
        },
      ],
    },
    {
      id: 'searchable',
      title: 'Searchable',
      configKey: 'select.searchable | searchPlaceholder | allowCustomValue',
      drawings: [
        {
          label: 'searchable: true',
          children: [sel('sel-search', { searchable: true, searchPlaceholder: 'Search stages' })],
        },
        {
          label: 'searchable: true · allowCustomValue: true',
          children: [
            sel('sel-custom', {
              searchable: true,
              allowCustomValue: true,
              searchPlaceholder: 'Search or type',
            }),
          ],
        },
      ],
    },
    {
      id: 'native',
      title: 'Native',
      configKey: 'select.native',
      drawings: [
        {
          label: 'native: true',
          children: [sel('sel-native', { native: true, emptyOption: { label: 'Not set' } })],
        },
      ],
    },
    {
      id: 'linked',
      title: 'Not for linked records',
      configKey: 'select → record-picker',
      drawings: [
        {
          label: 'a table, not a list',
          children: [
            {
              type: 'link',
              props: {
                href: '/design-system/ui-kit/record-picker',
                className: 'text-primary text-sm',
              },
              content: 'record-picker',
            } as PageComponent,
          ],
        },
      ],
    },
  ],
}

export default select
