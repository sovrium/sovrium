/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The vocabulary every stage of data-source resolution shares: the two outcome
 * symbols, the result union, the injected database port, the error stamp, the
 * field validator, and the `{ systemSource }` desugaring that normalises a
 * named catalog reference into the inline form every downstream branch reads.
 *
 * A contracts module rather than a `types.ts`: `withDataSourceError`,
 * `validateDataSourceFields` and `desugarSystemSourceRef` are behaviour, but
 * behaviour that belongs to the SHAPE rather than to any one stage — each is
 * called from two or more of the four stages next door, and none of them
 * depends on any of the others.
 */

import { substituteRecordVars } from '@/domain/models/app/pages/substitute-record-vars'
import { resolveSystemSource } from '@/domain/models/app/system-sources'
import type { App } from '@/domain/models/app'
import type {
  ComponentReference,
  SimpleComponentReference,
} from '@/domain/models/app/components/reference'
import type { Component } from '@/domain/models/app/pages/components'
import type { DataFilter, DataSort } from '@/domain/models/app/pages/components/data-source'

export const SINGLE_RECORD_NOT_FOUND = Symbol('SINGLE_RECORD_NOT_FOUND')
export const UNAUTHORIZED = Symbol('UNAUTHORIZED')

export type DataSourceSectionResult =
  | Component
  | SimpleComponentReference
  | ComponentReference
  | typeof SINGLE_RECORD_NOT_FOUND
  | typeof UNAUTHORIZED

/**
 * Database access interface for data source resolution.
 *
 * Injected by the caller to keep the presentation layer free of
 * direct infrastructure/database dependencies. The live implementation
 * is provided by DataSourceRepositoryLive in the infrastructure layer.
 */
export interface DataSourceDb {
  readonly fetchRecords: (
    tableName: string,
    options?: {
      readonly fields?: readonly string[]
      readonly filter?: readonly DataFilter[]
      readonly sort?: readonly DataSort[]
      readonly pageSize?: number
      readonly page?: number
    }
  ) => Promise<readonly Record<string, unknown>[]>

  readonly countRecords: (tableName: string, filter?: readonly DataFilter[]) => Promise<number>

  readonly fetchSingleRecord: (
    tableName: string,
    paramField: string,
    paramValue: string,
    fields?: readonly string[]
  ) => Promise<Record<string, unknown> | undefined>

  /**
   * Reads the user's accessible record-ids from `user_access` for one scope
   * table. Mandatory: `$currentUser.assignments.<table>` and
   * `$currentUser.activeAssignment` both resolve into data filters, and this
   * reader is what validates them against real access. When it was optional,
   * every consumer had to carry a "cannot validate" branch that trusted the
   * caller-supplied cookie verbatim — a tampered cookie could then scope a
   * user to data they cannot reach. Adapters with nothing to read supply a
   * reader returning `[]`, which fails closed.
   */
  readonly fetchUserAssignments: (userId: string, tableSlug: string) => Promise<readonly string[]>

  /**
   * Optional — fetch every distinct `role` value the user holds across all
   * `system.user_access` rows (any scope-table). Used by `renderPageByPath`
   * to overlay these onto the Better Auth `session.role` into
   * `session.effectiveRoles` so a user whose Better Auth role is `member`
   * but who holds `role: 'engineer'` in `user_access` passes a page guard
   * of `access: ['engineer']`. Mirrors the table-level Z-3 overlay.
   *
   * Bug 2.
   */
  readonly fetchUserAccessRoles?: (userId: string) => Promise<readonly string[]>
}

/** Injects a _dataSourceError prop into a component's props. */
export function withDataSourceError(component: Component, errorMessage: string): Component {
  return {
    ...component,
    props: {
      ...(component.props ?? {}),
      _dataSourceError: errorMessage,
    },
  }
}

/** Validates dataSource fields against a table's field definitions. */
export function validateDataSourceFields(
  component: Component,
  tableName: string,
  requestedFields: readonly string[],
  tableFieldNames: Set<string>
): Component | undefined {
  const missingFields = requestedFields.filter((f) => !tableFieldNames.has(f))
  if (missingFields.length === 0) return undefined
  return withDataSourceError(
    component,
    `Error: fields not found in table "${tableName}": ${missingFields.join(', ')}`
  )
}

/**
 * Replaces `$record.fieldName` placeholders with actual field values from a
 * record — re-exported from the ONE implementation in
 * `@/domain/utils/substitute-record-vars`.
 *
 * This module used to carry its own copy, and the copy disagreed with the
 * shared helper on exactly one input: it tested `value !== undefined` only, so
 * an explicit `null` painted the literal text `null` into whatever it was
 * substituted into. That divergence is closed — see the shared module's header
 * for the coercion contract and the `|` fallback chain, both of which every
 * caller of this name now gets.
 */
export { substituteRecordVars }

/**
 * Desugar the `{ systemSource: <name> }` named-catalog shorthand (CAP-4) into the
 * inline `{ system: <entry> }` form by resolving the name against
 * `app.systemSources`. The resolved catalog entry (minus its `name`) is a drop-in
 * for the inline system binding, so AFTER desugaring the component is identical to
 * one authored with `dataSource: { system: { endpoint, ... } }` — every downstream
 * branch (island short-circuits + the data-table island fetch hooks) sees only
 * `dataSource.system` and needs no `{ systemSource }` awareness, and the catalog
 * never reaches the client bundle. A reference that does not resolve (catalog-less
 * app) is left unchanged: decode-time `validateAllSystemSourceReferences` already
 * rejects an undeclared reference before boot.
 */
export function desugarSystemSourceRef(component: Component, app: App): Component {
  const dataSource = component.dataSource as { readonly systemSource?: unknown } | undefined
  const ref = dataSource?.systemSource
  if (typeof ref !== 'string') return component
  const entry = resolveSystemSource(ref, app.systemSources)
  if (!entry) return component
  const { name: _name, ...system } = entry
  return { ...component, dataSource: { system } as Component['dataSource'] }
}
