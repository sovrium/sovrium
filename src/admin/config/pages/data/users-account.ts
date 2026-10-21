/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// Users — one account, at `/users/:email`.
//
// Its own module rather than the back half of `users.ts`: the directory and
// this page answer different questions — every account, and everything the
// console may do to ONE — and share nothing but the row writes, which both
// build from `users-row-actions.ts`. `users.ts` imports the page and lists it
// last, where the route order needs it.

import dashboardDataUserAccount from './dashboard-data-user-account.page.json'
import type { Page as PageConfig } from '@/domain/models/app'

export const accountPage = dashboardDataUserAccount as PageConfig
