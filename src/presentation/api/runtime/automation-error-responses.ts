/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Shared HTTP rendering for the run-control error unions (replay, retry,
 * approval resolution).
 *
 * WHY THIS MODULE EXISTS
 * ----------------------
 * Each of those four handlers translates its use-case's error union with a
 * hand-written `if (_tag === …)` ladder ending in a catch-all. That shape is
 * fine for the union's own members — but it can turn a database outage into a
 * 404: if the use-cases `mapError(() => AutomationRunNotFound)` over their
 * repository calls, "the store did not answer" and "there is no such run"
 * arrive at the ladder as the same tag and leave as the same response. The
 * caller is told a run they can plainly see does not exist, and the operator
 * gets a non-alerting 404 with the database on fire — the failure mode
 * `NotFoundError` exists to end (`domain/errors/index.ts`).
 *
 * The repository errors propagate instead, which means every ladder has a
 * member it must NOT treat as a verdict about existence. This module is the
 * PREDICATE for that branch, in one place, so the four ladders cannot drift on
 * which tags belong to it.
 *
 * The RENDERING half does not live here: it is `toErrorResponse`
 * (`@/presentation/api/utils/run-effect`), the same builder every other route
 * reaches for — a ladder ends `return toErrorResponse(c, error)`. A private
 * copy of the sanitized envelope beside the predicate is exactly how an API
 * grows several error dialects.
 */

/**
 * The repository failures the run-control use-cases now let through. Tagged
 * errors from the automation run / approval ports — a driver fault, a missing
 * table, a connection that never opened. None of them says anything about
 * whether the run exists.
 */
const DATABASE_ERROR_TAGS: ReadonlySet<string> = new Set([
  'AutomationRunDatabaseError',
  'AutomationApprovalDatabaseError',
])

/** Whether `error` is a store failure rather than a verdict about a resource. */
export const isAutomationStoreFailure = (error: { readonly _tag: string }): boolean =>
  DATABASE_ERROR_TAGS.has(error._tag)
