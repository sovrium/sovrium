/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `sovrium docs --export <dir> [--force]` — the manual, written as a docs site.
 *
 * A documentation site that lives in its own repository has only the released
 * binary, so the binary has to be able to write the site's article tree
 * itself. What it writes is byte-identical to the tree this repository's own
 * site is built from, because both are rendered by `renderSiteArticles`.
 *
 * ─── NOTHING IS WRITTEN UNTIL EVERYTHING IS RENDERED ────────────────────────
 *
 * The directory is checked, then the whole export is rendered in memory, and
 * only then does anything touch the disk. A refused or failed run therefore
 * leaves the target exactly as it found it — a half-written tree is a state
 * neither the previous export nor this one produced.
 *
 * ─── `--force` REPLACES WHAT THE EXPORT OWNS ────────────────────────────────
 *
 * Ownership is the previous export's own `_nav.json` `files` list. Clearing
 * the directory would delete the articles a site authors beside the exported
 * ones; overwriting without deleting would leave a renamed article served
 * forever. The manifest is the only record of what an export wrote, so it
 * alone decides what may be removed.
 *
 * ─── LOADED LAZILY ──────────────────────────────────────────────────────────
 *
 * Like the rest of the `docs` verb, the payload and the renderer are reached
 * through `await import()`, so a server boot never pays for them.
 */

import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { Data, Effect } from 'effect'
import type { ExportFile } from '@/application/use-cases/admin/docs-site-export'

/** The outcome of an export: a notice on success, a reason on refusal. */
export type DocsExportResult =
  | { readonly kind: 'written'; readonly notice: string }
  | { readonly kind: 'refused'; readonly reason: string }

const refused = (reason: string): DocsExportResult => ({ kind: 'refused', reason })

/** What sits at the target path before anything is written. */
type TargetState =
  | { readonly kind: 'missing' }
  | { readonly kind: 'not-a-directory' }
  | { readonly kind: 'directory'; readonly entries: readonly string[] }

const inspectTarget = async (dir: string): Promise<TargetState> => {
  try {
    const info = await stat(dir)
    return info.isDirectory()
      ? { kind: 'directory', entries: await readdir(dir) }
      : { kind: 'not-a-directory' }
  } catch {
    return { kind: 'missing' }
  }
}

/** A file the export could not remove or write. */
class DocsExportWriteError extends Data.TaggedError('DocsExportWriteError')<{
  readonly cause: unknown
}> {}

/**
 * How many files are removed or written at once. Bounds open file handles;
 * the export is a few hundred small files, so speed is not the concern.
 */
const WRITE_CONCURRENCY = 16

/** Apply `task` to every item, at most {@link WRITE_CONCURRENCY} at a time. */
const inBoundedParallel = <T>(
  items: readonly T[],
  task: (item: T) => Promise<unknown>
): Promise<unknown> =>
  Effect.runPromise(
    Effect.forEach(
      items,
      (item) =>
        Effect.tryPromise({
          try: () => task(item),
          catch: (cause) => new DocsExportWriteError({ cause }),
        }),
      { concurrency: WRITE_CONCURRENCY, discard: true }
    )
  )

/**
 * The files a previous export recorded as its own, read from its manifest.
 *
 * Only plain file names are honoured — a `files` entry carrying a path
 * separator or a parent reference names something outside the tree the export
 * wrote, and a manifest is a file anyone can edit. A missing or unreadable
 * manifest owns nothing, so `--force` then only overwrites what it writes.
 */
const previouslyOwned = async (dir: string): Promise<readonly string[]> => {
  const { EXPORT_MANIFEST_FILE, ownedExportFiles } =
    await import('@/application/use-cases/admin/docs-site-export')
  try {
    return ownedExportFiles(JSON.parse(await readFile(join(dir, EXPORT_MANIFEST_FILE), 'utf8')))
  } catch {
    return []
  }
}

/** Render the whole export in memory, from the embedded payload. */
const renderExport = async (engine: string): Promise<readonly ExportFile[]> => {
  const [{ SECTIONS }, payload, { renderDocsExport }] = await Promise.all([
    import('@/docs/sections'),
    import('@/infrastructure/assets/embedded-docs'),
    import('@/application/use-cases/admin/docs-site-export'),
  ])
  return Effect.runPromise(
    renderDocsExport({
      sections: SECTIONS,
      payload: {
        readFragment: payload.readEmbeddedDoc,
        behaviourFor: payload.embeddedBehaviourFor,
      },
      engine,
    })
  )
}

/**
 * Export the manual into `target`.
 *
 * @param target - The directory to write into; created with its parents.
 * @param force - Replace a previous export's files rather than refusing.
 * @param engine - The version string the manifest records.
 */
export const exportDocs = async (input: {
  readonly target: string
  readonly force: boolean
  readonly engine: string
}): Promise<DocsExportResult> => {
  const dir = resolve(input.target)
  const state = await inspectTarget(dir)
  if (state.kind === 'not-a-directory') {
    return refused(`Error: --export target ${input.target} exists and is not a directory.`)
  }
  if (state.kind === 'directory' && state.entries.length > 0 && !input.force) {
    return refused(
      `Error: ${input.target} is not empty.\n\n` +
        `  --export writes into an empty directory, or replaces a previous export with --force.\n` +
        `  --force removes only the files the previous export's _nav.json lists, then writes;\n` +
        `  anything else in the directory is left untouched.`
    )
  }

  const { EXPORT_MANIFEST_FILE } = await import('@/application/use-cases/admin/docs-site-export')
  const files = await renderExport(input.engine)
  const owned = input.force ? await previouslyOwned(dir) : []

  // eslint-disable-next-line functional/no-expression-statements -- the write phase IS the side effect
  await mkdir(dir, { recursive: true })
    .then(() => inBoundedParallel(owned, (name) => rm(join(dir, name), { force: true })))
    .then(() => inBoundedParallel(files, (file) => writeFile(join(dir, file.file), file.content)))

  return {
    kind: 'written',
    notice: `Exported ${files.length - 1} article(s) and ${EXPORT_MANIFEST_FILE} to ${input.target}.`,
  }
}
