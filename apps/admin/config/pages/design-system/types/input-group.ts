/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// `input-group` — an input with something attached to it.
//
// Three attachments, and they are not interchangeable. A prefix or suffix is a
// STATIC affix: a unit, a currency, a domain — it says how to read the value. An
// `action` is a real control, and the schema makes that explicit by requiring an
// `href` alongside its label: an attachment with nowhere to go is an attachment
// that does nothing. Drawing all three is the point of the page, because an
// author reaching for `suffix` when they meant `action` gets a label where they
// wanted a button.

import type { TypePageBody } from './_shape'

const inputGroup: TypePageBody = {
  drawings: [
    {
      label: 'prefix',
      children: [
        {
          type: 'input-group',
          label: 'Deal value',
          name: 'amount',
          prefix: '€',
          value: '24000',
        },
      ],
    },
    {
      label: 'suffix',
      children: [
        {
          type: 'input-group',
          label: 'Workspace',
          name: 'slug',
          suffix: '.sovrium.app',
          placeholder: 'acme',
        },
      ],
    },
    {
      label: 'with button',
      children: [
        {
          type: 'input-group',
          label: 'Linked record',
          name: 'record',
          placeholder: 'INV-2026-0184',
          // A page in this console, not a plausible-looking one: `/records/…`
          // was never a route here and answered 404. `href` is required by the
          // schema — an action that visibly does nothing is worse than no
          // action — so this specimen cannot be drawn inert, and the only
          // honest alternative is somewhere that exists. `record-picker` is
          // the type a Browse control opens for real.
          action: { label: 'Browse', href: '/design-system/ui-kit/record-picker' },
        },
      ],
    },
  ],
}

export default inputGroup
