/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { App } from '@/domain/models/app'

/**
 * The app with every table's activity log off. Seeding is an operator loading
 * data, not a sequence of business events, so no run of the seeder — this
 * command in any mode, with or without `--request` or `--as`, `sovrium import
 * --apply`, or an `app/seed` step — leaves an activity-log entry for a row it
 * writes; a nightly reload would otherwise bury what people actually did.
 */
export const silenced = (app: Readonly<App>): App => ({
  ...app,
  tables: app.tables?.map((table) => ({ ...table, activityLog: false })),
})
