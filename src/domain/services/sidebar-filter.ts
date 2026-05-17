/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Scoped-sidebar filter (US-PAGES-ACCESS-SCOPED-SIDEBAR, P-5).
 *
 * Pure functions composed by the SSR sidebar renderer to:
 *   1. Substitute `$record.<field>` placeholders in label/href templates,
 *   2. Drop entries flagged with the configured `archivedField`,
 *   3. Mark the entry whose record id matches the resolved active
 *      assignment with `data-active="true"`.
 *
 * The active-assignment resolution itself lives in
 * `domain/services/active-assignment-cookie.ts` (the cookie name +
 * validation contract); this module composes its outputs.
 *
 * Database access (fetching records / user_access) is intentionally NOT
 * here — those reads happen in the presentation/infrastructure layers
 * via injected callbacks. The functions below stay pure so they can be
 * unit-tested without a database.
 */

/**
 * Replace `$record.<fieldName>` placeholders in `template` with values
 * from `record`. Missing field values resolve to the empty string.
 */
export const substituteRecordVars = (
  template: string,
  record: Readonly<Record<string, unknown>>
): string =>
  template.replace(/\$record\.([a-zA-Z0-9_]+)/g, (_, fieldName: string) => {
    const value = record[fieldName]
    return value === undefined || value === null ? '' : String(value)
  })

/**
 * Single resolved sidebar entry — what the renderer turns into an `<a>`.
 */
export interface ResolvedSidebarEntry {
  readonly recordId: string
  readonly label: string
  readonly href: string
  readonly active: boolean
}

/**
 * Configuration sliced from `SidebarItem` for the pure resolver — keeps
 * the function signature decoupled from the schema's optional fields.
 */
export interface SidebarTemplateConfig {
  readonly label: string
  readonly href: string
  readonly archivedField?: string
}

/**
 * Determines whether a record is archived per the configured field.
 * A missing config or missing field always returns `false`.
 *
 * Treats any truthy value as archived (booleans, non-empty strings, 1).
 * `false` / `null` / `undefined` / `0` / empty string keep the entry
 * visible.
 */
export const isArchivedRecord = (
  record: Readonly<Record<string, unknown>>,
  archivedField: string | undefined
): boolean => {
  if (!archivedField) return false
  const value = record[archivedField]
  if (value === undefined || value === null) return false
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  if (typeof value === 'string') {
    // Postgres booleans deserialize as 't'/'f' from raw queries occasionally.
    return (
      value !== '' &&
      value !== '0' &&
      value.toLowerCase() !== 'f' &&
      value.toLowerCase() !== 'false'
    )
  }
  return Boolean(value)
}

/**
 * Resolve a list of records into displayable sidebar entries.
 *
 * The resolver:
 *   - drops archived records (per `template.archivedField`),
 *   - substitutes `$record.<field>` placeholders in the label/href,
 *   - marks the entry whose `id` matches `activeRecordId`.
 *
 * `idField` defaults to `'id'`; tables with a different primary-key field
 * may pass a different name.
 */
export const resolveSidebarEntries = (
  records: readonly Readonly<Record<string, unknown>>[],
  template: SidebarTemplateConfig,
  options: { readonly activeRecordId?: string; readonly idField?: string } = {}
): readonly ResolvedSidebarEntry[] => {
  const { activeRecordId, idField = 'id' } = options
  return records
    .filter((record) => !isArchivedRecord(record, template.archivedField))
    .map((record) => {
      const rawId = record[idField]
      const recordId = rawId === undefined || rawId === null ? '' : String(rawId)
      return {
        recordId,
        label: substituteRecordVars(template.label, record),
        href: substituteRecordVars(template.href, record),
        active:
          activeRecordId !== undefined && activeRecordId !== '' && recordId === activeRecordId,
      }
    })
}
