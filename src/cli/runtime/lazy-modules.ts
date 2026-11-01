/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Lazy-import heavy modules to avoid loading native dependencies (lightningcss,
 * @tailwindcss/oxide) for commands that don't need them (--version, schema, init).
 * This is critical for compiled binary mode where native .node modules cannot be
 * resolved from Bun's virtual filesystem.
 */
export const lazyImportIndex = () => import('@/index')
export const lazyImportLogger = () => import('@/infrastructure/logging/logger')
export const lazyImportStartupSummary = () => import('@/infrastructure/logging/startup-summary')
export const lazyImportSchema = () => import('@/infrastructure/config')
export const lazyImportCli = () => import('@/cli/runtime/schema-loader')
