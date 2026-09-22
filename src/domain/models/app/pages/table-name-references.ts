/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Cross-config TABLE-NAME validation.
 *
 * `component-field-references.ts` ended the "checked under a `table`, silent
 * under a `kpi`" asymmetry at the array boundary — whether a FIELD name was
 * cross-checked used to depend on which component happened to name it. The
 * same asymmetry survived one level up, on the table name itself, and there it
 * was worse: a misspelled field still binds to a real table and draws a blank
 * cell, while a misspelled TABLE binds to nothing and a `kpi` renders a tile
 * reading `0` — a number a dashboard is supposed to show. Nothing at runtime
 * tells "no orders yet" apart from "this tile has been pointed at `ordrs`
 * since the day it was written".
 *
 * Two surfaces rejected an unknown name before this module — the `table`
 * component (`validateDbTableColumns`) and `select` (`validateAllSelectOptionSources`)
 * — and SIXTEEN accepted it in silence. The cause was a deferral that pointed
 * nowhere: the generic component pass skips a component whose table does not
 * resolve, on the stated grounds that an unknown table is "the table rule's
 * error", while the walker feeding that rule filters on `type === 'table'`. So
 * a `kpi` typo lost both checks at once.
 *
 * THE RULE IS NOW UNIFORM: **every config key whose value is a table NAME is
 * resolved against `app.tables[]`**, wherever it is written — on a component,
 * on a page, on a layout section, or on a crud action. Keyed on the SHAPE that
 * binds a table rather than on a list of component types, so a new data-bound
 * component is covered the day it is added, with no line to remember here.
 * That is the same lesson `DATA_SOURCE_FIELD_REFERENCE_PATHS` pinned one level
 * down, applied one level up.
 *
 * ONE WALK. Every binding — the eleven types that spread `DataSourceSchema`,
 * the bespoke `{ table, ... }` structs shaped after it (`record-picker`,
 * `drawer`), the page-level surfaces a component walk cannot see (a page has no
 * `type`, so `collectComponents` never yields one), and the crud action's
 * `table` — is found by {@link collectTableNameBindings} in a single traversal.
 * A second traversal is how two sweeps end up disagreeing about which surfaces
 * they cover.
 *
 * TWO SURFACES ARE DELIBERATELY LEFT OUT, each because an existing rule already
 * reports the same verdict and repeating it would give one mistake two voices:
 * the `table` component and `select`. See {@link REPORTED_BY_ANOTHER_RULE}.
 *
 * TWO NON-CHECKS, both of which must survive.
 *
 * A `$param.<name>` ROUTE REFERENCE names a
 * table the request supplies, not one the config declares, so there is nothing
 * offline to resolve it against — and the records-explorer page that makes one
 * page definition serve every declared table depends on it. The offline
 * question that IS decidable, whether the page's `path` declares the segment,
 * is asked by `collectPageBindingViolations`.
 *
 * A RESERVED name (`reserved-table-names.ts`) is one the platform serves
 * itself — the `user_access` junction and the design-system fixture — so it
 * resolves at runtime without an `app.tables[]` entry, exactly as a system
 * column resolves without a `fields[]` entry one level down.
 *
 * It runs inside `decodeAppConfigObject`, so `validate`, `start` and `build`
 * reach the same verdict. See `runSemanticChecks` there.
 */

import { isRouteParamRef } from '@/domain/models/app/pages/route-param-ref'
import { isReservedTableName } from '@/domain/models/app/tables/reserved-table-names'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

/**
 * Component types whose unknown table name is ALREADY reported, by name.
 *
 * `table` is reported by `validateDbTableColumns`, whose wording
 * (`Table 'X' not found. Available: …`) this module adopts rather than
 * inventing a second one. `select` is reported by
 * `validateAllSelectOptionSources`, which additionally cross-checks the
 * `displayField` / `valueField` that only a select declares.
 *
 * Skipped here so one mistake is named once. Removing an entry does not lose
 * coverage — it duplicates it.
 */
const REPORTED_BY_ANOTHER_RULE: ReadonlySet<string> = new Set(['table', 'select'])

/**
 * Whether a bound name resolves WITHOUT an `app.tables[]` entry.
 *
 * The two exemptions read as one question — "is this name the config's to
 * declare at all?" — so they are asked through one function, by this module and
 * by `validateDbTableColumns` alike. They were asked separately once, and the
 * result was a grid that refused the design-system fixture every other surface
 * accepted.
 *
 * A `$param.<name>` ROUTE REFERENCE names a table the REQUEST supplies; a
 * RESERVED name is one the platform serves itself. Neither is decidable from
 * `app.tables[]`, and neither is a mistake.
 */
export const resolvesWithoutAppTablesEntry = (table: string): boolean =>
  isReservedTableName(table) || isRouteParamRef(table)

/** One table name found in the config, and the surface that bound it. */
interface TableNameBinding {
  /**
   * How the report names the surface: the component `type` where the binding's
   * owner declares one, else the owner's config path.
   *
   * A page, a layout section and a sidebar entry have no `type` — which is
   * exactly why they were invisible to the component walk — so they are named
   * by where they sit (`pages[0]`, `pages[2].layout.sidebar[0]`).
   */
  readonly surface: string
  /** The key path, relative to {@link surface}, the name was written at. */
  readonly key: string
  readonly table: string
}

/** The table name a `{ table, ... }` source struct binds, when it binds one. */
const boundTableName = (source: unknown): string | undefined => {
  if (!isRecord(source)) return undefined
  const { table } = source
  return typeof table === 'string' ? table : undefined
}

/**
 * Every table name ONE node binds, without descending.
 *
 * Three shapes, which together are every way a config names a table outside the
 * two surfaces {@link REPORTED_BY_ANOTHER_RULE} owns:
 *
 *  - `dataSource.table` — the shared `DataSourceSchema` and the bespoke structs
 *    shaped after it, on a component, a page, or a sidebar section alike;
 *  - `collection.table` — the template page that generates one route per record;
 *  - a crud action's own `table`, which rides on an ACTION rather than on a
 *    `dataSource` and so is reached by neither of the above.
 *
 * A system-source binding (`{ system: … }`) carries no `table` key at all, so it
 * is skipped by construction rather than by an exemption that could fall out of
 * step with the schema.
 */
const bindingsOn = (
  node: Readonly<Record<string, unknown>>,
  path: string
): readonly TableNameBinding[] => {
  const { type } = node
  if (typeof type === 'string' && REPORTED_BY_ANOTHER_RULE.has(type)) return []
  const surface = typeof type === 'string' ? type : path

  const named = [
    ['dataSource.table', boundTableName(node['dataSource'])],
    ['collection.table', boundTableName(node['collection'])],
    ['table', type === 'crud' ? boundTableName(node) : undefined],
  ] as const

  return named.flatMap(([key, table]) =>
    table === undefined ? [] : [{ surface, key, table } satisfies TableNameBinding]
  )
}

/**
 * Every table name bound anywhere in a parsed config, with its surface.
 *
 * Recurses through every value rather than sweeping `pages[].components[]`: a
 * binding can sit inside a container, a tab panel, a drawer or a `props` bag
 * (five shipped data-tables nest their whole config under one), and a shallow
 * walk would exempt exactly the nested surfaces an author is most likely to get
 * wrong.
 *
 * The path is carried so a surface with no `type` can still be named. It is
 * written the way an author reads their own file — `pages[2].layout.sidebar[0]`
 * — because a config with nine data-bound tiles is not searchable by table name
 * alone.
 */
const collectTableNameBindings = (node: unknown, path: string): readonly TableNameBinding[] => {
  if (Array.isArray(node)) {
    return node.flatMap((element, index) => collectTableNameBindings(element, `${path}[${index}]`))
  }
  if (!isRecord(node)) return []
  return [
    ...bindingsOn(node, path),
    ...Object.entries(node).flatMap(([key, value]) =>
      collectTableNameBindings(value, path === '' ? key : `${path}.${key}`)
    ),
  ]
}

/**
 * Every table name `app.tables[]` declares, in declaration order.
 *
 * Reads the RAW parsed shape rather than a decoded `App` because the caller is
 * the post-decode sweep, which holds the parsed object — and because a config
 * that failed to decode never reaches here at all.
 */
const collectDeclaredTableNames = (config: unknown): readonly string[] => {
  const tables = (config as { readonly tables?: unknown } | null)?.tables
  if (!Array.isArray(tables)) return []
  return tables.flatMap((table: unknown) => {
    const { name } = table as { readonly name?: unknown }
    return typeof name === 'string' ? [name] : []
  })
}

/**
 * Report every table name that no `app.tables[]` entry declares.
 *
 * EVERY offender is reported, not the first: an author correcting one typo
 * would otherwise meet the next on the following run, and a dashboard is
 * exactly where several of these get written at once.
 *
 * The wording is `validateDbTableColumns`'s, prefixed with the surface the same
 * way the field-reference sibling prefixes `form.fields[1].field` — one shape
 * at both levels, so an author who has read one report can read the other.
 */
export function validateTableNameReferences(config: unknown): readonly string[] {
  const declared = collectDeclaredTableNames(config)
  const known = new Set(declared)
  const available = declared.join(', ') || '(none)'

  return collectTableNameBindings(config, '').flatMap(({ surface, key, table }) =>
    known.has(table) || resolvesWithoutAppTablesEntry(table)
      ? []
      : [`${surface}.${key}: Table '${table}' not found. Available: ${available}`]
  )
}
