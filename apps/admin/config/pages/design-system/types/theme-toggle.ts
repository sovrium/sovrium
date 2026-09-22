/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// `theme-toggle` — the one control that flips the colour scheme, drawn twice.
//
// The schema publishes no variant union, but the type takes a `variant` key and
// a `label`: the console's own chrome uses the icon form, and a settings page
// wants the labelled one. Both drawings are the real control — which means both
// of them WORK on this page, and clicking either repaints everything.
//
// That is correct rather than a leak. The scheme toggle is the one console
// control a documentation surface may safely draw live, because its whole effect
// is the thing the page is documenting.

import type { TypePageBody } from './_shape'

const themeToggle: TypePageBody = {
  drawings: [
    {
      label: 'icon',
      children: [{ type: 'theme-toggle', variant: 'icon' }],
    },
    {
      label: 'text',
      children: [{ type: 'theme-toggle' }],
    },
  ],
}

export default themeToggle
