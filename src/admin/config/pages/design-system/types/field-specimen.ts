/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// `field-specimen` — the control a field type gets, drawn without a table.
//
// A record's field is rendered by whichever control its TYPE calls for: a
// single-line text field gets an input, a single-select gets a select, a
// checkbox field gets a checkbox. This type draws that control from the field
// type alone — no table, no record, no binding — which is what lets a
// documentation page show forty-odd field types without forty-odd tables.
//
// ─── WHY THE CATALOGUE REFUSES IT AND THIS PAGE DOES NOT ───────────────────
//
// The catalogue draws one card per type, and one card here would have to name
// one arbitrary `fieldType` — so the card would document THAT field type rather
// than this component. That reasoning is about a single card. A page can draw
// several, and several is what makes the point: the component is the same in
// every drawing below and the control is different in each, which is the whole
// behaviour.

import type { TypePageBody } from './body-shape'

const fieldSpecimen: TypePageBody = {
  drawings: [
    {
      label: 'single-line-text',
      children: [
        {
          type: 'field-specimen',
          fieldType: 'single-line-text',
          name: 'company',
          label: 'Company',
          placeholder: 'Acme',
        },
      ],
    },
    {
      label: 'long-text',
      children: [
        {
          type: 'field-specimen',
          fieldType: 'long-text',
          name: 'notes',
          label: 'Internal note',
          description: 'What happened on this call?',
        },
      ],
    },
    {
      label: 'single-select',
      children: [
        {
          type: 'field-specimen',
          fieldType: 'single-select',
          name: 'stage',
          label: 'Stage',
          options: ['Qualification', 'Proposal', 'Negotiation'],
          value: 'Proposal',
        },
      ],
    },
    {
      label: 'compact',
      children: [
        {
          type: 'field-specimen',
          fieldType: 'single-line-text',
          name: 'company-compact',
          label: 'Company',
          value: 'Acme',
          compact: true,
        },
      ],
    },
  ],
}

export default fieldSpecimen
