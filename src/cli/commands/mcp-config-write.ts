/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The eight-bound write pipeline of [internal ref] A8 surface 10 — the I/O half of the
 * four stdio config tools.
 *
 * `src/application/use-cases/config/config-mcp-tools.ts` owns the tool
 * DEFINITIONS and the dispatch, and may perform no I/O; everything here opens a
 * file, a `$ref` graph, a snapshot directory or a database, so everything here
 * arrives there injected as {@link ConfigWriteOperations}.
 *
 * ### The gauntlet, and why it runs in this order
 *
 * Every write takes the same ordered path, and each step's refusal names what it
 * refused and why. The cheap structural refusals come first, and the ones that
 * open a database come last — an AI that mistyped a path should not wait on a
 * migration planner to be told so.
 *
 * 1. **The path jail** — inside the project directory, `.yaml`/`.yml`/`.json`
 * only, no symlink, never `.git/` `[internal ref]` `.env*` the data directory or
 *    `.sovrium-template.json`. All of it in `mcp-config-write-guards.ts`.
 * 2. **`expectedSha`** — the caller states the digest of the bytes it based its
 *    edit on. This is the bound that makes concurrent human editing SAFE rather
 *    than lucky: without it, an operator saving in their own editor loses the
 *    save to whatever the AI was holding.
 * 3. **Decode before write** — the candidate is overlaid in memory onto the
 *    resolved graph and the WHOLE app is decoded. An invalid config never
 *    reaches the disk; the findings come back instead.
 * 4. **No new `$ref` out of the jail** — free, in the resolver, so a candidate
 *    that reaches out of the project throws during step 3.
 * 5. **Migration pre-flight** — only where a server is actually running. A
 *    change the live database would refuse is refused BEFORE the file changes,
 *    rather than after the server has already stopped trying to apply it.
 * 6. **`acknowledgeDataLoss`** — required when the candidate INTRODUCES
 *    `allowDestructive: true`, and this module never sets that flag itself.
 * 7. **Implicit field ids** — a mid-array insert into a table whose ids are
 *    positional renumbers every field after it.
 * 8. **Snapshot, then an atomic write** — the PRE-write state is recorded so
 *    `_config_undo` has somewhere to go, and the bytes land via temp + rename,
 *    which the config watcher treats as a change.
 *
 * @see [internal ref] (A8)
 */

import { createHash } from 'node:crypto'
import { rename, writeFile } from 'node:fs/promises'
import { dirname, relative, resolve } from 'node:path'
import { CONFIG_TOOL_INVALID_PARAMS } from '@/application/use-cases/config/config-mcp-tools'
import { messageAsConfigFinding } from '@/domain/models/app/app-excess-property-report'
import { findIntroducedDestructiveTables } from '@/domain/models/app/tables/destructive-change-validation'
import {
  IMPLICIT_FIELD_ID_TOKEN,
  findImplicitFieldIdShifts,
} from '@/domain/models/app/tables/implicit-field-id-validation'
import {
  findRestorableSnapshot,
  restoreSnapshot,
  snapshotConfigGraphIfChanged,
} from './config-snapshot-history'
import { loadConfigGraph } from './mcp-config-graph'
import {
  isTargetRefusal,
  locateInProject,
  refuseProtectedOrNonConfig,
  refuseSymlink,
} from './mcp-config-write-guards'
import type { LoadedMcpGraph } from './mcp-config-graph'
import type { LocatedTarget } from './mcp-config-write-guards'
import type {
  ConfigFileEntry,
  ConfigToolOutcome,
  ConfigWriteOperations,
  ConfigWriteRequest,
} from '@/application/use-cases/config/config-mcp-tools'
import type { App } from '@/domain/models/app'

/** What the stdio verb knows and this module needs. */
export interface ConfigWriteContext {
  /** Namespaces the tool names the reload hint points at. */
  readonly appName: string
  /** The jail. Always a directory somebody named on purpose — see `mcp.ts`. */
  readonly projectDir: string
  /** The config graph's root file, inside {@link projectDir}. */
  readonly configPath: string
}

// ---------------------------------------------------------------------------
// Small shared pieces
// ---------------------------------------------------------------------------

const digest = (content: string): string =>
  createHash('sha256').update(content, 'utf-8').digest('hex')

const refusal = (message: string, data?: unknown): ConfigToolOutcome => ({
  kind: 'refused',
  code: CONFIG_TOOL_INVALID_PARAMS,
  message,
  ...(data === undefined ? {} : { data }),
})

const readOrEmpty = async (path: string): Promise<string> =>
  Bun.file(path)
    .text()
    .catch(() => '')

const describe = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

/** Bound 1, all four questions, in the order the guards module explains. */
const locateWritable = async (
  projectDir: string,
  path: string
): Promise<LocatedTarget | ConfigToolOutcome> => {
  const located = locateInProject(projectDir, path)
  if (isTargetRefusal(located)) return refusal(located.refused)
  const blocked = refuseProtectedOrNonConfig(located) ?? (await refuseSymlink(located))
  return blocked === undefined ? located : refusal(blocked.refused)
}

const isRefusal = (value: LocatedTarget | ConfigToolOutcome): value is ConfigToolOutcome =>
  'kind' in value

// ---------------------------------------------------------------------------
// The two readers
// ---------------------------------------------------------------------------

/**
 * Every file of the graph, or the root alone when the graph will not load.
 *
 * The fallback matters more than it looks: a config that no longer resolves is
 * exactly the state an AI is asked to repair, and a listing that went empty
 * there would leave it with no file to read and no name to write.
 */
const graphFiles = async (context: Readonly<ConfigWriteContext>): Promise<ReadonlyArray<string>> =>
  loadConfigGraph(context.configPath)
    .then((graph) => graph.files)
    .catch(() => [resolve(context.configPath)])

const listConfigFiles = async (
  context: Readonly<ConfigWriteContext>
): Promise<ReadonlyArray<ConfigFileEntry>> => {
  const files = await graphFiles(context)
  const entries = await Promise.all(
    files.map(async (file): Promise<ReadonlyArray<ConfigFileEntry>> => {
      const content = await Bun.file(file)
        .text()
        .catch(() => undefined)
      if (content === undefined) return []
      return [
        {
          // PROJECT-RELATIVE. An absolute path would leak the operator's home
          // directory into every listing, and is the wrong thing to hand
          // straight back to `_config_write_file`.
          path: relative(context.projectDir, file),
          sha256: digest(content),
          bytes: Buffer.byteLength(content, 'utf-8'),
        },
      ]
    })
  )
  return entries.flat()
}

const readConfigFile = async (
  context: Readonly<ConfigWriteContext>,
  path: string
): Promise<ConfigToolOutcome> => {
  const located = await locateWritable(context.projectDir, path)
  if (isRefusal(located)) return located
  const content = await Bun.file(located.absolutePath)
    .text()
    .catch(() => undefined)
  if (content === undefined) {
    return refusal(
      `Refused: ${located.relativePath} could not be read. Call \`_config_list_files\` for the ` +
        `files this config is actually made of.`
    )
  }
  return {
    kind: 'result',
    payload: { path: located.relativePath, content, sha256: digest(content) },
  }
}

// ---------------------------------------------------------------------------
// Bound 2 — the lost-update guard
// ---------------------------------------------------------------------------

const refuseStaleSha = (
  target: Readonly<LocatedTarget>,
  current: string,
  expectedSha: string
): ConfigToolOutcome | undefined => {
  const actual = digest(current)
  if (actual === expectedSha.trim().toLowerCase()) return undefined
  return refusal(
    `Refused: ${target.relativePath} has changed on disk since it was read. Its sha256 is now ` +
      `${actual}, and this write carried ${expectedSha}. Someone — possibly the operator, in ` +
      `their own editor — saved over it. Re-read the file with \`_config_read_file\` and apply ` +
      `the edit to the bytes it returns.`
  )
}

// ---------------------------------------------------------------------------
// Bounds 3 to 7 — everything decided before a byte moves
// ---------------------------------------------------------------------------

/** The verdict on a candidate, plus the graph a snapshot would record. */
interface Judgement {
  readonly refusal?: ConfigToolOutcome
  /**
   * The graph as it stands on disk, when it loaded.
   *
   * Absent when the config is currently broken — in which case there is nothing
   * coherent to snapshot and nothing to diff the candidate against. The write
   * still goes ahead: refusing to repair a broken config would be the worst
   * possible moment to withhold the tool.
   */
  readonly before?: LoadedMcpGraph | undefined
}

/**
 * The findings of the sweeps `sovrium validate` runs AFTER the decode.
 *
 * `runPostDecodeChecks` is that command's own, imported rather than mirrored: a
 * candidate that decodes and would then refuse to boot must not reach the disk,
 * and two copies of that rule would be free to disagree about which configs are
 * safe. The same reasoning already makes `_config_validate` import it.
 */
const postDecodeRefusal = async (
  decoded: Readonly<{ readonly raw: unknown; readonly app: App }>,
  refSources: ReadonlyMap<string, string>
): Promise<ConfigToolOutcome | undefined> => {
  const { runPostDecodeChecks } = await import('./validate')
  const errors = await runPostDecodeChecks(decoded, refSources)
  if (errors.length === 0) return undefined
  return refusal(`Refused: ${errors[0] ?? 'the candidate would not boot.'}`, {
    findings: errors.map((error) => messageAsConfigFinding(error)),
  })
}

/** Whether an instance is actually serving — the gate bound 5 hangs on. */
const isServerRunning = async (): Promise<boolean> => {
  const { readLockFile, isProcessRunning } = await import('@/infrastructure/server/lock-file')
  const lock = await readLockFile()
  return lock !== undefined && isProcessRunning(lock.pid)
}

/**
 * Bound 5 — what the LIVE database would refuse.
 *
 * Skipped entirely when nothing is running, because there is no live database
 * to ask and a planner run against a file that does not exist yet would report
 * every table as new. `planDatabaseRefusals` is itself the CLI's sanctioned
 * database seam (`cli-database` in `[internal ref]`).
 *
 * ## An UNANSWERABLE planner does not refuse a write, and that differs on purpose
 *
 * The `--watch` pre-flight refuses one (`reload-preflight.ts`), because there it is
 * deciding whether to STOP a live listener and the rollback from a failed restart
 * would meet the same unreadable database. Here the decision is only whether to
 * touch a FILE: nothing is torn down, the running instance keeps serving whatever
 * it already loaded, and the operator's reload afterwards meets that pre-flight —
 * which now refuses on the safe side of the stop. So a planner that could not
 * answer has refused nothing, and turning that into a refusal here would strand an
 * edit on an obstruction the write itself cannot hit.
 */
const preflightRefusal = async (app: App): Promise<ConfigToolOutcome | undefined> => {
  if (!(await isServerRunning())) return undefined
  const { planDatabaseRefusals } = await import('./app-prelude')
  const planned = await planDatabaseRefusals(app)
  if (planned.kind === 'unanswerable') return undefined
  const { refusals } = planned
  if (refusals.length === 0) return undefined
  return refusal(
    `Refused: the database this app is running against would reject this change, so the file ` +
      `has been left alone.\n${refusals.join('\n')}`
  )
}

/** Bound 6 — the operator's decision, never the assistant's. */
const destructiveRefusal = (
  before: unknown,
  candidate: unknown,
  acknowledged: boolean
): ConfigToolOutcome | undefined => {
  const introduced = findIntroducedDestructiveTables(before, candidate)
  if (introduced.length === 0 || acknowledged) return undefined
  return refusal(
    `Refused: this change introduces \`allowDestructive: true\` on ${introduced.join(', ')}. ` +
      `That flag lets a migration DROP the columns of fields you removed, and the data in them ` +
      `is deleted permanently — it cannot be recovered from the config. It is the operator's ` +
      `call, never the assistant's: ask them, and re-send with \`acknowledgeDataLoss: true\` ` +
      `only if they say yes.`
  )
}

/** Bound 7 — an insert that silently renumbers a table's positional ids. */
const fieldIdRefusal = (before: unknown, candidate: unknown): ConfigToolOutcome | undefined => {
  const shifted = findImplicitFieldIdShifts(before, candidate)
  if (shifted.length === 0) return undefined
  return refusal(
    `Refused: ${IMPLICIT_FIELD_ID_TOKEN} — table ${shifted.join(', ')} has fields that declare ` +
      `no \`id\`, so each id is the field's POSITION in the list. This change moves at least ` +
      `one of them, which renumbers every field after it and re-points the data behind them. ` +
      `Give every field an explicit id first, keeping the numbers they have today, and then ` +
      `insert.`
  )
}

const judgeCandidate = async (
  context: Readonly<ConfigWriteContext>,
  target: Readonly<LocatedTarget>,
  request: Readonly<ConfigWriteRequest>
): Promise<Judgement> => {
  const before = await loadConfigGraph(context.configPath).catch(() => undefined)
  const overlay = (absolutePath: string): string | undefined =>
    absolutePath === target.absolutePath ? request.content : undefined

  const candidate = await loadConfigGraph(context.configPath, overlay).catch((error: unknown) => ({
    failure: describe(error),
  }))
  // Bound 4 arrives here: the `$ref` jail lives in the resolver, so a candidate
  // reaching out of the project directory throws and is reported verbatim.
  if ('failure' in candidate) return { refusal: refusal(`Refused: ${candidate.failure}`), before }

  const { decodeAppConfigObject } = await import('@/application/use-cases/config/decode-app-config')
  const decoded = decodeAppConfigObject(candidate.parsed, { refSources: candidate.refSources })
  if (!decoded.valid) {
    return {
      refusal: refusal(
        `Refused: the candidate does not decode as part of this app — ` +
          `${decoded.errors[0] ?? 'see findings'}`,
        { findings: decoded.findings }
      ),
      before,
    }
  }

  const blocked =
    (await postDecodeRefusal(decoded, candidate.refSources)) ??
    (await preflightRefusal(decoded.app)) ??
    destructiveRefusal(before?.parsed, candidate.parsed, request.acknowledgeDataLoss) ??
    fieldIdRefusal(before?.parsed, candidate.parsed)

  return blocked === undefined ? { before } : { refusal: blocked, before }
}

// ---------------------------------------------------------------------------
// Bound 8 — the snapshot and the write
// ---------------------------------------------------------------------------

/**
 * Write via temp file + rename.
 *
 * The rename is atomic on every filesystem this ships to, so a reader — the
 * config watcher, a second tool call, the operator's editor — never observes a
 * half-written config. The temp file is named beside its target rather than in
 * `/tmp`, because a rename across filesystems is a copy and stops being atomic.
 */
const writeAtomically = async (absolutePath: string, content: string): Promise<void> => {
  const temp = `${absolutePath}.${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}.tmp`

  await writeFile(temp, content, 'utf-8')
  return rename(temp, absolutePath)
}

const writeConfigFile = async (
  context: Readonly<ConfigWriteContext>,
  request: Readonly<ConfigWriteRequest>
): Promise<ConfigToolOutcome> => {
  const located = await locateWritable(context.projectDir, request.path)
  if (isRefusal(located)) return located

  const stale = refuseStaleSha(
    located,
    await readOrEmpty(located.absolutePath),
    request.expectedSha
  )
  if (stale !== undefined) return stale

  const judged = await judgeCandidate(context, located, request)
  if (judged.refusal !== undefined) return judged.refusal

  // BEFORE the rename, because the snapshot's whole job is to hold the bytes
  // this write is about to replace.
  const snapshot =
    judged.before === undefined
      ? undefined
      : await snapshotConfigGraphIfChanged(
          context.configPath,
          judged.before.files,
          judged.before.configHash
        )

  await writeAtomically(located.absolutePath, request.content)

  return {
    kind: 'result',
    payload: {
      path: located.relativePath,
      // The digest of what was just written, which is the `expectedSha` for the
      // caller's NEXT write. That round trip is what makes bound 2 usable.
      sha256: digest(request.content),
      ...(snapshot === undefined ? {} : { snapshot }),
      // Points at `_config_status` rather than claiming the change is live: the
      // write puts bytes on disk, and whether an instance TOOK them is a
      // different question with a different answer.
      //
      // It names `seq` and `lastReload`, and deliberately NOT `configHash`.
      // `resolveConfigAnchor` (`src/cli/commands/utils.ts`) hashes the config's
      // ROOT FILE alone, so an edit to a `$ref` partial — the case this surface
      // mostly serves — leaves that hash identical, and a hint pointing at it
      // would send an AI to poll a value that cannot move.
      reloadHint:
        `The bytes are on disk. Whether a running instance TOOK them is a separate question: ` +
        `call \`${context.appName}_config_status\` and watch \`seq\` advance while ` +
        `\`lastReload\` reports the verdict, or start an instance with ` +
        `\`sovrium start --watch\`.`,
    },
  }
}

// ---------------------------------------------------------------------------
// Undo
// ---------------------------------------------------------------------------

const undoLastWrite = async (context: Readonly<ConfigWriteContext>): Promise<ConfigToolOutcome> => {
  const rootDir = dirname(resolve(context.configPath))
  const snapshot = await findRestorableSnapshot(rootDir)
  if (snapshot === undefined) {
    return refusal(
      `Nothing to undo: no snapshot in the history differs from what is on disk. The config is ` +
        `already the most recent state this project recorded.`
    )
  }

  await restoreSnapshot(rootDir, snapshot)
  return { kind: 'result', payload: { snapshot: snapshot.name, files: snapshot.files } }
}

// ---------------------------------------------------------------------------

/**
 * Bind the four operations to one project.
 *
 * Called from `src/cli/commands/mcp.ts` and nowhere else, and only when
 * `MCP_CONFIG_WRITE` is set AND the project directory was named explicitly.
 *
 * @public
 */
export const buildConfigWriteOperations = (
  context: Readonly<ConfigWriteContext>
): ConfigWriteOperations => ({
  listFiles: async () => listConfigFiles(context),
  readFile: async (path) => readConfigFile(context, path),
  writeFile: async (request) => writeConfigFile(context, request),
  undo: async () => undoLastWrite(context),
})
