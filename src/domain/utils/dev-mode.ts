/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Predicates over `NODE_ENV` values. Pure: takes the env value as a parameter
 * so the predicate itself is testable without env mutation, and so consumers
 * in any layer (presentation, infrastructure, application) can share the
 * same semantic without re-implementing the unset-vs-empty-vs-set distinction.
 *
 * The original site of this predicate was `infrastructure/utils/env.ts`'s
 * `isLiveReloadEligible`, which was duplicated inline in
 * `presentation/ui/pages/PageBodyScripts.tsx::DevLiveReloadScript` "to preserve
 * the presentation→infrastructure layer boundary". The pure predicate belongs
 * in the domain layer so both call sites consume the same canonical shape
 * without a layer hop.
 */

/**
 * True when `NODE_ENV` is unset (`undefined`) or empty (`''`) — the genuine
 * local-dev default a developer hits when running the CLI without any
 * environment override.
 *
 * This distinguishes the local-dev default from `NODE_ENV=development`, which
 * the E2E in-process test server uses purely to skip the production CSS check
 * without requesting a live-reload session.
 * Anything that is a "local-dev convenience" (live-reload, hot-restart hints,
 * verbose console output) should gate on this predicate; anything that
 * legitimately wants development behaviour in tests too should gate on
 * `NODE_ENV !== 'production'` instead.
 */
export const isLocalDevDefault = (nodeEnv: string | undefined): boolean =>
  nodeEnv === undefined || nodeEnv === ''
