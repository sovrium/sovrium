/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `sovrium import --write` — writing a planned migration, and nothing else
 * ([internal ref] A14, bound 4).
 *
 * - **A YAML config** gains each new entry at the end of its key's block
 *   sequence, as text: every other byte — comments, quoting, order — stays
 *   where it was. A JSON config keeps its other keys and layout. The patched
 *   bytes are judged as `sovrium validate` judges them before they land.
 * - **A TypeScript config is never edited**: each entry goes to a sidecar
 *   (`tables/<name>.table.json`, `automations/<name>.automation.json`,
 *   `pages/<name>.page.json` laid out as a page import lays it out, …) and
 *   the report prints the import lines to paste.
 * - **Library connections** are written as `sovrium library add` writes them:
 *   a fragment under `library/connection/`, wired by one `$ref`, its env names
 *   appended to `.env.example` (`import-write-library.ts`).
 * - **Seed files** go to `seed/import/`, attachments to `seed/import/assets/`,
 *   and `seed/import/` is added to `.gitignore`: they hold the operator's real
 *   records, which have no place in a repository.
 *
 * Every file is written through a temp file and a rename, and only when its
 * bytes change: a re-run of the same import writes nothing.
 */

import { copyFile, mkdir } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import {
  SEED_IMPORT_DIR,
  renderSeedJsonl,
  type SeedAssetCopy,
  type SeedPlan,
} from '@/domain/models/import/seed-emission-service'
import { isSnapshotFilePath } from '@/domain/models/import/snapshot-manifest'
import { refuse } from './app-prelude'
import { formatPageSidecar } from './design-system-import-pages-write'
import { writeAtomically } from './design-system-import-write'
import {
  fragmentImportLines,
  fragmentRefs,
  planLibraryFragments,
  writeFragments,
  type LibraryWrite,
  type PlannedFragment,
} from './import-write-library'
import { indented, judgeConfig, type RootFormat } from './library-add-config'
import { planEnvExample } from './library-add-env'
import { planYamlAppend, refLine, renderYamlFragment } from './library-wire'
import type { ConfigAdditions } from './import-plan'
import type { ImportReport } from '@/domain/models/import/import-report'

type Written = NonNullable<ImportReport['written']>

/** What one file write did. */
interface FileOutcome {
  readonly path: string
  readonly changed: boolean
}

/** Write `content` unless the file already holds exactly it. */
export const writeIfChanged = async (path: string, content: string): Promise<FileOutcome> => {
  const file = Bun.file(path)
  const previous = (await file.exists()) ? await file.text() : undefined
  if (previous === content) return { path, changed: false }
  await mkdir(dirname(path), { recursive: true })
  await writeAtomically(path, content)
  return { path, changed: true }
}

/** A list entry of a YAML sequence, at an indentation. */
const yamlItem = (entry: unknown, indent: number): string =>
  renderYamlFragment([], [entry])
    .trimEnd()
    .split('\n')
    .map((line) => `${' '.repeat(indent)}${line}`)
    .join('\n')

const KEYS = ['tables', 'forms', 'connections', 'env', 'automations', 'pages'] as const

/** A `$ref` a root gains for a library fragment. */
type Ref = { readonly name: string; readonly path: string }

/** One item a key gains: an entry written in place, or a `$ref` line. */
interface Item {
  readonly name: string
  readonly yaml: (indent: number) => string
  readonly json: unknown
}

/** The items each key gains; `connections` mixes entries and `$ref`s, by name. */
const itemsOf = (key: (typeof KEYS)[number], additions: ConfigAdditions, refs: readonly Ref[]) => {
  const entries: readonly Item[] = additions[key].map((entry) => ({
    name: String(entry['name'] ?? ''),
    yaml: (indent) => yamlItem(entry, indent),
    json: entry,
  }))
  if (key !== 'connections' || refs.length === 0) return entries
  const wired: readonly Item[] = refs.map((ref) => ({
    name: ref.name,
    yaml: (indent) => refLine(indent, ref.path),
    json: { $ref: ref.path },
  }))
  return [...entries, ...wired].toSorted((left, right) => left.name.localeCompare(right.name))
}

/** The YAML root with every addition appended under its key. */
const patchYaml = (text: string, additions: ConfigAdditions, refs: readonly Ref[]): string =>
  KEYS.reduce(
    (current, key) =>
      itemsOf(key, additions, refs).reduce((acc, item) => {
        const plan = planYamlAppend(acc, key, item.yaml)
        return plan.kind === 'insert'
          ? plan.text
          : refuse(
              `Error: The import cannot add to \`${key}\` in the config in place (${plan.kind === 'unwirable' ? plan.reason : 'already present'}), so nothing was written.\n\n` +
                `  Write \`${key}:\` as a block sequence, or run the import with --json and copy the entries in.`
            )
      }, current),
    text
  )

const patchJson = (text: string, additions: ConfigAdditions, refs: readonly Ref[]): string => {
  const root = JSON.parse(text) as Readonly<Record<string, unknown>>
  const indent = /\n( +|\t)"/.exec(text)?.[1] ?? '  '
  const extended = Object.fromEntries(
    KEYS.map((key) => [key, itemsOf(key, additions, refs)] as const)
      .filter(([, items]) => items.length > 0)
      .map(([key, items]) => {
        const held = Array.isArray(root[key]) ? (root[key] as readonly unknown[]) : []
        return [key, [...held, ...items.map((item) => item.json)]]
      })
  )
  return `${JSON.stringify({ ...root, ...extended }, undefined, indent)}${text.endsWith('\n') ? '\n' : ''}`
}

const hasAdditions = (additions: ConfigAdditions, refs: readonly Ref[]): boolean =>
  refs.length > 0 || KEYS.some((key) => additions[key].length > 0)

/** Patch a YAML or JSON config, judged with its new fragments in place before it lands. */
const planConfig = async (
  configPath: string,
  format: 'yaml' | 'json',
  additions: ConfigAdditions,
  fragments: readonly PlannedFragment[]
): Promise<{ readonly write: () => Promise<FileOutcome> }> => {
  const text = await Bun.file(configPath).text()
  const refs = fragmentRefs(fragments)
  if (!hasAdditions(additions, refs))
    return { write: async () => ({ path: configPath, changed: false }) }
  const next =
    format === 'yaml' ? patchYaml(text, additions, refs) : patchJson(text, additions, refs)
  const overlay = new Map([
    [configPath, next],
    ...fragments.map((fragment) => [fragment.absolutePath, fragment.content] as const),
  ])
  const judged = await judgeConfig(configPath, overlay)
  if (judged.errors.length > 0) {
    return refuse(
      `Error: The patched config does not validate, so nothing was written.\n\n${indented(judged.errors)}`
    )
  }
  return { write: async () => writeIfChanged(configPath, next) }
}

const SIDECAR_FOLDERS: Readonly<Record<(typeof KEYS)[number], readonly [string, string]>> = {
  tables: ['tables', 'table'],
  forms: ['forms', 'form'],
  automations: ['automations', 'automation'],
  connections: ['connections', 'connection'],
  env: ['env', 'env'],
  pages: ['pages', 'page'],
}

/** `weekly-digest` → `weeklyDigest`: a binding a TypeScript import may use. */
const bindingOf = (name: string): string =>
  name.replace(/[-_]([a-z0-9])/g, (_match, next: string) => next.toUpperCase())

/** Write one sidecar per entry beside a TypeScript config. */
const writeSidecars = async (configPath: string, additions: ConfigAdditions) => {
  const root = dirname(configPath)
  const entries = KEYS.flatMap((key) =>
    additions[key].map((entry) => {
      const [folder, suffix] = SIDECAR_FOLDERS[key]
      const name = String(entry['name'] ?? entry['key'] ?? 'entry')
      const path = `${folder}/${name}.${suffix}.json`
      return { path, entry, line: `import ${bindingOf(name)} from './${path}'` }
    })
  )
  const outcomes = await Promise.all(
    entries.map(async (one) =>
      writeIfChanged(
        join(root, one.path),
        one.path.endsWith('.page.json')
          ? await formatPageSidecar(one.entry)
          : `${JSON.stringify(one.entry, undefined, 2)}\n`
      )
    )
  )
  return {
    sidecars: entries.map((one) => one.path),
    importLines: entries.map((one) => one.line),
    outcomes,
  }
}

/** Add an entry to the project `.gitignore`, creating it when missing. */
export const ensureGitignored = async (
  projectRoot: string,
  entry: string
): Promise<FileOutcome & { readonly added: boolean }> => {
  const path = join(projectRoot, '.gitignore')
  const file = Bun.file(path)
  const text = (await file.exists()) ? await file.text() : ''
  const lines = new Set(text.split(/\r?\n/).map((line) => line.trim()))
  if (lines.has(entry) || lines.has(entry.replace(/\/$/, '')))
    return { path, changed: false, added: false }
  const body = text === '' || text.endsWith('\n') ? text : `${text}\n`
  const written = await writeIfChanged(path, `${body}${entry}\n`)
  return { ...written, added: true }
}

/** Where the attachments come from: the snapshot's `assets/`, or bytes read from an export file. */
interface AssetSource {
  readonly snapshotRoot: string | undefined
  readonly assetBytes: ReadonlyMap<string, Uint8Array> | undefined
}

/**
 * Copy one attachment to its place under `seed/import/assets/`, unless it is
 * already there. Only a snapshot `assets/` file is ever copied: a reference the
 * source's data spelled with a path of its own is refused, so no file outside
 * the snapshot reaches the seed folder.
 */
const writeAsset = async (projectRoot: string, asset: SeedAssetCopy, from: AssetSource) => {
  const target = join(projectRoot, SEED_IMPORT_DIR, 'assets', asset.to)
  if (!isSnapshotFilePath(asset.from) || !asset.from.startsWith('assets/')) {
    return refuse(
      'Error: The snapshot names an attachment outside its assets/ folder, so nothing was written.\n\n' +
        '  Fetch the snapshot again with `sovrium import fetch`.'
    )
  }
  const bytes = from.assetBytes?.get(asset.from)
  if ((from.snapshotRoot === undefined && bytes === undefined) || (await Bun.file(target).exists()))
    return { path: target, changed: false }
  await mkdir(dirname(target), { recursive: true })
  if (bytes === undefined) await copyFile(join(from.snapshotRoot ?? '', asset.from), target)
  else await Bun.write(target, bytes)
  return { path: target, changed: true }
}

/** Write the seed files, the users file and the attachments under `seed/import/`. */
const writeSeed = async (projectRoot: string, seed: SeedPlan, from: AssetSource) => {
  const files = await Promise.all(
    seed.files.map((file) =>
      writeIfChanged(
        join(projectRoot, file.path),
        file.format === 'jsonl'
          ? renderSeedJsonl(file)
          : renderYamlFragment([], { mergeOn: file.mergeOn, records: file.records })
      )
    )
  )
  const users =
    seed.users.length === 0
      ? []
      : [
          await writeIfChanged(
            join(projectRoot, SEED_IMPORT_DIR, 'users.yaml'),
            renderYamlFragment([], {
              users: seed.users.map((user) => ({ ...user, role: 'member', unclaimed: true })),
            })
          ),
        ]
  const assets = await Promise.all(seed.assets.map((asset) => writeAsset(projectRoot, asset, from)))
  return { files, users, assets }
}

/**
 * The config half: the library fragments first, then the root patched in
 * place — or sidecars beside a TypeScript config, whose import lines are printed.
 */
const writeConfigHalf = async (
  configPath: string,
  format: RootFormat,
  additions: ConfigAdditions,
  library: LibraryWrite | undefined
): Promise<
  Pick<Written, 'config' | 'sidecars' | 'importLines'> & {
    readonly outcomes: readonly FileOutcome[]
  }
> => {
  const fragments = await planLibraryFragments(configPath, format, library)
  if (format === 'typescript') {
    const sidecars = await writeSidecars(configPath, additions)
    const written = await writeFragments(fragments, writeIfChanged)
    return {
      ...sidecars,
      importLines: [...fragmentImportLines(fragments), ...sidecars.importLines],
      outcomes: [...written, ...sidecars.outcomes],
    }
  }
  // Judged before anything is written; the fragments land before the root that wires them.
  const patched = await planConfig(configPath, format, additions, fragments)
  const written = await writeFragments(fragments, writeIfChanged)
  const config = await patched.write()
  return {
    config: relative(dirname(configPath), config.path),
    sidecars: [],
    importLines: [],
    outcomes: [...written, config],
  }
}

/** The `.env.example` names of the connections written, appended as `library add` appends them. */
const writeEnvExample = async (
  configPath: string,
  names: readonly string[]
): Promise<readonly FileOutcome[]> => {
  const plan = await planEnvExample(configPath, names)
  return plan.text === undefined ? [] : [await writeIfChanged(plan.path, plan.text)]
}

/** The data half: seed files, accounts, attachments, and the `.gitignore` line. */
const writeSeedHalf = async (
  projectRoot: string,
  seed: SeedPlan | undefined,
  from: AssetSource
): Promise<
  Pick<Written, 'seedFiles' | 'assets' | 'gitignore'> & {
    readonly outcomes: readonly FileOutcome[]
  }
> => {
  if (seed === undefined) return { seedFiles: [], assets: 0, gitignore: [], outcomes: [] }
  const written = await writeSeed(projectRoot, seed, from)
  const gitignore = await ensureGitignored(projectRoot, `${SEED_IMPORT_DIR}/`)
  return {
    seedFiles: seed.files.map((file) => file.path),
    assets: written.assets.length,
    gitignore: gitignore.added ? [`${SEED_IMPORT_DIR}/`] : [],
    outcomes: [...written.files, ...written.users, ...written.assets, gitignore],
  }
}

/** Write a planned migration; returns the report's `written` section. */
export const writeMigration = async (input: {
  readonly configPath: string
  readonly format: RootFormat
  readonly additions: ConfigAdditions
  readonly seed: SeedPlan | undefined
  readonly snapshotRoot: string | undefined
  /** Attachment bytes read from inside the export file, by asset path. */
  readonly assetBytes?: ReadonlyMap<string, Uint8Array>
  /** The library connections the automations use, written as `library add` writes them. */
  readonly library?: LibraryWrite
  /** The env names of every connection written, for `.env.example`. */
  readonly envNames?: readonly string[]
}): Promise<Omit<Written, 'applied'>> => {
  const { outcomes: written, ...config } = await writeConfigHalf(
    input.configPath,
    input.format,
    input.additions,
    input.library
  )
  const envOutcomes = await writeEnvExample(input.configPath, input.envNames ?? [])
  const configOutcomes = [...written, ...envOutcomes]
  const { outcomes: seedOutcomes, ...seed } = await writeSeedHalf(
    dirname(input.configPath),
    input.seed,
    { snapshotRoot: input.snapshotRoot, assetBytes: input.assetBytes }
  )
  return {
    ...config,
    ...seed,
    unchanged: [...configOutcomes, ...seedOutcomes].every((outcome) => !outcome.changed),
  }
}
