/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// Signatures — every signing request the app has sent, who signs it, where it
// stands, and its evidence log.
//
// TWO pages out of one module: the list and one request. Both are READ-ONLY
//: a request is sent and withdrawn by the app's own automations
// (`signature/send`, `signature/cancel`), never from the console, and no
// action on either page edits, cancels or erases anything. The erasure door
// stays an API an operator calls on purpose.
//
// The list reads `GET /api/admin/signatures`; the detail reads the routes the
// engine already serves for a request: its status, its evidence log, and its
// export, which the page offers as a download. None of them carries a link
// token, a code digest, a salt or a signer's address: the evidence tables are
// never browsable here (`internal-tables.ts`), and these shapes are the only
// way in.

import dashboardDataSignatureRequest from './dashboard-data-signature-request.page.json'
import dashboardDataSignatures from './dashboard-data-signatures.page.json'
import type { Page as PageConfig } from '@/domain/models/app'

export default [
  dashboardDataSignatures as PageConfig,
  dashboardDataSignatureRequest as PageConfig,
] satisfies readonly PageConfig[]
