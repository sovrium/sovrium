/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// Report a problem — the console's one way to reach Sovrium's bug form when
// nothing failed on screen. Reached from the palette's Help group, not the
// sidebar: it is a place an operator goes once in a while, not a surface they
// work in.
//
// ─── TWO READS, BOTH FROM THE BROWSER ──────────────────────────────────────
//
// The installation report (version, install channel, database, system) is
// always offered. The last internal error the server kept is offered only when
// there is one; when there is none the page says so calmly and the installation
// report stays, so the palette entry never leads to a dead end. Both addresses
// are the server's, read by the `admin-report-link` island and linked byte for
// byte, exactly as the failure notices do.

import dashboardReport from './dashboard-report.page.json'
import type { Page as PageConfig } from '@/domain/models/app'

export default dashboardReport as PageConfig
