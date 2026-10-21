/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// One link's deep-dive (`/links/:slug`), split out of `links.ts`.

import dashboardDataLinkDetail from './dashboard-data-link-detail.page.json'
import type { Page as PageConfig } from '@/domain/models/app'

export const detail = dashboardDataLinkDetail as PageConfig
