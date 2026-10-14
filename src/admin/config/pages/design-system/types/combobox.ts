/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// `combobox` — shadcn/ui's Combobox: a select whose popup filters as you type.
//
// It is the control `select` hands over to once a list outgrows a scan, so the
// drawing is a list long enough to need the search. The popup is the popover
// surface, opened from the trigger; nothing here positions it.

import type { PageComponent, TypePageBody } from './body-shape'

const PEOPLE = [
  { label: 'Amélie Roux', value: 'aroux' },
  { label: 'Bastien Leroy', value: 'bleroy' },
  { label: 'Chloé Marchand', value: 'cmarchand' },
  { label: 'Damien Fontaine', value: 'dfontaine' },
  { label: 'Élise Garnier', value: 'egarnier' },
  { label: 'Fabien Morel', value: 'fmorel' },
]

const owner = (name: string): PageComponent =>
  ({
    type: 'field',
    fieldLabel: 'Owner',
    children: [
      {
        type: 'combobox',
        searchPlaceholder: 'Search people',
        options: PEOPLE,
        props: { name },
      },
    ],
  }) as PageComponent

const combobox: TypePageBody = {
  drawings: [{ label: 'searchable', children: [owner('owner')] }],
}

export default combobox
