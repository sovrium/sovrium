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
import { basename, dirname, join } from 'node:path'
import { refuse } from './app-prelude'
import { definedNames } from './library-add-config'
import { planBlockForms } from './library-add-forms'
import { entryEnvFor, renderEntryFragment } from './library-add-fragment'
import { planOperationFragment } from './library-add-operations'
import { defaultParams, requirementParams, resolveParams } from './library-add-params'
import { asOf, editedMessage, placementOf, reinstallOf, updateSets } from './library-add-reinstall'
import { missingTablesMessage } from './library-add-tables'
import type { RootFormat } from './library-add-config'
import type { OperationsRequest, PlannedOperations } from './library-add-operations'
import type { Replaced } from './library-add-reinstall'
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
  /** `--update`: replace the installed fragment with what this version writes, edited or not. */
  readonly update?: boolean
  /**
   * API operations to declare on the connection being installed — set only by
   * `library add <provider>/<operation>`, `--tag` and `--all`, where `entry`
   * is that provider's connection.
   */
  readonly operations?: OperationsRequest
}

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
  /**
   * The variables it reads, under the names it writes: a connection installed
   * under another name reads its own secrets (`entryEnvFor`).
   */
  readonly env: readonly string[]
  /** The entry that pulled this one in, for a requirement. */
  readonly requiredBy?: string
  /** For an operation install, what happens to the connection's `operations`. */
  readonly operations?: PlannedOperations
  /**
   * The SHA-256 of the fragment as read, when the install REWRITES an existing
   * fragment: the write is skipped if the file changed on disk in between.
   */
  readonly expectedDigest?: string
  /** A rewrite with new parameters: each change, `successPath /sign-in → /`. */
  readonly updated?: readonly string[]
  /** A fragment `--update` replaces, and what it carried. */
  readonly replaced?: Replaced
  /** A requirement's parameters and where each came from, for the line announcing it. */
  readonly paramsNote?: string
}

const ITEM_NOUN: Readonly<Record<LibraryTargetKey, string>> = {
  components: 'component',
  connections: 'connection',
  automations: 'automation',
  forms: 'form',
}

const KEBAB = /^[a-z][a-z0-9-]*$/

export const out = (lines: readonly string[]): void => {
  process.stdout.write(`${lines.join('\n')}\n`)
}

export const digest = (content: string): string =>
  createHash('sha256').update(content, 'utf-8').digest('hex')

export const readIfExists = async (path: string): Promise<string | undefined> =>
  (await Bun.file(path).exists()) ? Bun.file(path).text() : undefined

// =============================================================================
// 3. The files it would write (2, the config, is judged in `library-add-config.ts`)
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
  {
    operations = [],
    recordParams = true,
  }: { readonly operations?: readonly ConnectionOperation[]; readonly recordParams?: boolean } = {}
): string =>
  renderEntryFragment({
    catalogue: context.request.catalogue,
    version: context.request.version,
    format: context.format,
    entry,
    name,
    params,
    operations,
    recordParams,
  })

/** The name and parameters one install is built with. */
interface InstallTarget {
  readonly name: string
  readonly params: Readonly<Record<string, LibraryParamValue | undefined>>
  readonly requiredBy?: string
  readonly paramsNote?: string
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
    env: entryEnvFor({ entry, name: target.name, params: target.params }),
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
      render: (declared) => buildContent(context, entry, target, { operations: declared }),
    }),
  }
}

/** Whether this install is the connection an operation install declares its operations on. */
const declaresOperationsOn = (context: InstallContext, entry: LibraryEntry): boolean =>
  context.request.operations !== undefined && entry === context.request.entry

/** The fragment `target` writes, and what writing it over `onDisk` would do. */
const reinstallFor = (
  context: InstallContext,
  entry: LibraryEntry,
  target: InstallTarget,
  onDisk: string | undefined
) => {
  const content = buildContent(context, entry, target)
  const verdict = reinstallOf({
    entry,
    onDisk,
    content,
    params: target.params,
    defaults: defaultParams(entry, context.parsed),
    render: (params, recordParams) =>
      buildContent(context, entry, { ...target, params }, { recordParams }),
  })
  return { content, verdict }
}

/** Where `entry` installed as `name` lands — `library/<kind>/<name>.<ext>` — and what is there. */
const fragmentAt = async (context: InstallContext, entry: LibraryEntry, name: string) => {
  const relativePath = `library/${entry.kind}/${name}.${context.format === 'typescript' ? 'ts' : 'yaml'}`
  const absolutePath = join(dirname(context.configPath), relativePath)
  return { relativePath, absolutePath, onDisk: await readIfExists(absolutePath) }
}

/**
 * The running version when `--update` replaces this install's fragment: the
 * requested entry's own, never a requirement's.
 */
const replaceWithFor = (context: InstallContext, target: InstallTarget): string | undefined =>
  context.request.update === true && target.requiredBy === undefined
    ? context.request.version
    : undefined

/** Plan one install, refusing an edited fragment unless `--update`, and a name collision. */
const planOne = async (
  context: InstallContext,
  entry: LibraryEntry,
  target: InstallTarget
): Promise<PlannedInstall | undefined> => {
  const { catalogue } = context.request
  const id = catalogue.libraryEntryId(entry)
  const key = catalogue.LIBRARY_TARGET_KEY[entry.kind]
  const { relativePath, absolutePath, onDisk } = await fragmentAt(context, entry, target.name)
  const replaceWith = replaceWithFor(context, target)
  if (declaresOperationsOn(context, entry))
    return planOperationInstall(
      context,
      target,
      { id, entry, name: target.name, key, relativePath, absolutePath },
      onDisk
    )
  const { content, verdict } = reinstallFor(context, entry, target, onDisk)
  if (verdict.kind === 'edited' && replaceWith === undefined)
    return refuse(editedMessage(relativePath, id, verdict.against, asOf(entry, target.name)))
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
    env: entryEnvFor({ entry, name: target.name, params: target.params }),
    ...placementOf(verdict, onDisk, content, replaceWith),
    ...(target.requiredBy === undefined ? {} : { requiredBy: target.requiredBy }),
    ...(target.paramsNote === undefined ? {} : { paramsNote: target.paramsNote }),
  }
}

/** The forms a block ships beside its component, or a refusal — see `library-add-forms.ts`. */
const planForms = async (
  context: InstallContext,
  entry: LibraryEntry,
  target: InstallTarget
): Promise<readonly PlannedInstall[]> => {
  const planned = await planBlockForms({
    catalogue: context.request.catalogue,
    version: context.request.version,
    ...(context.request.update === true ? { update: true } : {}),
    format: context.format,
    configPath: context.configPath,
    takenNames: definedNames(context.parsed, 'forms'),
    parsed: context.parsed,
    entry,
    target,
  })
  return typeof planned === 'string' ? refuse(planned) : planned
}

export const planInstalls = async (context: InstallContext): Promise<readonly PlannedInstall[]> => {
  const { request } = context
  const primaryId = request.catalogue.libraryEntryId(request.entry)
  const name = request.as ?? request.entry.slug
  if (!KEBAB.test(name))
    return refuse(
      `Error: --as "${name}" is not a kebab-case name (lowercase letters, digits, "-").`
    )
  // `--update` keeps the parameters the fragment records, each `--set` overriding its own.
  const sets =
    request.update === true
      ? updateSets(
          request.entry,
          (await fragmentAt(context, request.entry, name)).onDisk,
          request.sets
        )
      : request.sets
  const params = resolveParams(primaryId, request.entry, sets, context.parsed)
  const tablesProblem = missingTablesMessage({
    parsed: context.parsed,
    configPath: context.configPath,
    entryId: primaryId,
    expected: request.catalogue.expectedTables(request.entry, params),
  })
  if (tablesProblem !== undefined) return refuse(tablesProblem)

  const requirements = requirementsOf(context, request.entry, new Set([primaryId]))
  const primary = { name, params }
  // A block's forms are planned before it, so the primary install stays last.
  const planned = await Promise.all([
    ...requirements.map(async (required) => {
      const resolved = requirementParams({
        requiredId: request.catalogue.libraryEntryId(required),
        required,
        requested: request.entry,
        sets: request.sets,
        parsed: context.parsed,
      })
      return planOne(context, required, {
        name: required.slug,
        params: resolved.values,
        requiredBy: primaryId,
        ...(resolved.note === '' ? {} : { paramsNote: resolved.note }),
      })
    }),
    planForms(context, request.entry, primary),
    planOne(context, request.entry, primary),
  ])
  return planned
    .flatMap((install) => (Array.isArray(install) ? install : [install]))
    .filter((install): install is PlannedInstall => install !== undefined)
}
