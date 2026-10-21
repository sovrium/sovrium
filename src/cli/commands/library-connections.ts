/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The library's connections, as `sovrium import` needs them: a
 * migrated app step lands on the library's connection when the library holds
 * it, installed exactly as `sovrium library add connection/<slug>` installs it
 * — every operation its entry builds — plus each operation of the provider's
 * generated set the steps call, appended as `sovrium library add
 * <slug>/<operation>` appends it.
 *
 * The catalogue and the operation sets are reached through `await import()`,
 * as every library command reaches them, so no other verb pays for loading
 * them. A set is small (tens of kilobytes gzipped), and only the providers that
 * are also connection entries are read.
 */

import { declaredParamsOf } from '@/domain/models/import/flow-app-catalogue-service'
import type { ConnectionOperation } from '@/domain/models/app/connections/operations'
import type { LibraryConnection } from '@/domain/models/import/flow-mapper-service'
import type { LibraryCatalogueApi, LibraryEntry } from '@/library/manifest/define'

type ConnectionEntry = Extract<LibraryEntry, { readonly kind: 'connection' }>

const isConnection = (entry: LibraryEntry): entry is ConnectionEntry => entry.kind === 'connection'

/** What writing one library connection reads: its entry, and its generated operations. */
export interface LibraryInstallSource {
  readonly entry: ConnectionEntry
  /** The provider's generated operation set; empty when it ships none. */
  readonly known: readonly ConnectionOperation[]
}

/** The library's connections, for the mapper and for the writer. */
export interface LibraryConnections {
  /** A connection by slug, as the flow mapper reads it. */
  readonly connection: (slug: string) => LibraryConnection | undefined
  /** The entry and generated operations of a slug, for writing its fragment. */
  readonly source: (slug: string) => LibraryInstallSource | undefined
  readonly catalogue: Pick<LibraryCatalogueApi, 'libraryEntryId'>
}

/** Build an entry with its default parameters, or `undefined` when it needs one set. */
const buildDefault = (
  entry: ConnectionEntry,
  name: string
): Readonly<Record<string, unknown>> | undefined => {
  try {
    const params = Object.fromEntries(entry.params.map((param) => [param.name, param.default]))
    return entry.build({ name, params }) as Readonly<Record<string, unknown>>
  } catch {
    // An entry that cannot be built without the operator's own value is not installed by an import.
    return undefined
  }
}

const operationsOf = (built: Readonly<Record<string, unknown>>): readonly unknown[] =>
  Array.isArray(built['operations']) ? built['operations'] : []

const nameOf = (operation: unknown): string =>
  String((operation as { readonly name?: unknown } | null)?.name)

/** One library connection as the mapper reads it. */
const toConnection = (
  source: LibraryInstallSource,
  sample: Readonly<Record<string, unknown>>
): LibraryConnection => {
  const built = operationsOf(sample)
  const builtNames = built.map(nameOf)
  // The built operations win over a generated one of the same name.
  const declared = declaredParamsOf([
    ...source.known.filter((operation) => !builtNames.includes(operation.name)),
    ...built,
  ])
  const { entry } = source
  return {
    env: entry.env,
    operations: declared.operations,
    required: declared.required,
    built: builtNames,
    entry: (name, extra) => {
      const value = buildDefault(entry, name) ?? {}
      const appended = extra.flatMap(
        (wanted) => source.known.find((operation) => operation.name === wanted) ?? []
      )
      return appended.length === 0
        ? value
        : { ...value, operations: [...operationsOf(value), ...appended] }
    },
    ...(sample['type'] === 'oauth2' && entry.provider !== undefined
      ? { oauthApp: entry.provider.docsUrl }
      : {}),
  }
}

/** The library's connections by slug, for the flow mapper and the import's writer. */
export const loadLibraryConnections = async (): Promise<LibraryConnections> => {
  const catalogue = await import('@/library/manifest/catalogue')
  const { OPERATION_PROVIDERS, loadOperationSet } = await import('@/library/manifest/operations')
  const entries = (await catalogue.loadCatalogue()).filter(isConnection)
  const sources = new Map(
    await Promise.all(
      entries.map(async (entry) => {
        const set = (OPERATION_PROVIDERS as readonly string[]).includes(entry.slug)
          ? await loadOperationSet(entry.slug)
          : undefined
        return [entry.slug, { entry, known: set?.operations ?? [] }] as const
      })
    )
  )
  return {
    catalogue,
    source: (slug) => sources.get(slug),
    connection: (slug) => {
      const source = sources.get(slug)
      const sample = source === undefined ? undefined : buildDefault(source.entry, slug)
      return source === undefined || sample === undefined ? undefined : toConnection(source, sample)
    },
  }
}
