/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Replace `$record.<fieldName>` placeholders in a template string with values
 * from a record. Missing fields (`undefined`) and explicit `null` both resolve
 * to the empty string; any other value is coerced via `String(value)`.
 *
 * Shared by:
 *   - Sidebar entry templates (`domain/services/sidebar-filter.ts`),
 *   - Row-click `path` interpolation in the data-table island
 *     (`presentation/islands/data-table/body.tsx`),
 *   - `onSuccess.successPage.redirect` substitution in the crud-form island
 *     (`presentation/islands/crud-form-island/submit-pipeline.ts`).
 *
 * The `null` → `''` coercion mirrors the existing sidebar / kanban helpers
 * (it differs from the older `data-source-resolver.substituteRecordVars`
 * variant, which renders `null` as the literal string `'null'`). Migrating
 * the older variant is tracked as a follow-up; passing only stringy / numeric
 * fields through this helper for now keeps the two camps from drifting.
 */
export const substituteRecordVars = (
  template: string,
  record: Readonly<Record<string, unknown>>
): string =>
  template.replace(/\$record\.([a-zA-Z0-9_]+)/g, (_, fieldName: string) => {
    const value = record[fieldName]
    return value === undefined || value === null ? '' : String(value)
  })
