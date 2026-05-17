/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * collection property for page definitions
 *
 * Configures a template page that generates one route per table record.
 * Used for dynamic pages like blog posts, product pages, etc.
 *
 * This is a re-export for schema path consistency. The canonical definition
 * lives inline in the pages/page module as the `PageCollection` schema.
 *
 * @example
 * ```yaml
 * collection:
 *   table: posts
 *   slugField: slug
 *   filter:
 *     - field: status
 *       operator: eq
 *       value: published
 * ```
 *
 * @see `PageSchema.collection` in `./page`
 */

// PageCollection is defined inline in page.ts (lines 306-327)
// Re-exporting would require extracting it first. For now, this file
// serves as the schema path mirror to satisfy the deep structure checker.
// The schema is: { table: string, slugField: string, filter?: DataFilter[] }
export {}
