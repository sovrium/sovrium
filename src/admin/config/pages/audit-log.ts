/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// Audit log — who read or changed what on this instance, when, and through
// which door. Every admin read and change already writes an entry; this page is
// the read-only list over `GET /api/admin/audit-log`, newest first.
//
// The filters are the read's own query parameters (`transport`, `resourceType`),
// sent to the server rather than applied to the page of rows already loaded, so
// a filter narrows the whole trail and not only what happens to be on screen.
// The read is cursor-paginated; the grid asks for its largest page and shows it.

import dashboardAuditLog from './dashboard-audit-log.page.json'
import type { Page as PageConfig } from '@/domain/models/app'

export default dashboardAuditLog as PageConfig
