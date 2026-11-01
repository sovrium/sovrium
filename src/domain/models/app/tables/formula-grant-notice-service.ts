/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The formulas whose own read grant promises more than their inputs allow,
 * found from the schema alone.
 *
 * A formula built over a `lookup`, `rollup` or `count` is left out for a
 * reader who may not read the value it is built from
 * ({@link relatedValuesRefusedTo}) — whatever the formula's own field grant
 * says. An author who writes `{ field: availability, read: all }` has declared
 * a column everyone is meant to see, and that some of them never receive.
 * This service names those formulas, the input that narrows them and who is
 * left without them, so `sovrium validate` can say so before users do.
 *
 * Readers asked: the visitor who is not signed in, and the built-in and custom
 * roles less the admin-equivalent ones (never refused). A reader the formula's
 * own grant already refuses is not named: the formula is hidden from them
 * anyway.
 */

import { declaresFieldRuleFor } from './field-read-filter-service'
import { judgedRoles } from './lookup-empty-read-service'
import { relatedValueLinksOf, relatedValuesRefusedTo, type LookupLink } from './lookup-link-service'
import { mayReadRelatedField, type RelatedReader } from './related-field-read-service'
import { extractFieldReferences } from './table-formula-validation'
import type { App, Table } from '@/domain/models/app'

/** The visitor who is not signed in, as the records API asks for her. */
const VISITOR: RelatedReader = { role: '', signedOut: true }

/** The formula fields of `table` that carry an entry of their own in `permissions.fields`. */
const grantedFormulas = (
  app: App,
  table: Table
): readonly { readonly name: string; readonly formula: string }[] =>
  table.fields.flatMap((field) => {
    const { formula } = field as { readonly formula?: unknown }
    return field.type === 'formula' &&
      typeof formula === 'string' &&
      declaresFieldRuleFor(app, table.name, field.name)
      ? [{ name: field.name, formula }]
      : []
  })

/**
 * The related values `formula` is built from — the lookups, rollups and counts
 * it names, directly or through another formula of the table.
 */
const inputsOf = (
  table: Table,
  links: ReadonlyMap<string, LookupLink>,
  formula: string,
  seen: ReadonlySet<string> = new Set()
): readonly LookupLink[] =>
  [...new Set(extractFieldReferences(formula))].flatMap((ref) => {
    if (seen.has(ref)) return []
    const link = links.get(ref)
    if (link !== undefined) return [link]
    const inner = table.fields.find((field) => field.name === ref && field.type === 'formula')
    const innerFormula = (inner as { readonly formula?: unknown } | undefined)?.formula
    return typeof innerFormula === 'string'
      ? inputsOf(table, links, innerFormula, new Set([...seen, ref]))
      : []
  })

const quoted = (names: readonly string[]): string => names.map((name) => `"${name}"`).join(', ')

/** `visitors`, `role "x"` or `roles "x", "y"`, joined by `and`. */
const whoOf = (readers: readonly RelatedReader[]): string => {
  const roles = readers.filter((reader) => !reader.signedOut).map((reader) => reader.role)
  const parts = [
    ...(readers.some((reader) => reader.signedOut) ? ['visitors'] : []),
    ...(roles.length === 0 ? [] : [`${roles.length === 1 ? 'role' : 'roles'} ${quoted(roles)}`]),
  ]
  return parts.join(' and ')
}

const noticeFor = (
  table: Table,
  formula: string,
  inputs: readonly LookupLink[],
  withheld: readonly RelatedReader[]
): string => {
  const read = inputs
    .map((link) => `"${link.lookup}", built from table "${link.relatedTable.name}",`)
    .join(' and ')
  return `Formula "${formula}" on table "${table.name}" has a read grant of its own, but it reads ${read} which ${whoOf(withheld)} may not read: it is left out for them.`
}

/**
 * One notice per formula with an explicit `permissions.fields` entry that the
 * related-value rule leaves out for at least one reader that entry admits.
 * Tables and formulas in declaration order; the visitor first, then roles by
 * name. Empty for an app without `auth`.
 */
export const narrowedFormulaGrantNotices = (app: App): readonly string[] => {
  if (app.auth === undefined) return []
  const readers: readonly RelatedReader[] = [
    VISITOR,
    ...judgedRoles(app).map((role) => ({ role, signedOut: false })),
  ]
  return (app.tables ?? []).flatMap((table) => {
    const formulas = grantedFormulas(app, table)
    if (formulas.length === 0) return []
    const refusedTo = readers.map(
      (reader) => [reader, relatedValuesRefusedTo(app, table.name, reader)] as const
    )
    const links = new Map(relatedValueLinksOf(app, table.name).map((link) => [link.lookup, link]))
    return formulas.flatMap(({ name, formula }) => {
      const withheld = refusedTo.filter(
        ([reader, refused]) =>
          refused.has(name) && mayReadRelatedField(app, reader, table.name, name)
      )
      if (withheld.length === 0) return []
      const inputs = inputsOf(table, links, formula).filter((link) =>
        withheld.some(([, refused]) => refused.has(link.lookup))
      )
      return inputs.length === 0
        ? []
        : [
            noticeFor(
              table,
              name,
              inputs,
              withheld.map(([reader]) => reader)
            ),
          ]
    })
  })
}
