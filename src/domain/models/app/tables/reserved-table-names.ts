/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The reserved table namespace — every table name a config may BIND without
 * declaring it in `app.tables[]`.
 *
 * The sibling of `system-fields.ts` one level up: that module answers "is this
 * a real column even though `fields[]` never names it?", this one answers "is
 * this a real table even though `tables[]` never declares it?". Both questions
 * exist for the same reason — the engine creates things the author did not
 * write — and both were previously answered by whichever validator happened to
 * ask, which is how one surface came to accept a name another refused.
 *
 * Each name here is ENGINE-MANAGED: something registers a real route for it, so
 * a binding resolves at runtime and a refusal at validate time would be wrong.
 * The list is short and closed on purpose. It is not a general escape hatch for
 * a name a validator finds inconvenient: a name belongs here only when the
 * platform itself serves it, and the route that serves it is named beside the
 * entry so the two cannot drift apart silently.
 */

/**
 * The engine-managed access junction, created as DDL at startup when
 * `auth.scopeTables` is set — never a row in `app.tables[]`.
 *
 * `POST`/`GET /api/tables/user_access/records` are registered ahead of the
 * `validateTable` middleware for exactly this reason
 * (`presentation/api/tables/routes.ts`), which is what makes a binding to it
 * resolve rather than 404.
 */
export const USER_ACCESS_TABLE = 'user_access'

/**
 * The design-system catalogue's fixture, served as a table so a drawing that
 * needs ROWS has some.
 *
 * Feature-prefixed so an operator's own table cannot shadow it, read-only by
 * omission (only a `GET` is registered), and the same literal as
 * `design/specimen-fixture.ts`'s `SPECIMEN_TABLE_NAME`. Not imported from there
 * because that module carries the whole 30-row fixture, and a validator has no
 * business pulling it in to ask a question about a string.
 */
export const DESIGN_SYSTEM_SPECIMENS_TABLE = 'design_system_specimens'

/** Every table name the platform serves without an `app.tables[]` entry. */
export const RESERVED_TABLE_NAMES: ReadonlySet<string> = new Set<string>([
  USER_ACCESS_TABLE,
  DESIGN_SYSTEM_SPECIMENS_TABLE,
])

/**
 * Whether a bound table name is one the platform serves itself.
 *
 * Asked by every rule that resolves a table name, so that "does this table
 * exist?" has ONE answer rather than one per validator.
 */
export const isReservedTableName = (name: string): boolean => RESERVED_TABLE_NAMES.has(name)
