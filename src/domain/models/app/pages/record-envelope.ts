/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Lift a record envelope's nested `fields` bag onto the row's top level, so a
 * field is read the same way whichever binding fetched the row.
 *
 * `/api/tables/:t/records` answers `{ id, fields: { name: … } }` while every
 * admin read endpoint answers flat rows. The DB-table fetch path has always
 * flattened; the system-endpoint path did not, which was invisible while a
 * system source could only point at an admin endpoint and became visible the
 * moment one could point at the records API.
 *
 * The discriminator is PLAIN OBJECT, not merely presence: `/api/admin/tables`
 * answers rows whose `fields` is an ARRAY of field DEFINITIONS, and flattening
 * that would spread array indices across the row. Only the record envelope's
 * object form is lifted, and `fields` itself is dropped — a row that has been
 * flattened must not still advertise the bag it came from.
 *
 * Shared by the client fetch (`parseSystemEnvelope`) and the server-side
 * first-object redirect, so the two cannot disagree about what a row looks
 * like.
 */
export function flattenRecordFields<T extends Readonly<Record<string, unknown>>>(row: T): T {
  const { fields: bag } = row as { readonly fields?: unknown }
  if (typeof bag !== 'object' || bag === null || Array.isArray(bag)) return row
  const { fields: _nested, ...rest } = row as T & { readonly fields?: unknown }
  return { ...rest, ...(bag as Readonly<Record<string, unknown>>) } as T
}
