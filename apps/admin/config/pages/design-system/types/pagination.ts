/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// `pagination` — where a reader is in a list, and how to leave.
//
// Both drawings are the real component. `siblingCount` is what separates them:
// the same control, given less room, keeps the ends and the current page and
// drops the rest — which is the decision a narrow column forces.

import type { TypePageBody } from './_shape'

const pagination: TypePageBody = {
  drawings: [
    {
      label: 'default',
      children: [{ type: 'pagination', totalPages: 12, currentPage: 4, siblingCount: 2 }],
    },
    {
      label: 'compact',
      children: [{ type: 'pagination', totalPages: 12, currentPage: 4, siblingCount: 0 }],
    },
  ],
}

export default pagination
