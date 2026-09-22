/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// Re-export all table query functions from modular files
export * from './statement/validation'
export * from './crud/crud'
export * from './batch/batch'
// [internal ref]: many-to-many junction read/write helpers
export { linkManyToMany, readManyToMany } from './mutation-helpers/many-to-many-helpers'
// Relationship display labels — resolve a stored key to the column the field
// declared as its `displayField`, leaving the key itself in place.
export { readRelatedLabels } from './query-helpers/related-label-helpers'
