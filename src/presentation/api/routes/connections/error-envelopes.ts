/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { Context } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'

/**
 * Connection-route error-envelope helpers (M-1 dedupe).
 *
 * The canonical Sovrium error envelope is
 * `{ success: false, message, code }` (see
 * `presentation/api/utils/auth-helpers.ts`), but the connection routes
 * predate the convention and ship a slim `{ error: string }` shape that
 * E2E specs assert against (see `oauth2-flow.spec.ts` line 140 — regex
 * match on `body.error`). Migrating the wire format would force a
 * coordinated spec edit, so the audit (REC-M-1, C-1) decided to keep the
 * shape and just dedupe the construction site.
 *
 * These helpers ARE NOT a step toward the canonical envelope — they
 * lock the legacy shape so it cannot drift from one handler to the next.
 * When the connection routes are next opened for breaking changes, this
 * is the natural seam to migrate from.
 *
 * Wire shape:
 *   `{ error: string, message?: string, detail?: unknown }`
 *
 * `message` is optional and surfaces a human-readable explanation; `detail`
 * passes through structured upstream context (e.g. provider error body)
 * for log/debug purposes.
 */

/**
 * Build the legacy connection-route error envelope and write it as JSON
 * with the given HTTP status. Single source of truth for the 18 inline
 * sites previously in `connections/index.ts` and `users-handler.ts`.
 *
 * Always serialise the keys in the same order so cached HTTP responses
 * can be byte-equal across calls.
 */
export const connectionError = (
  c: Context,
  status: ContentfulStatusCode,
  error: string,
  extras?: { readonly message?: string; readonly detail?: unknown }
) =>
  c.json(
    {
      error,
      ...(extras?.message !== undefined ? { message: extras.message } : {}),
      ...(extras?.detail !== undefined ? { detail: extras.detail } : {}),
    },
    status
  )
