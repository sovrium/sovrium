/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The request a grid's failed read was answered under, read back off the
 * thrown error so a console can offer a report of it. The error carries it on
 * its `cause`, set by the shared `failedReadCause` (`hooks/use-system-source-fetch`).
 *
 * Kept in the grid's own directory rather than beside the shared 429 rule in
 * `runtime/read-failure.tsx`: every island reading data loads that module, and
 * only the grid offers a report.
 */

import { isConsoleDocument } from '../runtime/console-request-id'

/**
 * The request id a failed read's server error named, on the operator console
 * only (`isConsoleDocument`): a report of the engine's own failure is the
 * operator's, never an app visitor's.
 */
export const consoleRequestIdOfRead = (error: unknown): string | undefined =>
  isConsoleDocument() && error instanceof Error
    ? (error.cause as { readonly requestId?: string } | undefined)?.requestId
    : undefined
