/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { deriveFilterBarFields } from '@/domain/models/app/pages/components/component-types/data/filter-bar-fields-from-service'
import {
  callerReaderFromSession,
  tableReadPrincipal,
} from '@/domain/models/app/tables/caller-record-gate-service'
import {
  buildReadAccessPlan,
  CANONICAL_READ_POLICY,
  type TableLike,
} from '@/domain/models/app/tables/read-access-plan-service'
import type { App } from '@/domain/models/app'
import type { SessionInfo } from '@/domain/models/app/auth/session-info'
import type { Page } from '@/domain/models/app/pages'

/**
 * Pre-render resolver for a `filter-bar`'s `fieldsFrom: { table }`: the binding
 * becomes the concrete `fields` the table declares — in declaration order, each
 * with the kind its type implies — and is REMOVED, so the island receives a
 * plain field list and the table's name never reaches the browser.
 *
 * The reader's read rules decide which fields are offered: a field the records
 * API would withhold from this reader is not offered, and its name is not
 * written into the page.
 */

/** What resolving a bar needs about the request. */
export interface FilterBarFieldsFromContext {
  readonly app: App
  readonly session: SessionInfo | undefined
}

/** Whether the reader may read `field` of `table`, as the records API decides. */
const readableBy =
  (table: TableLike, ctx: FilterBarFieldsFromContext) =>
  (field: string): boolean => {
    if (!ctx.app.auth) return true
    const plan = buildReadAccessPlan({
      app: ctx.app,
      table,
      principal: tableReadPrincipal(table, callerReaderFromSession(ctx.session, ctx.app)),
      policy: CANONICAL_READ_POLICY,
    })
    return plan.allowed && !plan.restrictedColumns.has(field)
  }

/** One bar with its fields derived; any other node returned untouched. */
function resolveBar(
  record: Readonly<Record<string, unknown>>,
  ctx: FilterBarFieldsFromContext
): Readonly<Record<string, unknown>> {
  const { fieldsFrom, ...rest } = record
  if (record['type'] !== 'filter-bar' || typeof fieldsFrom !== 'object' || fieldsFrom === null) {
    return record
  }
  const name = (fieldsFrom as { readonly table?: unknown }).table
  const table = (ctx.app.tables ?? []).find((candidate) => candidate.name === name)
  if (table === undefined) return rest
  const fields = deriveFilterBarFields(table.fields, readableBy(table as TableLike, ctx))
  return { ...rest, fields }
}

/** One node, its own bar resolved and every child walked. */
function resolveNode(node: unknown, ctx: FilterBarFieldsFromContext): unknown {
  if (Array.isArray(node)) {
    const walked = node.map((child) => resolveNode(child, ctx))
    return walked.every((child, index) => child === node[index]) ? node : walked
  }
  if (typeof node !== 'object' || node === null) return node
  const record = node as Readonly<Record<string, unknown>>
  if ('$ref' in record || 'component' in record) return node
  const own = resolveBar(record, ctx)
  const children = resolveNode(record['children'], ctx)
  if (own === record && children === record['children']) return node
  return children === undefined ? own : { ...own, children }
}

/** The page with every `filter-bar`'s `fieldsFrom` replaced by its fields. */
export function resolveFilterBarFieldsFrom(page: Page, ctx: FilterBarFieldsFromContext): Page {
  if (!page.components || page.components.length === 0) return page
  const components = resolveNode(page.components, ctx)
  return components === page.components
    ? page
    : { ...page, components: components as Page['components'] }
}
