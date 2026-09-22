/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

export * from './app'

// Re-export all domain model schemas and types for convenient imports
export * from './actions'
export * from './agents'
export * from './analytics'
export * from './automations'
export * from './buckets'
export * from './components'
export * from './connections'
export * from './decisions'
export * from './description'
export * from './design'
export * from './env'
export * from './languages'
export * from './llms'
export * from './name'
export * from './auth'
export * from './pages'
export * from './palette'
export * from './links'
export * from './redirects'
export * from './requires-email'
// `./requires-ai` (`appRequiresAi`) and `./requires-storage` (`appUsesStorage`)
// are deliberately NOT re-exported here. They are derived PREDICATES over a
// decoded `App` — questions asked about the config — not schema properties of
// it, and this barrel is the domain's schema surface: `check-progress.ts`'s
// name-mirroring rule reads it to decide which files must correspond to an
// `AppSchema` key, so a barrel entry named `requires-ai` asserts an
// `app.requiresAi` property that does not and must not exist. Their three
// call sites already import the deep path
// (`@/domain/models/app/requires-ai`, `.../requires-storage`), the same
// convention `pages/has-page-search` and `pages/component-tree-has-type`
// follow — so keep them out of the barrel and import them directly.
export * from './auth/permissions'
export * from './system-sources'
export * from './tables'
export * from './version'
