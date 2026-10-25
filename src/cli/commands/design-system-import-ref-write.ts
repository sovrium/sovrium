/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `sovrium design-system import --write` into a config assembled from `$ref`
 * partials: every changed value written in the one file that holds it.
 *
 * ─── DECIDED BEFORE A BYTE IS WRITTEN ──────────────────────────────────────
 *
 * The change is carried from the resolved config back to each file's raw tree
 * (`ref-write-back.ts`), and every refusal is decided first: a file several
 * places include that they would write two ways, a node moved from one file
 * into another, a file outside the config's folder, a file that cannot be
 * rendered without re-laying out what the change does not reach. Then the
 * whole config is judged as `sovrium validate` judges it, each candidate
 * standing in for the file it replaces, and read back to prove it resolves to
 * exactly the change. A dry run runs all of it and writes nothing, so it
 * refuses in the same words.
 *
 * ─── WRITTEN AS ONE CHANGE ─────────────────────────────────────────────────
 *
 * Every file goes through a temporary file beside it: all the temporary files
 * first, then the renames. A rename that fails puts back the bytes of every
 * file already renamed and names the file it could not write. A crash between
 * two renames can still leave the earlier files written; nothing here claims
 * more than the filesystem offers.
 */

import { chmod, rename, rm, stat, writeFile } from 'node:fs/promises'
import {
  canonicalJson,
  firstDifference,
  sameTree,
  valueAt,
  type Pointer,
} from '@/domain/kernel/config-parsing/ref-tree-compare'
import {
  jsonPointerOf,
  reachableFiles,
  resolveTrees,
  rewriteGraph,
  settleVisits,
  type SharedConflict,
  type Visit,
} from '@/domain/kernel/config-parsing/ref-write-back'
import { printStderr } from '@/infrastructure/logging/cli-output'
import { refuse } from './app-prelude'
import { changedBytes } from './design-system-import-pages-write'
import { displayFile, isOutsideFolder, type ConfigFiles } from './design-system-import-ref-owners'
import { renderRefFile } from './design-system-import-ref-render'
import { writeAtomically } from './design-system-import-write'
import { indented, judgeConfig } from './library-add-config'

/** One file a write changes: its path, its bytes before and after. */
export interface FileWrite {
  readonly path: string
  readonly before: string
  readonly after: string
}

/** What one write-through asks. */
export interface WriteThrough {
  readonly config: ConfigFiles
  /** The config as it resolves today. */
  readonly old: unknown
  /** The config as it is to resolve. */
  readonly next: unknown
  /** Whether the place of a visit takes part in judging a shared file. */
  readonly counts: (position: Pointer) => boolean
  /** Visits judged beside the change's own: the boards of pages `--page` left out. */
  readonly extraVisits?: readonly Visit[] | undefined
  /** How a position is named in a refusal: the page it lies on, say. */
  readonly placeOf: (position: Pointer) => string
  /** The refusal when the result does not validate, its findings appended. */
  readonly invalid: string
}

/** What a write-through came to: the files it writes, and its notes. */
export interface PlannedWrites {
  readonly writes: readonly FileWrite[]
  readonly notes: readonly string[]
}

const quoted = (value: unknown): string => JSON.stringify(value) ?? 'nothing'

/** The refusal of a file several places include and would write two ways. */
const conflictRefusal = (input: WriteThrough, conflict: SharedConflict): never => {
  const [first, second] = conflict.variants
  const at = firstDifference(first?.tree, second?.tree) ?? []
  const lines = conflict.variants.flatMap((variant) =>
    variant.positions.map(
      (position) =>
        `  ${input.placeOf(position)} draws ${jsonPointerOf(at) || 'the file'} as ${quoted(valueAt(variant.tree, at))}`
    )
  )
  return refuse(
    `Error: ${displayFile(input.config.configPath, conflict.file)} is included in more than one place, and they draw it differently, so nothing was written.\n\n` +
      `${lines.join('\n')}\n\n  Draw it the same on every board, then run the import again.`
  )
}

/** Refuse a node moved out of one file into another: two files' structure at once. */
const refuseCrossFileMove = (
  input: WriteThrough,
  rewritten: ReturnType<typeof rewriteGraph>
): void => {
  const moved = rewritten.added.find((addition) =>
    rewritten.removed.some((loss) => loss.value === addition.value && loss.file !== addition.file)
  )
  if (moved === undefined) return
  const from = rewritten.removed.find((loss) => loss.value === moved.value)?.file ?? ''
  const name = (path: string) => displayFile(input.config.configPath, path)
  refuse(
    `Error: A node moves from ${name(from)} into ${name(moved.file)}, which rewrites two files at once and changes every other place including them, so nothing was written.\n\n` +
      '  Move it by hand in both files, then run the import again.'
  )
}

/** Each changed file's new raw tree, every refusal of the rewrite decided. */
const newTrees = (input: WriteThrough) => {
  const { config } = input
  const rewritten = rewriteGraph(config.graph, input.old, input.next)
  refuseCrossFileMove(input, rewritten)
  const settled = settleVisits(
    [
      ...rewritten.visits.filter((visit) => input.counts(visit.position)),
      ...(input.extraVisits ?? []),
    ],
    () => true
  )
  const [conflict] = settled.conflicts
  if (conflict !== undefined) conflictRefusal(input, conflict)
  const trees = new Map(settled.trees).set(config.graph.root, rewritten.tree)
  const changed = [...trees].filter(([path, tree]) => !sameTree(config.graph.trees.get(path), tree))
  return { changed, dropped: rewritten.dropped, trees }
}

/** The notes of a write: an include taken out whose file nothing names any more. */
const notesOf = (
  input: WriteThrough,
  dropped: readonly string[],
  trees: ReadonlyMap<string, unknown>
): readonly string[] => {
  const reached = reachableFiles(
    input.config.graph,
    new Map([...input.config.graph.trees, ...trees])
  )
  return [...new Set(dropped)]
    .filter((path) => !reached.has(path))
    .map(
      (path) =>
        `Note: ${displayFile(input.config.configPath, path)} is no longer included anywhere; it was kept, delete it if it is not needed.`
    )
}

/**
 * Decide every file a write-through changes, refusing before anything is
 * written. A dry run calls it too, and writes nothing.
 *
 * @param input - the config, the change, and how to judge and name it.
 */
export const planWriteThrough = async (input: WriteThrough): Promise<PlannedWrites> => {
  const { config } = input
  const { changed, dropped, trees } = newTrees(input)
  const outside = await Promise.all(
    changed.map(async ([path]) =>
      (await isOutsideFolder(config.configPath, path)) ? path : undefined
    )
  )
  const escaped = outside.find((path) => path !== undefined)
  if (escaped !== undefined) {
    const spelled = config.files.get(escaped)?.spelledAs ?? escaped
    refuse(
      `Error: The change writes into ${spelled}, which is outside the config's folder, so nothing was written.\n\n` +
        '  The import writes only inside the folder holding the config. Make the change in that file by hand, or include a copy of it from inside the folder.'
    )
  }
  const writes = changed.map(([path, tree]) => {
    const file = config.files.get(path)
    const after =
      file === undefined ? undefined : renderRefFile(file, tree, path === config.graph.root)
    return file === undefined || after === undefined
      ? refuse(
          `Error: ${displayFile(config.configPath, path)} could not be patched in place, so nothing was written.\n\n` +
            '  Write it as plain block YAML or JSON, or copy the dry-run changes into it by hand.'
        )
      : { path, before: file.text, after }
  })
  const judged = await judgeConfig(
    config.configPath,
    new Map(writes.map((write) => [write.path, write.after] as const))
  )
  if (judged.errors.length > 0) refuse(`${input.invalid}\n\n${indented(judged.errors)}`)
  // What the files will resolve to: the change itself, unless boards `--page`
  // left out took part, whose pages then follow the shared files they agreed on.
  const expected =
    (input.extraVisits ?? []).length === 0
      ? input.next
      : resolveTrees(config.graph, new Map([...config.graph.trees, ...trees]))
  if (canonicalJson(judged.parsed) !== canonicalJson(expected)) {
    refuse(
      `Error: The files of "${config.configPath}" could not be patched in place, so nothing was written.\n\n` +
        '  Copy the dry-run changes into the files the report names.'
    )
  }
  return {
    writes: writes.filter((write) => write.after !== write.before),
    notes: notesOf(input, dropped, trees),
  }
}

/** The filesystem calls a commit makes, injectable so a failed rename can be tested. */
export interface CommitFs {
  readonly writeFile: typeof writeFile
  readonly rename: typeof rename
  readonly rm: typeof rm
  readonly stat: typeof stat
  readonly chmod: typeof chmod
  readonly restore: (path: string, content: string) => Promise<void>
}

const NODE_FS: CommitFs = { writeFile, rename, rm, stat, chmod, restore: writeAtomically }

const tempOf = (path: string, index: number): string =>
  `${path}.${Date.now().toString(36)}${index}${Math.random().toString(36).slice(2, 8)}.tmp`

/**
 * Write every file as one change: each temporary file first, created with the
 * permission bits of the file it replaces, then each rename. A failed rename
 * restores the files already renamed and fails naming the file.
 *
 * @param writes - the files to write.
 * @param fs - the filesystem calls, for tests.
 */
export const commitWrites = async (
  writes: readonly FileWrite[],
  fs: CommitFs = NODE_FS
): Promise<void> => {
  const staged = await writes.reduce<Promise<readonly (FileWrite & { readonly temp: string })[]>>(
    async (previous, write, index) => {
      const acc = await previous
      const temp = tempOf(write.path, index)
      const mode = await fs.stat(write.path).then(
        (found) => found.mode & 0o777,
        // No file there yet: the new one takes the default mode of a new file.
        () => undefined
      )
      try {
        await fs.writeFile(
          temp,
          write.after,
          mode === undefined ? 'utf-8' : { encoding: 'utf-8', mode }
        )
        if (mode !== undefined) await fs.chmod(temp, mode)
      } catch (error) {
        await Promise.all(
          [...acc.map((done) => done.temp), temp].map((path) => fs.rm(path, { force: true }))
        )
        throw error
      }
      return [...acc, { ...write, temp }]
    },
    Promise.resolve([])
  )
  await staged.reduce<Promise<readonly FileWrite[]>>(async (previous, write) => {
    const renamed = await previous
    try {
      await fs.rename(write.temp, write.path)
    } catch (error) {
      await Promise.all(
        staged
          .filter((other) => !renamed.includes(other))
          .map((other) => fs.rm(other.temp, { force: true }))
      )
      await Promise.all(renamed.map((done) => fs.restore(done.path, done.before)))
      throw new Error(`Could not write ${write.path}; the files already written were put back.`, {
        cause: error,
      })
    }
    return [...renamed, write]
  }, Promise.resolve([]))
}

/** What a write-through wrote, as the reports record it. */
export interface WrittenThrough {
  readonly config: string
  readonly bytes: number
  readonly files?: readonly { readonly file: string; readonly bytes: number }[]
}

/**
 * Plan, then (unless `dryRun`) commit, a write-through; the notes go to stderr.
 *
 * @param input - the config, the change, and how to judge and name it.
 * @param dryRun - decide every refusal, write nothing.
 */
export const writeThrough = async (
  input: WriteThrough,
  dryRun: boolean
): Promise<WrittenThrough> => {
  const planned = await planWriteThrough(input)
  if (dryRun) return { config: input.config.configPath, bytes: 0 }
  try {
    await commitWrites(planned.writes)
  } catch (error) {
    return refuse(`Error: ${error instanceof Error ? error.message : String(error)}`)
  }
  planned.notes.forEach((note) => printStderr(note))
  const files = planned.writes.map((write) => ({
    file: displayFile(input.config.configPath, write.path),
    bytes: changedBytes(write.before, write.after),
  }))
  return {
    config: input.config.configPath,
    bytes: files.reduce((sum, file) => sum + file.bytes, 0),
    ...(files.length === 0 ? {} : { files }),
  }
}
