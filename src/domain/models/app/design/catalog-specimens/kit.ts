/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Catalogue specimens for the four island types added with the kit additions.
 *
 * They live here rather than beside their categories in `index.ts` for one
 * mechanical reason: that file was within fifty lines of its 400-line cap, and
 * four specimens carrying real props take more than fifty. Splitting by wave is
 * not a principle — `index.ts` still owns form-controls, structural, layout and
 * data, and these are spread back into its arrays at the point they belong.
 *
 * Every specimen is written exactly as an ordinary page would write it.
 * `[internal ref]` compares each against the same type rendered on a
 * real page with one extractor run over both, so a specimen that took a
 * shortcut here would document markup the app does not emit.
 */

import type { CatalogSpecimen } from '.'
import type { Component } from '@/domain/models/app/pages/components'

/** Narrow an authored literal to the component shape the catalogue stores. */
const component = (value: unknown): Component => value as Component

/**
 * The three editor and period controls.
 *
 * Each is drawn with the props that make it a specimen OF something: an editor
 * with no `value` is an empty box and a period picker with no `value` is a
 * button reading its placeholder — both draw, and neither documents the thing
 * the type is for.
 */
export const KIT_FORM_CONTROL_SPECIMENS: readonly CatalogSpecimen[] = [
  {
    type: 'rich-text-editor',
    component: component({
      type: 'rich-text-editor',
      label: 'Notes',
      value: '<p>Rack shelf 1200 for the Lyon site. <strong>Agreed with the supplier.</strong></p>',
      maxLength: 2000,
    }),
  },
  {
    type: 'code-editor',
    component: component({
      type: 'code-editor',
      label: 'Config',
      language: 'yaml',
      value: 'tables:\n  - name: invoices\n    fields: [client, amount]',
    }),
  },
  {
    type: 'date-range-picker',
    component: component({
      type: 'date-range-picker',
      label: 'Period',
      value: '2026-09-01/2026-09-30',
      presets: ['this-month', 'last-month', 'this-quarter'],
    }),
  },
]

/**
 * The filter bar, drawn with a condition already applied.
 *
 * It publishes on a channel NOTHING here subscribes to, and that is right for a
 * catalogue: a specimen documents the control, and wiring it to a live grid
 * would make this card's drawing depend on that grid's fixture rows. The
 * condition is present so the card shows a chip rather than an empty strip,
 * which is the state an author will most often meet it in.
 */
export const KIT_DATA_SPECIMENS: readonly CatalogSpecimen[] = [
  {
    type: 'filter-bar',
    component: component({
      type: 'filter-bar',
      publishes: { bindTo: 'design-system-fixture-filter' },
      conditions: [{ field: 'status', operator: 'eq', value: 'active' }],
      fields: [
        {
          name: 'status',
          label: 'Status',
          kind: 'select',
          options: [
            { value: 'active', label: 'Active' },
            { value: 'pending', label: 'Pending' },
          ],
        },
        { name: 'role', label: 'Role', kind: 'text' },
      ],
    }),
  },
]
