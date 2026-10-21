/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  connectionEnvRenames,
  renameEnvReferences,
  renamedEnvNames,
} from '@/domain/models/app/connections/connection-env-service'
import { renderFragment } from './library-add-reinstall'
import { bindingName } from './library-wire'
import type { RootFormat } from './library-add-config'
import type { ConnectionOperation } from '@/domain/models/app/connections/operations'
import type {
  LibraryCatalogueApi,
  LibraryEntry,
  LibraryParamValue,
} from '@/library/manifest/define'

/**
 * The variables `entry` installed as `name` reads, each under the name it is
 * written with: a connection under another name than its slug reads its own
 * secrets (`STRIPE_2_SECRET_KEY` for `stripe-2`), and shares only an OAuth2
 * client's id and secret — see `connection-env-service.ts`.
 */
const envRenamesOf = (entry: LibraryEntry, name: string, built: unknown) =>
  entry.kind === 'connection'
    ? connectionEnvRenames({ slug: entry.slug, name, env: entry.env, connection: built })
    : new Map<string, string>()

/** The variable NAMES `entry` installed as `name` with `params` reads. */
export const entryEnvFor = (input: {
  readonly entry: LibraryEntry
  readonly name: string
  readonly params: Readonly<Record<string, LibraryParamValue | undefined>>
}): readonly string[] => {
  const { entry, name, params } = input
  if (entry.kind !== 'connection' || name === entry.slug) return entry.env
  return renamedEnvNames(entry.env, envRenamesOf(entry, name, entry.build({ name, params })))
}

/**
 * One fragment exactly as `library add` writes it — the one renderer behind
 * every install, and behind `sovrium import`, which writes the connections it
 * needs as `library add` would so that a later `library add` changes nothing.
 * `operations`, when given, replace the built ones, as an operation install does.
 */
export const renderEntryFragment = (input: {
  readonly catalogue: Pick<LibraryCatalogueApi, 'libraryEntryId'>
  readonly version: string
  readonly format: RootFormat
  readonly entry: LibraryEntry
  readonly name: string
  readonly params: Readonly<Record<string, LibraryParamValue | undefined>>
  readonly operations?: readonly ConnectionOperation[]
  readonly recordParams?: boolean
}): string => {
  const { entry, name, params, operations = [] } = input
  const built = entry.build({ name, params }) as Readonly<Record<string, unknown>>
  return renderFragment({
    format: input.format,
    id: input.catalogue.libraryEntryId(entry),
    version: input.version,
    params,
    recordParams: input.recordParams ?? true,
    binding: bindingName(name),
    value: renameEnvReferences(
      operations.length === 0 ? built : { ...built, operations },
      envRenamesOf(entry, name, built)
    ),
  })
}
