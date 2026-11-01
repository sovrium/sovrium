/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/** The least a table must carry to be looked up by its name. */
interface NamedTable {
  readonly name: string
}

/** The least a table must carry to be looked up by its id or its name. */
interface KeyedTable extends NamedTable {
  readonly id?: unknown
}

/**
 * The table declared under `name`, or `undefined` when the config declares no
 * such table (or no tables at all).
 *
 * Name only: a table's numeric `id` never matches here. Use
 * {@link findTableByIdOrName} where a request may address a table by either.
 * Structural on purpose, so a narrowed table shape (a seed config, an
 * authorship view) looks itself up through the same helper. `name` is
 * `unknown` because several callers hold a key read off unvalidated props or
 * a loosely typed field: the comparison is strict equality, so anything but
 * the exact string matches nothing.
 */
export const findTableByName = <T extends NamedTable>(
  tables: ReadonlyArray<T> | undefined,
  name: unknown
): T | undefined => tables?.find((table) => table.name === name)

/**
 * The table a route key addresses: the first table whose id (compared as text)
 * or whose name equals `key`. A table without an id compares as `'undefined'`,
 * exactly as `String(table.id)` does.
 */
export const findTableByIdOrName = <T extends KeyedTable>(
  tables: ReadonlyArray<T> | undefined,
  key: string
): T | undefined => tables?.find((table) => String(table.id) === key || table.name === key)
