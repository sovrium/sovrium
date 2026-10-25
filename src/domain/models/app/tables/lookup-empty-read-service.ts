/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The lookups that read empty for a whole role, found from the schema alone.
 *
 * A lookup copies a field of the linked record and answers to its reader's
 * rights on that record: a role refused the related table, or the related
 * field (or a value it is built from further along), reads the lookup as empty
 * on every row ({@link relatedValuesRefusedTo}). When that role may still read
 * the lookup's own table and the lookup field, the author has declared a
 * column the role sees and that never holds anything for it. This service
 * names those lookups, so `sovrium validate` can say so before users do.
 *
 * Roles asked: the built-in roles and every custom role the app declares,
 * less the admin-equivalent ones (never refused). A role already refused the
 * lookup field is not named: the lookup is hidden from it anyway.
 */

import { BUILT_IN_ROLES, isAdminEquivalent } from '@/domain/models/app/auth/roles/role'
import { lookupLinksOf, relatedValuesRefusedTo, type LookupLink } from './lookup-link-service'
import {
  mayReadRelatedField,
  mayReadRelatedTable,
  type RelatedReader,
} from './related-field-read-service'
import type { App } from '@/domain/models/app'

/** The roles a lookup is judged for: built-in and custom, admin-equivalent ones left out. */
const judgedRoles = (app: App): readonly string[] =>
  app.auth === undefined
    ? []
    : [...new Set([...BUILT_IN_ROLES, ...(app.auth.roles ?? []).map((role) => role.name)])]
        .filter((role) => !isAdminEquivalent(role, app))
        .toSorted()

const quoted = (names: readonly string[]): string => names.map((name) => `"${name}"`).join(', ')

/** One notice for `link` of `tableName`, naming every role in `roles`. */
const noticeFor = (
  app: App,
  tableName: string,
  link: LookupLink,
  roles: readonly string[]
): string => {
  const related = link.relatedTable.name
  const tableRefused = roles.every(
    (role) => !mayReadRelatedTable(app, { role, signedOut: false }, related)
  )
  const copied = tableRefused
    ? `table "${related}"`
    : `"${link.relatedField}" of table "${related}"`
  const who =
    roles.length === 1
      ? `role ${quoted(roles)} may not read: it reads empty for that role.`
      : `roles ${quoted(roles)} may not read: it reads empty for them.`
  return `Lookup "${link.lookup}" on table "${tableName}" copies ${copied}, which ${who}`
}

/**
 * One notice per lookup that reads empty for a role allowed to read it — a
 * role that may read the lookup's table and the lookup field, but not the
 * related table or the related field it copies. Lookups in declaration order,
 * roles sorted by name. Empty for an app without `auth`.
 */
export const emptyLookupReadNotices = (app: App): readonly string[] => {
  const roles = judgedRoles(app)
  if (roles.length === 0) return []
  return (app.tables ?? []).flatMap((table) => {
    const links = lookupLinksOf(app, table.name)
    if (links.length === 0) return []
    const refusedByRole = new Map(
      roles.map((role): readonly [string, ReadonlySet<string>] => {
        const reader: RelatedReader = { role, signedOut: false }
        return [role, relatedValuesRefusedTo(app, table.name, reader)]
      })
    )
    return links.flatMap((link) => {
      const emptyFor = roles.filter(
        (role) =>
          refusedByRole.get(role)?.has(link.lookup) === true &&
          mayReadRelatedField(app, { role, signedOut: false }, table.name, link.lookup)
      )
      return emptyFor.length === 0 ? [] : [noticeFor(app, table.name, link, emptyFor)]
    })
  })
}
