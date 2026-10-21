/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// The run page of the Runs surface, split out of `automations.ts` so each file
// holds one page (the list and its tabs there, one run's record here).

import dashboardDataAutomationRun from './dashboard-data-automation-run.page.json'
import type { Page as PageConfig } from '@/domain/models/app'

export const runPage = dashboardDataAutomationRun as PageConfig
