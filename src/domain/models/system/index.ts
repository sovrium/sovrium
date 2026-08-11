/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * System Domain Models
 *
 * Effect Schema models for Sovrium-internal runtime state that lives in
 * `pgSchema('system')`. These are infrastructure concerns (the one-time
 * first-admin bootstrap token) — not part of the user-authored `app/` schema.
 *
 * Per "infra → env, app/business → schema" rule, none of these types are
 * referenced from `AppSchema`.
 */

export * from './bootstrap-token'
