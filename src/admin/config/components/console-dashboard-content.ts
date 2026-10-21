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
import type { AppEncoded as AppConfig } from '@/domain/models/app'

type Template = NonNullable<AppConfig['components']>[number]

// eslint-disable-next-line sovrium/no-double-assertion -- a template that declares inputs writes `$name` where the component type expects a list or an object; each placement is decoded as the page component it produces when the app starts
export const consoleDashboardContent = template as unknown as Template
