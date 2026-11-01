/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// sovrium-library: block/dashboard-01@0.37.0#2ccf14395ad7
// sovrium-library: block/dashboard-01@0.37.0#296fe4c850d3

// The Overview body: the section cards, the attention list and the rest of the landing page.

// ── From dashboardContentCopy ──────────────────────────────────────────────────
/** dashboard-01's content column: an `@container/main` column, 24px between sections on md+. */

import template from './console-dashboard-content.template.json'
import type { TemplateEncoded } from '@/domain/models/app/components'

export const consoleDashboardContent = template as TemplateEncoded
