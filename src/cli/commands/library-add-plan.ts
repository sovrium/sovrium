/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `sovrium library add <id>` — the PLANNING half: every refusal, and the list
 * of files an install would write. `library-add.ts` executes the plan.
 *
 * ─── THE ORDER IS THE CONTRACT ──────────────────────────────────────────────
 *
 * Every refusal happens before the first byte is written, cheapest first:
 *
 * 1. **Parameters** — an unknown `--set` key or a required one left unset.
 * 2. **The config** — `--into` must stay inside the working directory (checked
 *    before the file is read), and with no `--into` a config must be found.
 * 3. **The config as it is** — it has to decode BEFORE the change. An edit
 *    cannot be judged against a config that was already broken, and reporting
 *    the existing problem is more useful than a verdict about the wrong thing.
 * 4. **The files it would write** — an installed fragment whose bytes differ
 *    was edited by the operator and is never overwritten; a name the config
 *    already defines is refused unless `--as` picks another.
 * 5. **The config as it would be** — the candidate root and every new fragment
 *    are overlaid in memory onto the resolved graph and the WHOLE app is
 *    decoded, the same judgement the config MCP's write tool makes.
 *
 * Only then are files written, and the root last, guarded by the SHA-256 of the
 * bytes read in step 3: a config that changed on disk in between is left alone
 * and the line to add is printed instead.
 *
 * ─── WHAT IS NEVER TOUCHED ──────────────────────────────────────────────────
 *
 * `app.ts` (Phase 1 prints the lines to paste), `.env` (only the NAMES of the
 * variables an entry reads are appended to `.env.example`), and anything outside
 * the working directory.
 */

import { createHash } from 'node:crypto'
import { realpath } from 'node:fs/promises'
import { basename, dirname, join, resolve } from 'node:path'
import { detectFormat } from '@/domain/kernel/config-parsing/format-detection'
import { isPathWithin } from '@/domain/models/process-env/desktop'
import { printStderr } from '@/infrastructure/logging/cli-output'
import { planOperationFragment } from './library-add-operations'
import { bindingName, provenanceHeader, renderTsFragment, renderYamlFragment } from './library-wire'
import { loadConfigGraph } from './mcp-config-graph'
import { lazyImportSchema } from './utils'
import { validateParsedConfig } from './validate'
import type { OperationsRequest, PlannedOperations } from './library-add-operations'
import type { ConnectionOperation } from '@/domain/models/app/connections/operations'
import type {
  LibraryCatalogueApi,
  LibraryEntry,
  LibraryParamValue,
  LibraryTargetKey,
} from '@/library/manifest/define'

export interface LibraryAddRequest {
  readonly catalogue: LibraryCatalogueApi
  readonly entries: readonly LibraryEntry[]
  readonly entry: LibraryEntry
  readonly sets: readonly string[]
  readonly as?: string
  readonly into?: string
  readonly dryRun: boolean
  readonly noWire: boolean
  readonly version: string
  /**
   * API operations to declare on the connection being installed — set only by
   * `library add <provider>/<operation>`, `--tag` and `--all`, where `entry`
   * is that provider's connection.
   */
  readonly operations?: OperationsRequest
}

export type RootFormat = 'yaml' | 'json' | 'typescript'

/** One file `add` would write, and where it is wired. */
export interface PlannedInstall {
  readonly id: string
  readonly entry: LibraryEntry
  readonly name: string
  readonly key: LibraryTargetKey
  /** `library/<kind>/<name>.<ext>`, relative to the config's directory. */
  readonly relativePath: string
  readonly absolutePath: string
  readonly content: string
  /** The identical file is already on disk. */
  readonly present: boolean
  /** The entry that pulled this one in, for a requirement. */
  readonly requiredBy?: string
  /** For an operation install, what happens to the connection's `operations`. */
  readonly operations?: PlannedOperations
  /**
   * The SHA-256 of the fragment as read, when the install REWRITES an existing
   * fragment: the write is skipped if the file changed on disk in between.
   */
  readonly expectedDigest?: string
}

/** What the config says, judged. */
interface JudgedConfig {
  readonly parsed: unknown
  readonly errors: readonly string[]
}

const ITEM_NOUN: Readonly<Record<LibraryTargetKey, string>> = {
  components: 'component',
  connections: 'connection',
  automations: 'automation',
}

const KEBAB = /^[a-z][a-z0-9-]*$/

/** Stop with a refusal on stderr and exit 1. */
export const refuse = (message: string): never => {
  printStderr(message)
  // eslint-disable-next-line functional/no-expression-statements
  process.exit(1)
}

export const out = (lines: readonly string[]): void => {
  // eslint-disable-next-line functional/no-expression-statements
  process.stdout.write(`${lines.join('\n')}\n`)
}

export const digest = (content: string): string =>
  createHash('sha256').update(content, 'utf-8').digest('hex')

export const readIfExists = async (path: string): Promise<string | undefined> =>
  (await Bun.file(path).exists()) ? Bun.file(path).text() : undefined

// =============================================================================
// 1. Parameters
// =============================================================================

const parseParamValue = (
  entryId: string,
  param: LibraryEntry['params'][number],
  raw: string
): LibraryParamValue => {
  if (param.type === 'string') return raw
  const value = Number(raw)
  return Number.isFinite(value) && raw.trim() !== ''
    ? value
    : refuse(`Error: ${entryId} expects a number for "${param.name}", got "${raw}".`)
}

/** `--set` pairs, validated against what the entry declares. */
export const resolveParams = (
  entryId: string,
  entry: LibraryEntry,
  sets: readonly string[]
): Readonly<Record<string, LibraryParamValue | undefined>> => {
  const accepted = entry.params.map((param) => param.name)
  const given = new Map(
    sets.map((pair) => {
      const cut = pair.indexOf('=')
      return cut <= 0
        ? refuse(`Error: --set expects key=value, got "${pair}".`)
        : ([pair.slice(0, cut), pair.slice(cut + 1)] as const)
    })
  )
  const unknown = [...given.keys()].find((key) => !accepted.includes(key))
  if (unknown !== undefined)
    return refuse(
      `Error: ${entryId} has no parameter "${unknown}".\n\n` +
        `  Accepted parameters: ${accepted.length === 0 ? 'none' : accepted.join(', ')}.`
    )
  const missing = entry.params.find((param) => param.required === true && !given.has(param.name))
  if (missing !== undefined)
    return refuse(
      `Error: ${entryId} needs the required parameter "${missing.name}" — ${missing.description}\n\n` +
        `  Set it with --set ${missing.name}=<value>.`
    )
  return Object.fromEntries(
    entry.params.map((param) => {
      const raw = given.get(param.name)
      return [param.name, raw === undefined ? param.default : parseParamValue(entryId, param, raw)]
    })
  )
}

// =============================================================================
// 2. The config
// =============================================================================

/** `--into`, contained in the working directory — symlinks included. */
const resolveInto = async (cwd: string, into: string): Promise<string> => {
  const outside = (): never =>
    refuse(
      `Error: --into "${into}" resolves outside the working directory.\n\n` +
        `  library add only writes inside ${cwd}. Run it from the project directory instead.`
    )
  const candidate = resolve(cwd, into)
  if (!isPathWithin(cwd, candidate)) return outside()
  if (!(await Bun.file(candidate).exists())) return refuse(`Error: No config file at "${into}".`)
  return isPathWithin(await realpath(cwd), await realpath(candidate)) ? candidate : outside()
}

export const findConfig = async (cwd: string, into: string | undefined): Promise<string> => {
  if (into !== undefined) return resolveInto(cwd, into)
  const { discoverDefaultConfigFile } = await lazyImportSchema()
  const discovered = await discoverDefaultConfigFile(cwd)
  return discovered === undefined
    ? refuse(
        `Error: No app config found in ${cwd}.\n\n` +
          '  library add installs into an app config (app.yaml, app.yml or app.ts).\n' +
          '  Create one with `sovrium init`, or name one with --into <config>.'
      )
    : resolve(cwd, discovered)
}

export const rootFormatOf = (configPath: string): RootFormat => {
  const format = detectFormat(configPath)
  return format === 'unsupported'
    ? refuse('Error: Unsupported config format. Supported: .yaml, .yml, .json, .ts.')
    : format
}

/** Load the graph (optionally with stand-in bytes) and decode it, never throwing. */
export const judgeConfig = async (
  configPath: string,
  overlay?: ReadonlyMap<string, string>
): Promise<JudgedConfig> => {
  try {
    const graph = await loadConfigGraph(
      configPath,
      overlay === undefined ? undefined : (path) => overlay.get(path)
    )
    const outcome = await validateParsedConfig(graph.parsed, graph.refSources)
    return { parsed: graph.parsed, errors: outcome.errors }
  } catch (error) {
    return {
      parsed: undefined,
      errors: [`Failed to parse file: ${error instanceof Error ? error.message : String(error)}`],
    }
  }
}

export const indented = (errors: readonly string[]): string =>
  errors.map((e) => `  ${e}`).join('\n')

/** The names the config already gives the items under `key`. */
const definedNames = (parsed: unknown, key: LibraryTargetKey): ReadonlySet<string> => {
  const items = (parsed as Readonly<Record<string, unknown>> | undefined)?.[key]
  return new Set(
    Array.isArray(items)
      ? items.flatMap((item: unknown) => {
          const name = (item as { readonly name?: unknown } | null)?.name
          return typeof name === 'string' ? [name] : []
        })
      : []
  )
}

// =============================================================================
// 3. The files it would write
// =============================================================================

export interface InstallContext {
  readonly request: LibraryAddRequest
  readonly configPath: string
  readonly format: RootFormat
  readonly parsed: unknown
}

/** Every requirement of `entry`, depth-first, each once, dependencies first. */
const requirementsOf = (
  context: InstallContext,
  entry: LibraryEntry,
  seen: ReadonlySet<string>
): readonly LibraryEntry[] =>
  entry.requires
    .filter((id) => !seen.has(id))
    .flatMap((id) => {
      const required = context.request.entries.find(
        (candidate) => context.request.catalogue.libraryEntryId(candidate) === id
      )
      return required === undefined
        ? refuse(`Error: The library entry requires "${id}", which this binary does not ship.`)
        : [...requirementsOf(context, required, new Set([...seen, id])), required]
    })

const buildContent = (
  context: InstallContext,
  entry: LibraryEntry,
  { name, params }: InstallTarget,
  operations: readonly ConnectionOperation[] = []
): string => {
  const header = provenanceHeader(
    context.request.catalogue.libraryEntryId(entry),
    context.request.version
  )
  const built = entry.build({ name, params }) as Readonly<Record<string, unknown>>
  const fragment: unknown = operations.length === 0 ? built : { ...built, operations }
  return context.format === 'typescript'
    ? renderTsFragment(header, bindingName(name), fragment)
    : renderYamlFragment(header, fragment)
}

/** The name and parameters one install is built with. */
interface InstallTarget {
  readonly name: string
  readonly params: Readonly<Record<string, LibraryParamValue | undefined>>
  readonly requiredBy?: string
}

/** Where one install lands. */
type InstallBase = Pick<
  PlannedInstall,
  'id' | 'entry' | 'name' | 'key' | 'relativePath' | 'absolutePath'
>

/** The connection an operation install declares its operations on. */
const planOperationInstall = (
  context: InstallContext,
  target: InstallTarget,
  base: InstallBase,
  onDisk: string | undefined
): PlannedInstall => {
  const { operations, entry } = context.request
  return {
    ...base,
    ...planOperationFragment({
      format: context.format,
      id: base.id,
      relativePath: base.relativePath,
      onDisk,
      requested: operations?.requested ?? [],
      known: operations?.known ?? [],
      ...(onDisk === undefined && definedNames(context.parsed, base.key).has(target.name)
        ? {
            takenBy: `${basename(context.configPath)} already defines a connection named "${target.name}" outside the library`,
          }
        : {}),
      render: (declared) => buildContent(context, entry, target, declared),
    }),
  }
}

/** Whether this install is the connection an operation install declares its operations on. */
const declaresOperationsOn = (context: InstallContext, entry: LibraryEntry): boolean =>
  context.request.operations !== undefined && entry === context.request.entry

/** Plan one install, refusing an edited fragment and a name collision. */
const planOne = async (
  context: InstallContext,
  entry: LibraryEntry,
  target: InstallTarget
): Promise<PlannedInstall | undefined> => {
  const { catalogue } = context.request
  const id = catalogue.libraryEntryId(entry)
  const key = catalogue.LIBRARY_TARGET_KEY[entry.kind]
  const extension = context.format === 'typescript' ? 'ts' : 'yaml'
  const relativePath = `library/${entry.kind}/${target.name}.${extension}`
  const absolutePath = join(dirname(context.configPath), relativePath)
  const onDisk = await readIfExists(absolutePath)
  if (declaresOperationsOn(context, entry))
    return planOperationInstall(
      context,
      target,
      { id, entry, name: target.name, key, relativePath, absolutePath },
      onDisk
    )
  const content = buildContent(context, entry, target)

  if (onDisk !== undefined && onDisk !== content)
    return refuse(
      `Error: ${relativePath} already exists and differs from what ${id} would write.\n\n` +
        '  It was edited after it was installed, and library add never overwrites an edit.\n' +
        '  Keep it, or move it aside and run the command again.'
    )
  const taken = onDisk === undefined && definedNames(context.parsed, key).has(target.name)
  if (taken && target.requiredBy !== undefined) return undefined // already present: satisfied
  if (taken)
    return refuse(
      `Error: ${basename(context.configPath)} already defines a ${ITEM_NOUN[key]} named "${target.name}".\n\n` +
        `  Install ${id} under another name with --as <name>, e.g.\n` +
        `  sovrium library add ${id} --as ${target.name}-2`
    )
  return {
    id,
    entry,
    name: target.name,
    key,
    relativePath,
    absolutePath,
    content,
    present: onDisk !== undefined,
    ...(target.requiredBy === undefined ? {} : { requiredBy: target.requiredBy }),
  }
}

/** The tables the config defines, each with the names of its fields. */
const definedTables = (parsed: unknown): ReadonlyMap<string, ReadonlySet<string>> => {
  const tables = (parsed as Readonly<Record<string, unknown>> | undefined)?.['tables']
  return new Map(
    Array.isArray(tables)
      ? tables.flatMap((table: unknown) => {
          const { name, fields } = (table ?? {}) as {
            readonly name?: unknown
            readonly fields?: unknown
          }
          if (typeof name !== 'string') return []
          const fieldNames = Array.isArray(fields)
            ? fields.flatMap((field: unknown) => {
                const fieldName = (field as { readonly name?: unknown } | null)?.name
                return typeof fieldName === 'string' ? [fieldName] : []
              })
            : []
          return [[name, new Set(fieldNames)] as const]
        })
      : []
  )
}

/**
 * Why the entry cannot install — a table, or a field of one, that the config
 * does not define — or `undefined`. Checked before anything is written. An
 * entry binds to the operator's OWN table and never creates one, so
 * the refusal names the table, every field it reads with its type, and the
 * `--set` that points the entry at a table the operator already has.
 */
const missingTablesMessage = (
  context: InstallContext,
  entryId: string,
  params: Readonly<Record<string, LibraryParamValue | undefined>>
): string | undefined => {
  const defined = definedTables(context.parsed)
  const expected = context.request.catalogue.expectedTables(context.request.entry, params)
  const problems = expected.flatMap((table) => {
    const fields = defined.get(table.table)
    const missing =
      fields === undefined ? table.fields : table.fields.filter((field) => !fields.has(field.name))
    return missing.length === 0 ? [] : [{ table, fields, missing }]
  })
  const [first] = problems
  if (first === undefined) return undefined
  const configName = basename(context.configPath)
  const fieldList = first.missing.map((field) => `${field.name} (${field.type})`).join(', ')
  return (
    (first.fields === undefined
      ? `Error: ${entryId} reads the table "${first.table.table}", which ${configName} does not define.\n\n` +
        `  It expects these fields: ${fieldList}.\n` +
        `  Point it at one of your tables with --set ${first.table.param}=<table>, or add the table first.`
      : `Error: ${entryId} reads ${fieldList} from the table "${first.table.table}", which ${configName} defines without ${first.missing.length === 1 ? 'that field' : 'those fields'}.\n\n` +
        `  Add the missing field${first.missing.length === 1 ? '' : 's'} to "${first.table.table}", or point the entry at other fields with --set.`) +
    '\n  Nothing was written.'
  )
}

export const planInstalls = async (context: InstallContext): Promise<readonly PlannedInstall[]> => {
  const { request } = context
  const primaryId = request.catalogue.libraryEntryId(request.entry)
  const params = resolveParams(primaryId, request.entry, request.sets)
  const tablesProblem = missingTablesMessage(context, primaryId, params)
  if (tablesProblem !== undefined) return refuse(tablesProblem)
  const name = request.as ?? request.entry.slug
  if (!KEBAB.test(name))
    return refuse(
      `Error: --as "${name}" is not a kebab-case name (lowercase letters, digits, "-").`
    )

  const requirements = requirementsOf(context, request.entry, new Set([primaryId]))
  const planned = await Promise.all([
    ...requirements.map(async (required) =>
      planOne(context, required, {
        name: required.slug,
        params: resolveParams(request.catalogue.libraryEntryId(required), required, []),
        requiredBy: primaryId,
      })
    ),
    planOne(context, request.entry, { name, params }),
  ])
  return planned.filter((install): install is PlannedInstall => install !== undefined)
}
