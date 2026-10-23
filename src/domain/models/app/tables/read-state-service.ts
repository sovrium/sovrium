/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { App } from '@/domain/models/app'

/** The count name a `readState: true` relationship gives its parent's rows. */
export const DEFAULT_UNREAD_COUNT_NAME = 'unreadCount'

/**
 * One unread count a parent table's rows carry: the child table and its link
 * field holding the parent's id, and the name the count goes by on the row.
 */
export interface ReadStateCount {
  readonly name: string
  readonly childTable: string
  readonly linkField: string
}

/** A field as this reader needs it: loose enough to read any field of any table. */
interface LooseField {
  readonly name: string
  readonly type: string
  readonly relatedTable?: string
  readonly relationType?: string
  readonly readState?: boolean | { readonly as: string }
}

/** The count name a `readState` declaration gives, or `undefined` when it is off. */
const countNameOf = (readState: LooseField['readState']): string | undefined => {
  if (readState === true) return DEFAULT_UNREAD_COUNT_NAME
  if (typeof readState === 'object') return readState.as
  return undefined
}

/**
 * Every unread count the rows of `parentTable` carry: one per relationship
 * declaring `readState` that links a child row to ONE parent (many-to-one or
 * one-to-one), since only such a link stores the parent's id on the child.
 */
export const readStateCountsOf = (
  app: Pick<App, 'tables'>,
  parentTable: string
): readonly ReadStateCount[] =>
  (app.tables ?? []).flatMap((table) =>
    (table.fields as readonly LooseField[]).flatMap((field) => {
      const name = countNameOf(field.readState)
      const linksOne = field.relationType === 'many-to-one' || field.relationType === 'one-to-one'
      return field.type === 'relationship' &&
        field.relatedTable === parentTable &&
        linksOne &&
        name !== undefined
        ? [{ name, childTable: table.name, linkField: field.name }]
        : []
    })
  )

/**
 * The server-only filter operator "this row was not created by her, as the
 * activity log records its creation" — the authorship of a child table that
 * declares no `created-by` field. Compiled to a subquery on the activity log,
 * so the exclusion never carries her rows' ids as bound values. Only the server
 * writes it: the records API refuses it from a caller as an unknown operator.
 */
export const NOT_LOGGED_CREATOR_OPERATOR = 'notCreatedByPerActivityLog'

/** What {@link NOT_LOGGED_CREATOR_OPERATOR} compares against: the person and the table logged. */
export interface NotLoggedCreatorValue {
  readonly userId: string
  readonly tableName: string
}

/** Whether a filter value is a {@link NotLoggedCreatorValue}. */
export const isNotLoggedCreatorValue = (value: unknown): value is NotLoggedCreatorValue =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as Record<string, unknown>)['userId'] === 'string' &&
  typeof (value as Record<string, unknown>)['tableName'] === 'string'

/** A filter node of a records-API list filter, as the unread count writes it. */
type UnreadFilterNode =
  | { readonly field: string; readonly operator: string; readonly value: unknown }
  | { readonly and: readonly UnreadFilterNode[] }
  | { readonly or: readonly UnreadFilterNode[] }

/** One parent row whose children are counted, and the reader's read position on it. */
export interface UnreadParent {
  readonly id: string
  readonly since: Date | undefined
}

/**
 * The children of a page of parents she has not read, as ONE filter a single
 * grouped count answers: a child linked to one of the parents and created after
 * her position on THAT parent (every child of a parent she never read), and not
 * created by her. Her own children are named by the child table's `created-by`
 * field when it declares one, else by the activity log's record of their
 * creation ({@link NOT_LOGGED_CREATOR_OPERATOR}).
 */
export const groupedUnreadFilterOf = (input: {
  readonly linkField: string
  readonly childTable: string
  readonly authorField: string | undefined
  readonly userId: string
  readonly parents: readonly UnreadParent[]
}): readonly UnreadFilterNode[] => {
  const { linkField, childTable, authorField, userId, parents } = input
  const ofParent = ({ id, since }: UnreadParent): UnreadFilterNode => {
    const linked = { field: linkField, operator: 'equals', value: id }
    return since === undefined
      ? linked
      : {
          and: [
            linked,
            { field: 'created_at', operator: 'greaterThan', value: since.toISOString() },
          ],
        }
  }
  const notHers: UnreadFilterNode =
    authorField === undefined
      ? {
          field: 'id',
          operator: NOT_LOGGED_CREATOR_OPERATOR,
          value: { userId, tableName: childTable },
        }
      : {
          or: [
            { field: authorField, operator: 'isNull', value: undefined },
            { field: authorField, operator: 'notEquals', value: userId },
          ],
        }
  return [{ or: parents.map(ofParent) }, notHers]
}
