/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// The console's own 500: a console page Sovrium failed to draw.
//
// The operator stays INSIDE the console, as on its 404: the sidebar is still
// there, the page says the data is unchanged, and the ways on are Reload, the
// report and the Overview. The request id comes from the error document the
// engine renders, read by the `admin-report-link` island; the page config
// carries no id of its own.
//
// Only the console's own app declares this page, so an app's visitors keep the
// plain error page, which names the request id and links nowhere.

import dashboardInternalError from './dashboard-internal-error.page.json'
import type { Page as PageConfig } from '@/domain/models/app'

export default dashboardInternalError as PageConfig
