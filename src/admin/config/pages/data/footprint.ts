/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// Footprint — what serving this instance consumed.
//
// A page of its own under Instance, after Decisions: it describes the instance,
// not its audience, so it is answered whether or not the app declares
// `analytics`. Three sections, each over `/api/admin/footprint/overview`:
// measured tiles, the largest stored resources, and the eco settings in force.
// Each setting reads in words with its environment variable as the caption
// under it, so the operator learns what it does and keeps the name to change it.

import dashboardDataFootprint from './dashboard-data-footprint.page.json'
import type { Page as PageConfig } from '@/domain/models/app'

export default dashboardDataFootprint as PageConfig
