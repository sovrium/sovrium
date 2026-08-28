/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `ECO_PAGE_CACHE_MAX_MB` env var — memory budget for the in-memory static
 * page-output cache.
 *
 * The cache is bounded by BYTES, not by entry count: 200 marketing pages and
 * 200 long-form docs articles differ by an order of magnitude in size, so an
 * entry cap either starves a docs zone or blows the memory ceiling of a small
 * deployment. Entries are admitted until the budget is reached, after which
 * insertion-order-oldest entries are evicted until the new entry fits.
 *
 * Operator infrastructure: it lives in the environment only, never in the app
 * schema — same contract as `ECO_PAGE_CACHE`.
 */

import { parseEcoInteger } from './eco-env-parsing'

/** Default budget when `ECO_PAGE_CACHE_MAX_MB` is unset (megabytes). */
export const DEFAULT_ECO_PAGE_CACHE_MAX_MB = 64

/**
 * Resolve `ECO_PAGE_CACHE_MAX_MB` from a snapshot of env vars.
 *
 * - unset / empty       → {@link DEFAULT_ECO_PAGE_CACHE_MAX_MB}
 * - positive integer    → the integer as-is
 * - anything else → throws
 *
 * A malformed budget used to fall back to the 64 MB default. That kept the
 * cache bounded — the original concern — but at the cost of running a budget
 * the operator never chose: `ECO_PAGE_CACHE_MAX_MB=512MB` silently ran 64,
 * one eighth of the intent, on a host provisioned for the larger number.
 * Refusing is the only reading that cannot be quietly wrong, and boot-time
 * validation means the refusal lands before any page is served.
 *
 * @throws Error when set to a non-integer or to an integer `<= 0`.
 */
export const parseEcoPageCacheMaxMb = (
  processEnv: Readonly<Record<string, string | undefined>>
): number =>
  parseEcoInteger('ECO_PAGE_CACHE_MAX_MB', processEnv['ECO_PAGE_CACHE_MAX_MB'], 1) ??
  DEFAULT_ECO_PAGE_CACHE_MAX_MB
