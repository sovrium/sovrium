/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `sovrium import --write` for the library connections an import needs:
 * each one written through `sovrium library add`'s own renderer and
 * operation planner, so the files are byte for byte what `library add` writes,
 * and a `library add` of the same connection or operation afterwards changes
 * nothing.
 *
 * - **A new connection** gets the fragment `library add connection/<slug>
 *   [--as <name>]` writes, then each generated-set operation its steps call
 *   appended as `library add <slug>/<operation>` appends it. A YAML root gains
 *   the one `$ref` line, a JSON root the `$ref` object; a TypeScript root is
 *   never edited, and the import line to paste is printed.
 * - **A connection the config already holds** keeps its `$ref` and its
 *   fragment; only missing operations are appended, under the rule `library
 *   add` applies: the fragment is rewritten only while it is still exactly the
 *   library's. An edited one is never touched, and the import is refused with
 *   the operations to paste.
 */

import { mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { refuse } from './app-prelude'
import { renderEntryFragment } from './library-add-fragment'
import { planOperationFragment } from './library-add-operations'
import { defaultParams } from './library-add-params'
import { digest, readIfExists } from './library-add-plan'
import { bindingName } from './library-wire'
import type { RootFormat } from './library-add-config'
import type { InstallParams } from './library-add-reinstall'
import type { LibraryConnections, LibraryInstallSource } from './library-connections'
import type { ConnectionOperation } from '@/domain/models/app/connections/operations'
import type {
  ExistingConnection,
  PlannedConnection,
} from '@/domain/models/import/flow-mapper-service'

/** What writing the library connections reads. */
export interface LibraryWrite {
  /** The library connections the automations use, new and reused. */
  readonly connections: readonly PlannedConnection[]
  readonly library: Pick<LibraryConnections, 'source' | 'catalogue'>
  /** The running version, which every fragment's provenance line names. */
  readonly version: string
  /** The config as it was read, for the parameters an entry takes from it. */
  readonly parsed: unknown
}

/** One fragment the import writes, or leaves as it is. */
export interface PlannedFragment {
  readonly name: string
  readonly relativePath: string
  readonly absolutePath: string
  readonly content: string
  /** Whether the bytes on disk change. */
  readonly changed: boolean
  /** The SHA-256 of a fragment being rewritten, as read. */
  readonly expectedDigest?: string
  /** The config already wired it. */
  readonly reused: boolean
}

const operationsNamed = (
  source: LibraryInstallSource,
  names: readonly string[]
): readonly ConnectionOperation[] =>
  names.flatMap((name) => source.known.find((operation) => operation.name === name) ?? [])

/** The operations an entry builds, as they are written. */
const builtOperations = (source: LibraryInstallSource, name: string, params: InstallParams) => {
  const built = source.entry.build({ name, params }) as { readonly operations?: unknown }
  return Array.isArray(built.operations) ? (built.operations as ConnectionOperation[]) : []
}

/** What planning one fragment has read. */
interface FragmentInput {
  readonly format: RootFormat
  readonly id: string
  readonly base: Pick<PlannedFragment, 'name' | 'relativePath' | 'absolutePath' | 'reused'>
  readonly onDisk: string | undefined
  readonly source: LibraryInstallSource
  readonly params: InstallParams
  readonly render: (operations: readonly ConnectionOperation[]) => string
}

/**
 * The fragment with the operations its steps call appended, as `library add
 * <slug>/<operation>` appends them, after `library add connection/<slug>`.
 */
const withOperations = (
  input: FragmentInput,
  extra: readonly ConnectionOperation[]
): PlannedFragment => {
  const { base, onDisk, render } = input
  // A TypeScript fragment is never rewritten; a new one is written whole.
  if (input.format === 'typescript' && onDisk === undefined)
    return {
      ...base,
      content: render([...builtOperations(input.source, base.name, input.params), ...extra]),
      changed: true,
    }
  const fragment = planOperationFragment({
    format: input.format,
    id: input.id,
    relativePath: base.relativePath,
    onDisk: onDisk ?? render([]),
    requested: extra,
    known: input.source.known,
    render,
  })
  if (fragment.operations.paste !== undefined)
    return refuse(
      `Error: ${fragment.operations.reason ?? `${base.relativePath} cannot be edited`}, so the import changed nothing.\n\n` +
        `  Add under \`operations\` in ${base.relativePath}, then run the import again:\n\n${fragment.operations.paste}`
    )
  const rewrite = onDisk === undefined ? undefined : fragment.expectedDigest
  return {
    ...base,
    content: fragment.content,
    changed: !fragment.present,
    ...(rewrite === undefined ? {} : { expectedDigest: rewrite }),
  }
}

/** The fragment one library connection needs, with every operation its steps call. */
const planFragment = async (
  configPath: string,
  format: RootFormat,
  write: LibraryWrite,
  planned: PlannedConnection
): Promise<PlannedFragment> => {
  const source =
    write.library.source(planned.slug) ??
    refuse(`Error: The library has no connection "${planned.slug}", so nothing was written.`)
  const relativePath = `library/connection/${planned.name}.${format === 'typescript' ? 'ts' : 'yaml'}`
  const absolutePath = join(dirname(configPath), relativePath)
  const onDisk = await readIfExists(absolutePath)
  const params = defaultParams(source.entry, write.parsed) ?? {}
  const render = (operations: readonly ConnectionOperation[]) =>
    renderEntryFragment({
      version: write.version,
      catalogue: write.library.catalogue,
      format,
      entry: source.entry,
      name: planned.name,
      params,
      operations,
    })
  const base = { name: planned.name, relativePath, absolutePath, reused: planned.reused }
  const extra = operationsNamed(source, planned.extra)
  if (extra.length === 0)
    return { ...base, content: onDisk ?? render([]), changed: onDisk === undefined }
  const id = write.library.catalogue.libraryEntryId(source.entry)
  return withOperations({ format, id, base, onDisk, source, params, render }, extra)
}

/** Every library fragment the import writes or keeps, in connection order. */
export const planLibraryFragments = async (
  configPath: string,
  format: RootFormat,
  write: LibraryWrite | undefined
): Promise<readonly PlannedFragment[]> =>
  write === undefined
    ? []
    : Promise.all(
        write.connections.map(async (planned) => planFragment(configPath, format, write, planned))
      )

/** The `$ref` a root gains for each new fragment: `./library/connection/<name>.yaml`. */
export const fragmentRefs = (
  fragments: readonly PlannedFragment[]
): readonly { readonly name: string; readonly path: string }[] =>
  fragments
    .filter((fragment) => !fragment.reused)
    .map((fragment) => ({ name: fragment.name, path: `./${fragment.relativePath}` }))

/** The line a TypeScript root's author pastes for each new fragment, as `library add` prints it. */
export const fragmentImportLines = (fragments: readonly PlannedFragment[]): readonly string[] =>
  fragments
    .filter((fragment) => !fragment.reused)
    .map((fragment) => {
      const binding = bindingName(fragment.name)
      const module = `./${fragment.relativePath.replace(/\.ts$/, '')}`
      return `import ${binding} from '${module}'  // then add ${binding} to connections`
    })

/**
 * Write each changed fragment. One being rewritten is written only if it still
 * holds the bytes the plan was made from.
 */
export const writeFragments = async (
  fragments: readonly PlannedFragment[],
  writeIfChanged: (
    path: string,
    content: string
  ) => Promise<{ readonly path: string; readonly changed: boolean }>
): Promise<readonly { readonly path: string; readonly changed: boolean }[]> =>
  Promise.all(
    fragments
      .filter((fragment) => fragment.changed)
      .map(async (fragment) => {
        if (fragment.expectedDigest !== undefined) {
          const current = await readIfExists(fragment.absolutePath)
          if (current === undefined || digest(current) !== fragment.expectedDigest)
            return refuse(
              `Error: ${fragment.relativePath} changed on disk while the import ran, so it was not rewritten.\n\n` +
                '  Run the import again.'
            )
        }
        await mkdir(dirname(fragment.absolutePath), { recursive: true })
        return writeIfChanged(fragment.absolutePath, fragment.content)
      })
  )

const PROVENANCE = /^(?:#|\/\/) sovrium-library: connection\/([a-z][a-z0-9-]*)@/

/**
 * The connections the config already holds, by name, each marked with its
 * library slug when it is a library fragment: `library/connection/<name>` beside
 * the config, whose provenance line names `connection/<slug>`.
 */
export const readExistingConnections = async (
  configPath: string,
  parsed: unknown
): Promise<(name: string) => ExistingConnection | undefined> => {
  const listed = (parsed as { readonly connections?: unknown } | undefined)?.connections
  const names = (Array.isArray(listed) ? listed : []).flatMap((entry: unknown) => {
    const name = (entry as { readonly name?: unknown } | null)?.name
    return typeof name === 'string' ? [name] : []
  })
  const held = await Promise.all(
    names.map(async (name) => {
      const texts = await Promise.all(
        ['yaml', 'ts'].map(async (extension) =>
          readIfExists(join(dirname(configPath), 'library', 'connection', `${name}.${extension}`))
        )
      )
      const slug = texts
        .map((text) => PROVENANCE.exec(text?.split('\n', 1)[0] ?? '')?.[1])
        .find((found) => found !== undefined)
      return [name, slug === undefined ? {} : { library: slug }] as const
    })
  )
  const byName = new Map<string, ExistingConnection>(held)
  return (name) => byName.get(name)
}
