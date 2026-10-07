/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { isRunsEndpoint, localizeRun } from '@/domain/models/app/pages/automation-run-status'
import type { TableRecord } from './types'

/**
 * Two reads of a system endpoint's response that need nothing from the
 * fetch around them: run-status localisation of a runs feed's rows, and a
 * bounded failure body for the error alert.
 */

// ---------------------------------------------------------------------------
// Run-status localization (gated on the runs endpoint — inert everywhere else)
// ---------------------------------------------------------------------------

/**
 * The rows gate: a runs endpoint AND a NAMED source.
 *
 * The map itself — labels, endpoint test, the descent into `steps` — lives in
 * `@/domain/models/app/pages/automation-run-status`, shared with the renderer's
 * server-side read of a page-level `{ system }` record, so the grid, the drawer
 * and the run page speak one vocabulary from one table. The id narrows this gate
 * because an anonymous grid may be an author's own view of the same feed; a
 * detail binding carries no id, so the detail path (`localizeRunRecord`) is
 * gated on the endpoint alone.
 */
export function localizeRunStatusRows(
  endpoint: string,
  sourceId: string | undefined,
  rows: readonly TableRecord[]
): readonly TableRecord[] {
  if (!sourceId || !isRunsEndpoint(endpoint)) return rows
  return rows.map((row) => localizeRun(row))
}

/** How much of a failed response body reaches the operator's error alert. */
const ERROR_BODY_MAX_CHARS = 300

/**
 * Read a failed response's body for display, BOUNDED.
 *
 * The thrown message is rendered verbatim in the grid's error alert, so an
 * unbounded `res.text()` puts the whole response there. That is fine for the
 * JSON error envelopes these endpoints normally return, and wrong for the case
 * that actually occurs when something upstream breaks: a 500 or a proxy fault
 * answers with an HTML error PAGE, and the operator gets kilobytes of markup
 * instead of a diagnosis. The status code — already interpolated ahead of this
 * — is the actionable half; the body is context.
 *
 * A body that cannot be read at all must not mask the real failure with a
 * secondary one, so the read is guarded and degrades to an empty string.
 */
export async function readErrorBody(res: Response): Promise<string> {
  const body = await res.text().catch(() => '')
  const collapsed = body.replaceAll(/\s+/gu, ' ').trim()
  return collapsed.length > ERROR_BODY_MAX_CHARS
    ? `${collapsed.slice(0, ERROR_BODY_MAX_CHARS)}…`
    : collapsed
}
