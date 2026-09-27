/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The shape of one library entry — a ready-made block, connection or recipe
 * that `sovrium library add` copies into an operator's config.
 *
 * TYPES AND AN IDENTITY FUNCTION ONLY. An entry is DATA: it is never executed
 * at install time beyond its `build` function turning parameters into a config
 * fragment, and nothing in it runs until the operator's own config runs it. The
 * only imports are `type` imports of the config shapes, which erase — so the
 * catalogue costs nothing to load beyond its own bytes.
 *
 * ─── WHY `build` IS TYPED AGAINST THE ENCODED CONFIG ───────────────────────
 *
 * The fragment an entry produces is the exact shape an operator writes by hand.
 * Typing it against `AppEncoded` means an entry that stops matching the schema
 * fails `tsc` here, on the line that drifted, rather than failing a user at
 * `sovrium library add`.
 */

import type { AppEncoded } from '@/domain/models/app'

/** The three kinds Phase 1 ships, in the order the manual lists them. */
export const LIBRARY_KINDS = ['block', 'connection', 'recipe'] as const

export type LibraryKind = (typeof LIBRARY_KINDS)[number]

/** The top-level config key each kind installs into. */
export const LIBRARY_TARGET_KEY: Readonly<Record<LibraryKind, LibraryTargetKey>> = {
  block: 'components',
  connection: 'connections',
  recipe: 'automations',
}

export type LibraryTargetKey = 'components' | 'connections' | 'automations'

type ElementOf<T> = T extends ReadonlyArray<infer Item> ? Item : never

/** The encoded config item each target key holds. */
export interface LibraryFragmentByKey {
  readonly components: ElementOf<NonNullable<AppEncoded['components']>>
  readonly connections: ElementOf<NonNullable<AppEncoded['connections']>>
  readonly automations: ElementOf<NonNullable<AppEncoded['automations']>>
}

/**
 * The operations a connection entry declares, typed as the config writes them —
 * so an entry can hold its operation set in a constant beside `build`.
 */
export type LibraryOperations = NonNullable<LibraryFragmentByKey['connections']['operations']>

/** A value an operator can set with `--set key=value`. */
export type LibraryParamValue = string | number

/** One declared parameter. */
export interface LibraryParam {
  readonly name: string
  readonly description: string
  /** How a `--set` value is read: `number` refuses anything that is not one. */
  readonly type: 'string' | 'number'
  /** A required parameter has no default; `add` refuses to run without it. */
  readonly required?: boolean
  readonly default?: LibraryParamValue
}

/** The third-party API an entry talks to. Names only — never a logo. */
export interface LibraryProvider {
  readonly name: string
  /** Where the provider documents the API the entry calls. Always https. */
  readonly docsUrl: string
  /** The date the entry was last checked against that documentation. */
  readonly verifiedOn: string
}

/** The field types a table's `fields[].type` accepts. */
export type LibraryFieldType = ElementOf<
  NonNullable<ElementOf<NonNullable<AppEncoded['tables']>>['fields']>
>['type']

/**
 * One field an entry reads from a table the OPERATOR owns. Its name is the
 * value of `param` when the entry lets the operator rename it, `name` otherwise
 * — so `name` is also the default a probe and the manual show.
 */
export interface LibraryExpectedField {
  readonly name: string
  /** A declared string parameter whose value names the field. */
  readonly param?: string
  readonly type: LibraryFieldType
}

/**
 * A table the entry expects the operator's config to define. The entry never
 * creates it: a block that lists posts, or a recipe that fires on a new
 * record, binds to the operator's OWN table, named by `param` — a declared
 * string parameter with a default — and `library add` refuses by name when the
 * table or one of its fields is missing.
 */
export interface LibraryExpectedTable {
  /** The declared string parameter whose value names the table. */
  readonly param: string
  /** The fields the entry reads, at least one. */
  readonly fields: readonly LibraryExpectedField[]
}

/** An expected table, its names resolved against the install's parameters. */
export interface ResolvedExpectedTable {
  readonly table: string
  readonly param: string
  readonly fields: ReadonlyArray<{
    readonly name: string
    readonly param?: string
    readonly type: LibraryFieldType
  }>
}

/** What `build` receives: the installed name and the resolved parameters. */
export interface LibraryBuildInput {
  /** The entry's slug, or the `--as` name the operator chose. */
  readonly name: string
  readonly params: Readonly<Record<string, LibraryParamValue | undefined>>
}

interface LibraryEntryBase {
  readonly slug: string
  readonly title: string
  readonly category: string
  readonly tags: readonly string[]
  /** One sentence: what installing this gives you. */
  readonly description: string
  /** Manual prose, one paragraph per item. Public: functional facts only. */
  readonly notes: readonly string[]
  readonly params: readonly LibraryParam[]
  /** Every environment variable the fragment reads, by NAME. */
  readonly env: readonly string[]
  /** Entry ids installed alongside this one when absent. */
  readonly requires: readonly string[]
  readonly provider?: LibraryProvider
  /**
   * Tables (and the fields read from them) the operator's config must already
   * define. Absent for an entry that reads no table.
   */
  readonly tables?: readonly LibraryExpectedTable[]
}

/** One entry of each kind — the kind decides which config item `build` returns. */
export type LibraryEntry =
  | (LibraryEntryBase & {
      readonly kind: 'block'
      readonly build: (input: LibraryBuildInput) => LibraryFragmentByKey['components']
    })
  | (LibraryEntryBase & {
      readonly kind: 'connection'
      readonly build: (input: LibraryBuildInput) => LibraryFragmentByKey['connections']
    })
  | (LibraryEntryBase & {
      readonly kind: 'recipe'
      readonly build: (input: LibraryBuildInput) => LibraryFragmentByKey['automations']
    })

/** `connection/qonto` — the id is the kind and the slug, which is also the file path. */
export const libraryEntryId = (entry: Pick<LibraryEntry, 'kind' | 'slug'>): string =>
  `${entry.kind}/${entry.slug}`

/**
 * The tables an entry expects, named as this install names them: a table or
 * field bound to a parameter takes that parameter's value, else its default.
 */
export const expectedTables = (
  entry: Pick<LibraryEntry, 'tables'>,
  params: Readonly<Record<string, LibraryParamValue | undefined>>
): readonly ResolvedExpectedTable[] =>
  (entry.tables ?? []).map((table) => ({
    table: String(params[table.param] ?? ''),
    param: table.param,
    fields: table.fields.map((field) => ({
      name: field.param === undefined ? field.name : String(params[field.param] ?? field.name),
      ...(field.param === undefined ? {} : { param: field.param }),
      type: field.type,
    })),
  }))

/**
 * Identity function that exists for its TYPE: an unknown key, a missing field or
 * a fragment that no longer matches the schema is an error on the entry's own
 * line rather than at the catalogue that collects it.
 */
export const defineLibraryEntry = <const Entry extends LibraryEntry>(entry: Entry): Entry => entry

/**
 * What a caller receives from the catalogue after its one lazy `import()` — the
 * entries' loader and the vocabulary beside them, as plain readonly data so it
 * can be passed around without handing over the module itself.
 */
export interface LibraryCatalogueApi {
  readonly LIBRARY_KINDS: readonly LibraryKind[]
  readonly LIBRARY_TARGET_KEY: Readonly<Record<LibraryKind, LibraryTargetKey>>
  readonly libraryEntryId: (entry: Pick<LibraryEntry, 'kind' | 'slug'>) => string
  readonly expectedTables: (
    entry: Pick<LibraryEntry, 'tables'>,
    params: Readonly<Record<string, LibraryParamValue | undefined>>
  ) => readonly ResolvedExpectedTable[]
  readonly loadCatalogue: () => Promise<readonly LibraryEntry[]>
}
