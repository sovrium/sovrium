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
 * `pgSchema('system')`. These are infrastructure concerns (programmatic
 * schema editing, ephemeral previews, bootstrap tokens) — not part of
 * the user-authored `app/` schema.
 *
 * Per "infra → env, app/business → schema" rule, none of these types are
 * referenced from `AppSchema`. They are consumed by the Application
 * layer's schema-management use cases.
 */

export * from './app-version'
export * from './app-draft'
export * from './bootstrap-token'
export * from './preview-session'
