/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `sovrium library add <id>` — copy an entry into the operator's project and
 * wire it. The refusals and the plan live in `library-add-plan.ts`; this module
 * wires the plan into the root, judges the result, and writes.
 *
 * ─── ALL OR NOTHING FOR THE ROOT ────────────────────────────────────────────
 *
 * An install can wire several fragments — a recipe and the connection it
 * requires. If ANY of them cannot be placed with certainty, the root is left
 * exactly as it was and every line is printed for the operator to place: half a
 * wiring is harder to reason about than none.
 */

import { rename, writeFile, mkdir } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { undeclaredEnvMessage } from './library-add-env'
import {
  digest,
  findConfig,
  indented,
  judgeConfig,
  out,
  planInstalls,
  readIfExists,
  refuse,
  resolveParams,
  rootFormatOf,
} from './library-add-plan'
import { bindingName, libraryArticleAddress, planYamlWire, refLine } from './library-wire'
import type { LibraryAddRequest, PlannedInstall, RootFormat } from './library-add-plan'
import type { ConnectionOperation } from '@/domain/models/app/connections/operations'

/** A line the operator places by hand, and the key it goes under. */
interface ManualLine {
  readonly key: string
  readonly line: string
}

interface WiringPlan {
  /** The root's bytes after wiring — the input, when nothing is wired. */
  readonly text: string
  readonly added: readonly ManualLine[]
  readonly manual: readonly ManualLine[]
  /** Why the root was not edited, when it was not and should have been. */
  readonly reason?: string
}

interface EnvPlan {
  readonly path: string
  readonly added: readonly string[]
  readonly all: readonly string[]
  /** The new `.env.example`, or `undefined` when nothing is appended. */
  readonly text?: string
}

// =============================================================================
// Wiring
// =============================================================================

const refPathOf = (install: PlannedInstall): string => `./${install.relativePath}`

/** The line to paste for a root this command does not edit. */
const pasteLine = (install: PlannedInstall, format: RootFormat): ManualLine => {
  if (format === 'typescript') {
    const binding = bindingName(install.name)
    const module = `./${install.relativePath.replace(/\.ts$/, '')}`
    return {
      key: install.key,
      line: `import ${binding} from '${module}'  // then add ${binding} to ${install.key}`,
    }
  }
  if (format === 'json') return { key: install.key, line: `{ "$ref": "${refPathOf(install)}" }` }
  return { key: install.key, line: refLine(2, refPathOf(install)) }
}

/** Insert each install's line in turn, or none of them. */
const wireYaml = (rootText: string, installs: readonly PlannedInstall[]): WiringPlan => {
  const folded = installs.reduce<{
    readonly text: string
    readonly added: readonly ManualLine[]
    readonly reasons: readonly string[]
    readonly pending: readonly ManualLine[]
  }>(
    (state, install) => {
      const plan = planYamlWire(state.text, install.key, refPathOf(install))
      if (plan.kind === 'already-wired') return state
      const manual = { key: install.key, line: refLine(2, refPathOf(install)) }
      return plan.kind === 'insert'
        ? {
            ...state,
            text: plan.text,
            added: [...state.added, { key: install.key, line: plan.line }],
            pending: [...state.pending, manual],
          }
        : {
            ...state,
            reasons: [...state.reasons, plan.reason],
            pending: [...state.pending, manual],
          }
    },
    { text: rootText, added: [], reasons: [], pending: [] }
  )
  return folded.reasons.length === 0
    ? { text: folded.text, added: folded.added, manual: [] }
    : { text: rootText, added: [], manual: folded.pending, reason: folded.reasons.join('; ') }
}

const planWiring = (
  rootText: string,
  installs: readonly PlannedInstall[],
  format: RootFormat,
  noWire: boolean
): WiringPlan => {
  if (format === 'yaml' && !noWire) return wireYaml(rootText, installs)
  const unwired =
    format === 'yaml'
      ? installs.filter(
          (install) =>
            planYamlWire(rootText, install.key, refPathOf(install)).kind !== 'already-wired'
        )
      : installs
  return { text: rootText, added: [], manual: unwired.map((install) => pasteLine(install, format)) }
}

// =============================================================================
// Secrets
// =============================================================================

const declaredNames = (text: string): ReadonlySet<string> =>
  new Set(
    text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line !== '' && !line.startsWith('#'))
      .map((line) => line.split('=')[0]?.trim() ?? '')
  )

/** The variable NAMES to append to `.env.example` — never a value, never `.env`. */
const planEnv = async (
  configPath: string,
  installs: readonly PlannedInstall[]
): Promise<EnvPlan> => {
  const path = join(dirname(configPath), '.env.example')
  const all = [...new Set(installs.flatMap((install) => install.entry.env))]
  const existing = (await readIfExists(path)) ?? ''
  const declared = declaredNames(existing)
  const added = all.filter((name) => !declared.has(name))
  if (added.length === 0) return { path, added, all }
  const base = existing === '' || existing.endsWith('\n') ? existing : `${existing}\n`
  return { path, added, all, text: `${base}${added.map((name) => `${name}=`).join('\n')}\n` }
}

// =============================================================================
// Judging and writing
// =============================================================================

/** Refuse a candidate that would not decode, writing nothing. */
const confirmCandidate = async (
  configPath: string,
  wiring: WiringPlan,
  installs: readonly PlannedInstall[]
): Promise<void> => {
  const overlay = new Map([
    [configPath, wiring.text],
    ...installs.map((install) => [install.absolutePath, install.content] as const),
  ])
  const after = await judgeConfig(configPath, overlay)
  if (after.errors.length === 0) return
  return refuse(
    `Error: The install would leave ${basename(configPath)} invalid, so nothing was written.\n\n` +
      `${indented(after.errors)}\n\n` +
      `  To wire it by hand once the problem is fixed, add:\n` +
      indented(wiring.added.map((added) => `under ${added.key}:  ${added.line.trim()}`))
  )
}

/** Write through a temporary file and a rename, so no reader sees half a file. */
const writeAtomically = async (path: string, content: string): Promise<void> => {
  const temporary = `${path}.sovrium-library-${process.pid}.tmp`
  return writeFile(temporary, content, 'utf-8').then(async () => rename(temporary, path))
}

/**
 * One fragment, its directory created first. A fragment being REWRITTEN is
 * written only if it still holds the bytes the plan was made from.
 */
const writeFragment = async (install: PlannedInstall): Promise<void> => {
  if (install.expectedDigest !== undefined) {
    const current = await readIfExists(install.absolutePath)
    if (current === undefined || digest(current) !== install.expectedDigest)
      return refuse(
        `Error: ${install.relativePath} changed on disk while the command ran, so it was not rewritten.\n\n` +
          '  Run the command again.'
      )
    return writeAtomically(install.absolutePath, install.content)
  }
  return mkdir(dirname(install.absolutePath), { recursive: true }).then(async () =>
    writeFile(install.absolutePath, install.content, 'utf-8')
  )
}

/** Everything `execute` needs, in one object. */
interface Execution {
  readonly configPath: string
  readonly rootDigest: string
  readonly wiring: WiringPlan
  readonly installs: readonly PlannedInstall[]
  readonly env: EnvPlan
}

/**
 * Write every new fragment, the `.env.example` names, then the root — the root
 * only if it still holds the bytes the plan was made from.
 *
 * @returns whether the root was written.
 */
const execute = async ({
  configPath,
  rootDigest,
  wiring,
  installs,
  env,
}: Execution): Promise<boolean> => {
  // eslint-disable-next-line functional/no-expression-statements -- the writes ARE the command
  await Promise.all([
    ...installs
      .filter((install) => !install.present)
      .map(async (install) => writeFragment(install)),
    ...(env.text === undefined ? [] : [writeFile(env.path, env.text, 'utf-8')]),
  ])
  if (wiring.added.length === 0) return false
  const current = (await readIfExists(configPath)) ?? ''
  if (digest(current) !== rootDigest) return false
  return writeAtomically(configPath, wiring.text).then(() => true)
}

// =============================================================================
// Reporting
// =============================================================================

/** One operation as a report line: name, method, path. */
const operationLine = (operation: ConnectionOperation): string =>
  `  ${operation.name}  ${operation.method} ${operation.path}`

/** What an operation install does to its fragment, dry-run or not. */
const operationLines = (install: PlannedInstall, dryRun: boolean): readonly string[] => {
  const planned = install.operations
  if (planned === undefined) return []
  if (planned.paste !== undefined)
    return [
      `${planned.reason ?? `${install.relativePath} was not edited`}.`,
      `Add under \`operations\` in ${install.relativePath}:`,
      '',
      planned.paste,
      '',
    ]
  if (planned.added.length === 0) return []
  const count = `${planned.added.length} operation${planned.added.length === 1 ? '' : 's'}`
  return [
    `${dryRun ? 'Would declare' : 'Declared'} ${count} on ${install.relativePath}:`,
    ...planned.added.map(operationLine),
  ]
}

const manualLines = (configName: string, wiring: WiringPlan): readonly string[] =>
  wiring.manual.length === 0
    ? []
    : [
        ...(wiring.reason === undefined ? [] : [`${configName} was not edited: ${wiring.reason}.`]),
        `Add to ${configName} by hand:`,
        ...wiring.manual.map((manual) => `  under ${manual.key}:  ${manual.line.trim()}`),
      ]

const nextSteps = (installs: readonly PlannedInstall[], env: EnvPlan): readonly string[] => {
  const primary = installs.at(-1)
  return [
    ...(env.all.length === 0
      ? []
      : [`Next: set ${env.all.join(' and ')} in your environment (.env).`]),
    ...(primary === undefined ? [] : [`Read: sovrium docs ${libraryArticleAddress(primary.id)}`]),
  ]
}

const describeDryRun = (
  configName: string,
  installs: readonly PlannedInstall[],
  wiring: WiringPlan,
  env: EnvPlan
): readonly string[] => [
  ...installs.flatMap((install) => [
    install.present
      ? `Already installed: ${install.relativePath}`
      : `Would write ${install.relativePath}`,
    ...operationLines(install, true),
  ]),
  ...wiring.added.map(
    (added) => `Would add to ${configName} under ${added.key}:  ${added.line.trim()}`
  ),
  ...manualLines(configName, wiring),
  ...(env.added.length === 0 ? [] : [`Would append to .env.example: ${env.added.join(', ')}`]),
  'Nothing written (--dry-run).',
]

const describeInstall = (
  configName: string,
  { installs, wiring, env }: Execution,
  rootWritten: boolean
): readonly string[] => [
  ...installs.flatMap((install) => [
    install.present
      ? `Already installed: ${install.id} (${install.relativePath})`
      : `Wrote ${install.relativePath}${install.requiredBy === undefined ? '' : ` — ${install.id}, required by ${install.requiredBy}`}`,
    ...operationLines(install, false),
  ]),
  ...(rootWritten
    ? wiring.added.map((added) => `Wired ${added.key} in ${configName}:  ${added.line.trim()}`)
    : manualLines(
        configName,
        wiring.added.length === 0
          ? wiring
          : {
              text: wiring.text,
              added: [],
              manual: wiring.added,
              reason: `it changed on disk while the command ran`,
            }
      )),
  ...(env.added.length === 0 ? [] : [`Added to .env.example: ${env.added.join(', ')}`]),
  ...nextSteps(installs, env),
]

const nothingToDo = (
  installs: readonly PlannedInstall[],
  wiring: WiringPlan,
  env: EnvPlan
): boolean =>
  installs.every((install) => install.present && install.operations?.paste === undefined) &&
  wiring.added.length === 0 &&
  wiring.manual.length === 0 &&
  env.text === undefined

// =============================================================================
// The command
// =============================================================================

export type { LibraryAddRequest } from './library-add-plan'

/** Install one entry — and what it requires — into the working directory's config. */
export const runLibraryAdd = async (request: LibraryAddRequest): Promise<void> => {
  const primaryId = request.catalogue.libraryEntryId(request.entry)
  // Parameters are refused FIRST, before the config is even looked for; the
  // plan resolves them again from the same input.
  // eslint-disable-next-line functional/no-expression-statements
  resolveParams(primaryId, request.entry, request.sets)
  const configPath = await findConfig(process.cwd(), request.into)
  const format = rootFormatOf(configPath)
  const configName = basename(configPath)
  const rootText = await Bun.file(configPath).text()

  const before = await judgeConfig(configPath)
  if (before.errors.length > 0)
    return refuse(
      `Error: ${configName} does not validate, so library add cannot judge a change to it.\n` +
        '  Nothing was written. Fix these first — `sovrium validate` reports the same:\n\n' +
        indented(before.errors)
    )

  const installs = await planInstalls({ request, configPath, format, parsed: before.parsed })
  // An entry reading a variable the config does not declare would leave it
  // refusing to boot: refused before anything is written, naming the lines.
  const envProblem = undeclaredEnvMessage({
    entryId: primaryId,
    configName,
    format,
    parsed: before.parsed,
    reads: installs.flatMap((install) => install.entry.env),
  })
  if (envProblem !== undefined) return refuse(envProblem)
  const wiring = planWiring(rootText, installs, format, request.noWire)
  const env = await planEnv(configPath, installs)
  const rewrites = installs.some((install) => install.operations !== undefined && !install.present)
  if (wiring.added.length > 0 || rewrites) await confirmCandidate(configPath, wiring, installs)

  if (request.dryRun) return out(describeDryRun(configName, installs, wiring, env))
  if (nothingToDo(installs, wiring, env))
    return out([
      request.operations === undefined
        ? `${primaryId} is already installed and wired — nothing changed.`
        : `${request.operations.label} is already declared on ${primaryId} — nothing changed.`,
    ])

  const execution = { configPath, rootDigest: digest(rootText), wiring, installs, env }
  return out(describeInstall(configName, execution, await execute(execution)))
}
