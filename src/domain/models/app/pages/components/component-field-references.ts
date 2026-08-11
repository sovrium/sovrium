/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Cross-component field-reference validation.
 *
 * Many components name a TABLE FIELD in their config. Until this module, which
 * of those names got checked against the bound table was an accident of which
 * validator someone happened to write: a data-table's `kanbanGroupBy.field` and
 * `dateField` were cross-checked, while the standalone kanban's
 * `card.colorField` and the calendar's `colorField` — the same grammar, naming
 * the same kind of thing — were not. So an identical typo failed loudly in one
 * component and silently painted nothing in another.
 *
 * The rule is now uniform: **every config key whose value is a table-field name
 * is checked against the bound table**, whether it sits at a scalar key or
 * inside an array. Adding a field-naming property to a component means adding
 * one line to a registry here rather than writing a new validator (or, as
 * happened repeatedly, not writing one).
 *
 * There are two registries, and the split is load-bearing rather than
 * historical: {@link COMPONENT_FIELD_REFERENCE_PATHS} holds keys that belong to
 * ONE component type, while {@link DATA_SOURCE_FIELD_REFERENCE_PATHS} holds the
 * keys on the `dataSource` that eleven types spread — enumerating those per type
 * is the drift this module exists to end.
 *
 * One deliberate non-goal: it does NOT adjudicate the system namespace (`id`,
 * the timestamps, the authorship columns). Those exist without appearing in
 * `fields[]`; see `domain/models/shared/system-fields.ts`.
 *
 * IT DOES RUN AT DECODE TIME. This comment used to say the opposite — "a
 * pre-flight `sovrium validate` check, not a new way for a running app to refuse
 * to start". That held while the promise was only that validate and start
 * mostly agreed. It stopped holding once the promise became that they run the
 * SAME validation: a rule that fires in one command and not the other is the
 * divergence, whichever direction it leans. `decodeAppConfigObject` calls this,
 * so `validate`, `start` and `build` reach the same verdict. See
 * `runSemanticChecks` there for why "no warning" was the worse of the two
 * options rather than the safe one.
 */

import { findMatchingFieldName } from '@/domain/models/shared/field-name-matching'
import { isSystemFieldName } from '@/domain/models/shared/system-fields'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

/**
 * Every component in a parsed config, at any depth.
 *
 * ONE walk for every raw-config sweep. A component can sit inside a container, a
 * tab panel or a split pane, and a shallow `pages[].components[]` sweep would
 * exempt exactly the nested surfaces an author is most likely to get wrong — so
 * this recurses through every value. A second traversal elsewhere is how two
 * sweeps end up disagreeing about which surfaces they cover.
 */
export function collectComponents(config: unknown): readonly Record<string, unknown>[] {
  if (Array.isArray(config)) return config.flatMap(collectComponents)
  if (!isRecord(config)) return []
  const self = typeof config['type'] === 'string' ? [config] : []
  return [...self, ...Object.values(config).flatMap(collectComponents)]
}

/** Every component of one `type`. */
export function collectComponentsOfType(
  config: unknown,
  type: string
): readonly Record<string, unknown>[] {
  return collectComponents(config).filter((component) => component['type'] === type)
}

/**
 * The two type literals that share the byte-identical `formFields` definition.
 *
 * `data-form` is not an alias the decoder resolves away — it is a second
 * registered literal built from the same `formFields` object, and it is the one
 * the record-detail view emits. A registry keyed on `form` alone would exempt
 * every `data-form` in the codebase, reopening this exact gap on the surface
 * most likely to carry it, so both keys below point at this one list.
 */
const FORM_FIELD_REFERENCE_PATHS = ['fields[].field', 'fieldGroups[].fields[]'] as const

/**
 * The registry paths whose RENDERER resolves a field name leniently, and which
 * this validator must therefore resolve the same way.
 *
 * A form's `fields[].field` has always accepted either naming convention —
 * `crud-form-field-resolver.ts` folds `firstName` onto a `first_name` column,
 * documented and covered by green specs. Comparing exactly here refused, at
 * boot, configs that the renderer rendered perfectly.
 *
 * DELIBERATELY A SET OF ONE. The lenient/exact split is not a systemic drift to
 * sweep away: `fields[].field` is the ONLY key in the codebase whose renderer
 * folds. Everything else resolves by exact name — a data-table's `groupBy`, a
 * kanban or calendar `colorField`, a record-drawer entry, `dataSource.sort` —
 * and so does `fieldGroups[].fields[]`, the sibling path on this very component
 * (`crud-form/layout.tsx` keys a Map on the exact `name`). Adding any of them
 * here would make the validator ACCEPT a name its renderer then silently drops,
 * which is the failure mode this module exists to end, not a relaxation of it.
 *
 * The entry belongs here the day a renderer starts folding, and must be removed
 * the day one stops.
 */
const LENIENTLY_RESOLVED_PATHS: ReadonlySet<string> = new Set(['fields[].field'])

/**
 * Config keys whose value is a table-field NAME, by component type.
 *
 * Paths are dot-separated and written exactly as an author writes them, `[]`
 * included: a segment suffixed with `[]` is an ARRAY the resolver iterates,
 * and the index it was found at is carried into the report. A path that ENDS in
 * `[]` names an array of bare field-name strings (`fieldGroups[].fields[]`)
 * rather than of objects (`fields[].field`) — the same grammar covers both.
 *
 * `data-table` is deliberately ABSENT: its own richer validator
 * (`validateDataTableColumns`) already covers `columns[]`, `groupBy`, `summary`,
 * `dataSource.sort` and `dataSource.filter`, and duplicating it here would
 * report every data-table error twice. It is not exempt, though — see
 * {@link DATA_SOURCE_FIELD_REFERENCE_PATHS} for the one shared path its
 * validator does NOT read.
 *
 * `data-timeline` reads its display bindings from `props` rather than from the
 * component root — it is the one component type whose props builder does that
 * (`type-specific-props-builder.ts`), so its paths are `props.`-prefixed. Every
 * other type here binds at the root.
 *
 * Two categories are deliberately absent, each for a reason that is NOT "we
 * ran out of time":
 *
 * 1. **`$record.*` template tokens** — `kanban.card.coverImage`,
 *    `gallery.galleryCard.coverImage`, `list.listDisplay.itemTemplate.*`. Their
 *    value is a template expression, not a bare field name, so checking it
 *    against `fields[]` would reject every correct config.
 * 2. **`display/timeline`'s typed schema** — it declares `startField` and
 *    friends but is dead code: nothing outside its own test imports it, and the
 *    live `type: 'timeline'` component has no field-name property at all.
 *    Registering it would validate a shape no author can write.
 *
 * A third category — paths on surfaces this component walk cannot see, such as
 * `tables[].fields[].sourceFields[]` and `pages[].dataSource` — is tracked in
 * the user story rather than here, because no line in this registry could reach
 * them: a page carries no `type`, so {@link collectComponents} never yields one.
 */
export const COMPONENT_FIELD_REFERENCE_PATHS: Readonly<Record<string, readonly string[]>> = {
  kanban: ['kanbanGroupBy.field', 'colorField', 'card.colorField', 'card.footer[].field'],
  calendar: ['dateField', 'endDateField', 'labelField', 'colorField'],
  'data-timeline': [
    'props.startField',
    'props.endField',
    'props.labelField',
    'props.groupBy',
    'props.colorField',
  ],
  form: FORM_FIELD_REFERENCE_PATHS,
  'data-form': FORM_FIELD_REFERENCE_PATHS,
  'record-drawer': ['recordFields[].name'],
  chart: ['series[].field', 'chartAggregate.field', 'chartAggregate.groupBy'],
  kpi: ['kpiAggregate.field'],
}

/**
 * Field-naming keys on the SHARED `DataSourceSchema`, checked on every component
 * that binds one — not on a per-type allow-list.
 *
 * These are registered apart from {@link COMPONENT_FIELD_REFERENCE_PATHS}
 * because they are not a property of any component type: eleven types spread the
 * same `dataSource`, so enumerating them per type is the drift bug this module
 * exists to end. Before this, the identical three-line `dataSource.filter` was
 * cross-checked under a `data-table` and accepted in silence under a `kpi` — the
 * rule stopped at the component boundary rather than at the data it describes.
 * Keying on "does a `dataSource.table` resolve?" makes a new data-bound
 * component covered the day it is added, with no line to remember here.
 */
const DATA_SOURCE_FIELD_REFERENCE_PATHS = [
  'dataSource.fields[]',
  'dataSource.filter[].field',
  'dataSource.sort[].field',
] as const

/**
 * The shared paths `validateDataTableColumns` already reports for a data-table.
 *
 * Subtracted for that one type so a data-table typo is named once rather than in
 * two voices. `dataSource.fields[]` is deliberately NOT in this set: that
 * validator reads `columns`, `groupBy`, `summary`, `sort` and `filter` and never
 * the fetch projection, so leaving it out here is what makes the projection
 * checked on a data-table at all.
 */
const DATA_SOURCE_PATHS_OWNED_BY_DATA_TABLE: ReadonlySet<string> = new Set([
  'dataSource.filter[].field',
  'dataSource.sort[].field',
])

/** One resolved leaf: the value found, and the path it was found at. */
interface ResolvedFieldReference {
  /** The registry path with every `[]` replaced by the index it matched. */
  readonly path: string
  readonly value: unknown
}

/**
 * Every leaf a registry path reaches, with array positions resolved to indices.
 *
 * Returns a LIST rather than a value because one path can name many leaves:
 * `fields[].field` reaches one per array element, and `fieldGroups[].fields[]`
 * one per member of each group. An absent hop yields nothing rather than a
 * placeholder — a component that declares no `fieldGroups` has made no mistake.
 */
const resolveFieldReferences = (
  node: unknown,
  segments: readonly string[],
  prefix: string
): readonly ResolvedFieldReference[] => {
  const [head, ...rest] = segments
  if (head === undefined) return [{ path: prefix, value: node }]

  const isArrayHop = head.endsWith('[]')
  const key = isArrayHop ? head.slice(0, -2) : head
  const child = isRecord(node) ? node[key] : undefined
  if (child === undefined) return []

  const childPrefix = prefix === '' ? key : `${prefix}.${key}`
  if (!isArrayHop) return resolveFieldReferences(child, rest, childPrefix)
  // A non-array value under an `[]` segment is malformed raw config, which the
  // structural decode owns; iterating it here would invent positions.
  if (!Array.isArray(child)) return []
  return child.flatMap((element, index) =>
    resolveFieldReferences(element, rest, `${childPrefix}[${index}]`)
  )
}

/** Every field-naming path that applies to one component, by its `type`. */
const pathsForComponent = (type: unknown): readonly string[] => {
  const shared =
    type === 'data-table'
      ? DATA_SOURCE_FIELD_REFERENCE_PATHS.filter(
          (path) => !DATA_SOURCE_PATHS_OWNED_BY_DATA_TABLE.has(path)
        )
      : DATA_SOURCE_FIELD_REFERENCE_PATHS
  return [...(COMPONENT_FIELD_REFERENCE_PATHS[type as string] ?? []), ...shared]
}

/**
 * Build `tableName → declared field names` from a RAW parsed config.
 *
 * Reads the raw shape rather than a decoded `App` because the caller is the
 * CLI's post-decode sweep, which holds the parsed object.
 */
const collectTableFieldNames = (config: unknown): ReadonlyMap<string, readonly string[]> => {
  const tables = (config as { readonly tables?: unknown } | null)?.tables
  if (!Array.isArray(tables)) return new Map()
  return new Map(
    tables.flatMap((table: unknown) => {
      const t = table as { readonly name?: unknown; readonly fields?: unknown }
      if (typeof t.name !== 'string' || !Array.isArray(t.fields)) return []
      const names = t.fields.flatMap((field: unknown) => {
        const { name } = field as { readonly name?: unknown }
        return typeof name === 'string' ? [name] : []
      })
      return [[t.name, names] as const]
    })
  )
}

/**
 * Whether one reference resolves to a real column of the bound table.
 *
 * Exact first, always. A path listed in {@link LENIENTLY_RESOLVED_PATHS} then
 * gets the same case/separator folding its renderer applies, so this validator
 * and that renderer cannot reach opposite verdicts on the same config.
 */
const resolvesToDeclaredField = (
  declared: readonly string[],
  value: string,
  registryPath: string
): boolean => {
  if (declared.includes(value) || isSystemFieldName(value)) return true
  return (
    LENIENTLY_RESOLVED_PATHS.has(registryPath) &&
    findMatchingFieldName(declared, value) !== undefined
  )
}

/**
 * Report every component field reference that names neither a declared field nor
 * a system column.
 *
 * Skipped, deliberately and in each case because the verdict belongs to another
 * rule that would otherwise say the same thing twice in two voices:
 *  - a component with no resolvable `dataSource.table` (a system-source binding,
 *    or a table name that does not exist — the latter is the table rule's error);
 *  - a non-string value (malformed raw config — the structural decode owns it).
 */
export function validateComponentFieldReferences(config: unknown): readonly string[] {
  const tableFields = collectTableFieldNames(config)

  return collectComponents(config).flatMap((component) => {
    const paths = pathsForComponent(component['type'])
    const { dataSource } = component
    const table = isRecord(dataSource) ? dataSource['table'] : undefined
    if (typeof table !== 'string') return []
    const declared = tableFields.get(table)
    if (declared === undefined) return []

    // The REGISTRY path is carried alongside the resolved one: the resolved path
    // has its `[]` replaced by indices (`fields[0].field`) for the report, so it
    // cannot be looked up in a registry-keyed set.
    return paths.flatMap((registryPath) =>
      resolveFieldReferences(component, registryPath.split('.'), '').flatMap(({ path, value }) => {
        if (typeof value !== 'string' || resolvesToDeclaredField(declared, value, registryPath)) {
          return []
        }
        return [
          `${String(component['type'])}.${path}: field '${value}' not found in table '${table}'. Available: ${declared.join(', ')}`,
        ]
      })
    )
  })
}
