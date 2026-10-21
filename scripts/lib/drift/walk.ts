/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * ONE directory walk, for the drift checks that need a corpus (SC6).
 *
 * Roughly twenty hand-rolled `readdirSync` recursions across twenty-five files
 * do the same four things in four slightly different ways: recurse, filter by
 * extension, skip `node_modules` and dotfiles, and — in about half of them —
 * swallow a `readdirSync` failure with a bare `catch { return [] }`. That last
 * one is the expensive difference: a walk that returns `[]` on a mistyped or
 * moved root satisfies every "no unlisted site" assertion perfectly, and the
 * gate reports clean over a corpus it never read.
 *
 * So this walk FAILS on an unreadable root and returns `[]` only for a
 * genuinely empty one, and callers pair it with {@link assertFloor} on the
 * count.
 *
 * ## Why this is a filesystem walk and not `git ls-files`
 *
 * A tracked-file walk would be strictly better: it honours `.gitignore` for
 * free and cannot pick up a build artefact. It is not what this module does,
 * because reading the git index means spawning `git`, and **SC2 makes
 * `lib/effect/command-service.ts` the only place in `scripts/` that starts a
 * child process**. A module imported by forty drift checks is the last place to
 * put an exception to that, and SC1 keeps those checks plain synchronous TS, so
 * they cannot reach the Effect service that would do it properly.
 *
 * The exclusion list below is therefore the approximation, and it is a
 * deliberate trade rather than an oversight: it covers the generated and vendored
 * directories that actually appear under the roots these checks walk.
 */

import { readdirSync, type Dirent } from 'node:fs'
import { basename, join, relative } from 'node:path'
import { toPosixPath } from '../posix-path'

/** Repository root — this file lives at `[internal ref]`. */
export const REPO_ROOT = join(import.meta.dir, '..', '..', '..')

/**
 * Directory names never descended into.
 *
 * `vendor` is here for the reason [internal ref] gives: the vendored subtrees are
 * pinned upstream snapshots, excluded from all tooling, and walking them would
 * add tens of thousands of files that no drift check has an opinion about.
 *
 * `build` is NOT here, and its removal is a bug fix rather than a relaxation.
 * The name was added to skip build OUTPUT, and it did — but a name-based
 * exclusion cannot tell an artefact directory from a source one, and this
 * repository has `scripts/build/`: 42 tracked source files holding the whole
 * build pipeline. Every walk over `scripts/` silently omitted them. Measured
 * 2026-09-14 the cost was three separate blind spots, none of which reported
 * anything: `Layout Drift` walked 285 scripts files instead of 327 and so could
 * never see a defect under `build/`; the layout migration engine skipped four
 * importers there and left them pointing at a moved module, caught only by
 * `tsc`; and the `/build/` clause of the engine's config-literal census was
 * dead code that could never match. The only artefact directory this ever
 * protected is `website/build`, which is gitignored and which no caller walks
 * — `dist` and `node_modules` still cover the real output trees. A caller that
 * genuinely needs it can pass `excludeDirs: ['build']`.
 */
export const DEFAULT_EXCLUDED_DIRS: ReadonlySet<string> = new Set([
  'node_modules',
  'vendor',
  'dist',
  'coverage',
  '.git',
])

/**
 * Repo-relative directory PREFIXES a booted app writes into a source tree.
 *
 * `bun run app:admin` boots the operator console, whose config now lives at
 * `src/admin/` ([internal ref] D3). A boot writes two things beside that config: the
 * `.sovrium/` data dir (SQLite, lock file, storage) and, because the console
 * declares page-scoped `search-input` components, `public/sovrium-search/`
 * holding a generated index and runtime. Both are gitignored, neither is
 * authored, and both appear INSIDE a tree the layout law governs.
 *
 * They have to be excluded somewhere, and this is the honest place. A NAME-based
 * entry in {@link DEFAULT_EXCLUDED_DIRS} would be the wrong instrument for the
 * reason the `build` note above records at length: a name cannot tell an
 * artefact directory from a source one, and `public` is a real source directory
 * under `apps/website`. A PREFIX can, so these are prefixes.
 *
 * What this costs: a real source file placed under one of these paths is
 * invisible to every gate that uses {@link excludeRuntimeArtefacts}. That is
 * the intended trade — nothing may be authored there, and `Layout Drift`'s own
 * `layer-child-not-in-manifest` rule is what says so, since `public` is not a
 * declared child of the `admin` layer.
 *
 * Caught by booting the preview rather than by reading the walk: before the
 * console moved under `src/`, these artefacts landed in `apps/`, which no
 * layout gate walks. The move made a developer's ordinary `bun run app:admin`
 * turn the build red.
 */
export const RUNTIME_ARTEFACT_PREFIXES: readonly string[] = [
  'src/admin/.sovrium/',
  'src/admin/public/',
]

/**
 * A {@link WalkOptions.filter} that drops every {@link RUNTIME_ARTEFACT_PREFIXES}
 * path. Compose it with `&&` when a caller needs a filter of its own.
 */
export const excludeRuntimeArtefacts = (absolutePath: string): boolean => {
  const rel = toPosixPath(relative(REPO_ROOT, absolutePath))
  return !RUNTIME_ARTEFACT_PREFIXES.some((prefix) => rel.startsWith(prefix))
}

/**
 * A third-party export pinned byte for byte as the sample of a design-system
 * adapter contract: `[internal ref]<tool>/<version>/export-sample/**`.
 *
 * Those files are upstream-verbatim, licensed vendor output (a Notion Markdown
 * export, a Webflow site export with its `js/webflow.js`), and each folder's
 * `manifest.json` holds them to a sha256 under `Design Adapter Contract Drift`.
 * A gate that judges them as if they were authored here demands a change to
 * vendor bytes, which the manifest then rejects: Notion links a page to CSVs
 * its Markdown export does not hold, and a Webflow export nests `js/` under a
 * dotted version directory. Neither is a defect to fix; both are the evidence
 * the adapter is tested against.
 *
 * Deliberately narrow: only the `export-sample/` DIRECTORY, the same glob
 * `[internal ref]` ignores. The contract's own `manifest.json`, its
 * README, and the single-file samples beside the folder stay governed.
 */
export const PINNED_EXPORT_SAMPLE =
  /^scripts\/baselines\/design-system-adapters\/[^/]+\/[^/]+\/export-sample\//

/** Whether a REPO-RELATIVE path lies inside a {@link PINNED_EXPORT_SAMPLE} folder. */
export const isPinnedExportSample = (repoRelativePath: string): boolean =>
  PINNED_EXPORT_SAMPLE.test(toPosixPath(repoRelativePath))

/** A {@link WalkOptions.filter} that drops every {@link isPinnedExportSample} path. */
export const excludePinnedExportSamples = (absolutePath: string): boolean =>
  !isPinnedExportSample(relative(REPO_ROOT, absolutePath))

/** The operator console's Claude Design reference, repo-relative (`[internal ref]`, `admin`). */
export const CONSOLE_DESIGN_ROOT = 'src/admin/design'

/**
 * The folders of {@link CONSOLE_DESIGN_ROOT} that hold reference DATA rather
 * than authored source: all three are written whole by `bun run design:console`
 * from the console's own design-system bundle export (`prototype/` is the
 * interactive prototype built from its canvas) and two-way synced with
 * claude.ai/design.
 */
export const CONSOLE_DESIGN_REFERENCE_FOLDERS: readonly string[] = [
  'design-system',
  'canvas',
  'prototype',
]

const CONSOLE_DESIGN_REFERENCE = new RegExp(
  `^${CONSOLE_DESIGN_ROOT}/(?:${CONSOLE_DESIGN_REFERENCE_FOLDERS.join('|')})/`
)

/**
 * Whether a REPO-RELATIVE path lies inside one of the console design
 * reference's data folders ({@link CONSOLE_DESIGN_REFERENCE_FOLDERS}).
 *
 * Those files are never imported and never embedded: they exist to be read by
 * Claude Design and by a person, and their names, sizes and links are the
 * export's (`components/Accordion/README.md`, anchors into sibling pages, one
 * directory per component). A gate that judges them as if they were authored
 * here demands edits that the next `bun run design:console` overwrites, which is
 * the {@link isPinnedExportSample} argument one tree over. Their only gate is
 * the report-only `Console Design Reference Drift`, which compares them to a
 * fresh export.
 *
 * Deliberately narrow: the three folders, never the whole of
 * {@link CONSOLE_DESIGN_ROOT}. The `README.md` beside them is authored prose and
 * stays governed like any other.
 */
export const isConsoleDesignReference = (repoRelativePath: string): boolean =>
  CONSOLE_DESIGN_REFERENCE.test(toPosixPath(repoRelativePath))

/** A {@link WalkOptions.filter} that drops every {@link isConsoleDesignReference} path. */
export const excludeConsoleDesignReference = (absolutePath: string): boolean =>
  !isConsoleDesignReference(relative(REPO_ROOT, absolutePath))

/**
 * A {@link WalkOptions.filter} keeping only what is AUTHORED here: neither a
 * {@link RUNTIME_ARTEFACT_PREFIXES} path, nor an {@link isPinnedExportSample}
 * one, nor an {@link isConsoleDesignReference} one. `Layout Drift` walks both
 * trees through it — the law governs authored files, and a vendor's folder
 * layout (a Webflow export's `site-export/js/webflow.js`, eight segments under
 * the dotted `2.2.2/`) is not one, nor is a generated export's.
 */
export const isAuthored = (absolutePath: string): boolean =>
  excludeRuntimeArtefacts(absolutePath) &&
  excludePinnedExportSamples(absolutePath) &&
  excludeConsoleDesignReference(absolutePath)

/**
 * Whether `name`, found inside `parent`, is a harness's NESTED-CHECKOUT
 * directory: `worktrees` directly under `.claude`.
 *
 * Claude Code creates every agent worktree at `[internal ref]<id>/`, inside
 * the primary checkout. Each one is a whole second copy of the repository at
 * whatever commit its branch sits on. `.gitignore` excludes the directory, but
 * this walk does not read `.gitignore` (see the module header), and the
 * dotted-name rule does not reach it either: a caller that names `.claude` as
 * its ROOT has already stepped past the dot, and `worktrees` is an ordinary
 * name. So a walk over `.claude` read every live agent's snapshot of `[internal ref]` as
 * if it were this checkout's documentation. Measured 2026-10-05, `Path
 * Reference Drift` failed the primary checkout's build on 228 dead paths, every
 * one of them under a single sibling agent's worktree 31 commits behind `main`
 * — a red caused by a session that happened to be open, which the developer
 * could neither fix nor see in `git status`.
 *
 * Why HERE, in the default descent, rather than in the one gate that tripped: a
 * nested checkout is corpus for no check, so a per-gate exclusion is a rule
 * every future walk over `.claude` must remember, and the first one that
 * forgets is red only while somebody else's session is open — the hardest kind
 * of red to reproduce. Why not as a {@link RUNTIME_ARTEFACT_PREFIXES} row, the
 * obvious home for a gitignored tree: {@link excludeRuntimeArtefacts} is an
 * opt-in FILE filter, so it would neither reach the gate that tripped nor stop
 * the walk reading a whole second repository before discarding it; and its
 * prefixes are relative to {@link REPO_ROOT}, which the checkout being judged
 * is not when the gate runs from inside an agent worktree. Why a PAIR rather
 * than the bare name `worktrees`: the `build` note on
 * {@link DEFAULT_EXCLUDED_DIRS} records what a bare name costs, and the parent
 * `.claude` is what makes this one unambiguous.
 *
 * Only what the walk DESCENDS into is tested, never the root it was handed — so
 * a gate run from inside an agent worktree still reads that worktree in full,
 * and only checkouts nested beneath it are pruned.
 */
const isNestedCheckoutDir = (parent: string, name: string): boolean =>
  name === 'worktrees' && basename(parent) === '.claude'

export interface WalkOptions {
  /** Absolute directory to walk. */
  readonly root: string
  /**
   * File extensions to keep, including the dot (e.g. `['.ts', '.tsx']`).
   * Omitted: every file.
   */
  readonly extensions?: readonly string[]
  /** Extra directory names to skip, on top of {@link DEFAULT_EXCLUDED_DIRS}. */
  readonly excludeDirs?: readonly string[]
  /** Drop `*.test.*` and `*.spec.*` siblings (default: keep them). */
  readonly excludeTests?: boolean
  /** Keep only files satisfying this predicate, tested on the absolute path. */
  readonly filter?: (absolutePath: string) => boolean
}

/** Thrown when a root cannot be read. Never returned as an empty corpus. */
export class WalkError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WalkError'
  }
}

const TEST_FILE = /\.(test|spec)\.[cm]?[jt]sx?$/

const keeps = (absolute: string, name: string, options: WalkOptions): boolean => {
  if (options.extensions !== undefined && !options.extensions.some((e) => name.endsWith(e))) {
    return false
  }
  if (options.excludeTests === true && TEST_FILE.test(name)) return false
  return options.filter?.(absolute) ?? true
}

/**
 * Every file under `root`, absolute and sorted.
 *
 * Sorted because a drift check's report and its baseline are both compared as
 * text: `readdirSync` order is filesystem-dependent, so an unsorted walk makes
 * a committed baseline differ between a developer's machine and CI for no
 * reason anyone can see.
 *
 * @throws {WalkError} when a directory cannot be read.
 */
export const walkSync = (options: WalkOptions): readonly string[] => {
  const excluded = new Set([...DEFAULT_EXCLUDED_DIRS, ...(options.excludeDirs ?? [])])
  const found: string[] = []

  const descend = (dir: string): void => {
    let entries: readonly Dirent[]
    try {
      entries = readdirSync(dir, { withFileTypes: true, encoding: 'utf8' })
    } catch (error) {
      // NOT `return []`. See the module header: a swallowed read failure is how
      // a gate comes to report clean over a corpus it never opened.
      throw new WalkError(
        `walk: cannot read ${relative(REPO_ROOT, dir) || dir} — ${
          error instanceof Error ? error.message : String(error)
        }. The corpus is unknown, which is not the same as empty.`
      )
    }

    for (const entry of entries) {
      const absolute = join(dir, entry.name)
      if (entry.isDirectory()) {
        if (
          !excluded.has(entry.name) &&
          !entry.name.startsWith('.') &&
          !isNestedCheckoutDir(dir, entry.name)
        ) {
          descend(absolute)
        }
        continue
      }
      if (!entry.isFile()) continue
      if (keeps(absolute, entry.name, options)) found.push(absolute)
    }
  }

  descend(options.root)
  return found.sort()
}

/**
 * As {@link walkSync}, off the synchronous path.
 *
 * The walk itself is still `readdirSync` — `node:fs/promises` buys nothing for
 * a traversal this size, and having ONE traversal means the two entry points
 * cannot drift apart in what they exclude. This exists so an async caller does
 * not block its event loop for the duration.
 *
 * The `async` keyword IS the interface here: callers await this, so dropping it
 * would be a breaking signature change to a wrapper whose entire purpose is the
 * async call shape.
 */
export const walk = async (options: WalkOptions): Promise<readonly string[]> => walkSync(options)

/** A walked absolute path, rendered repo-relative with POSIX separators. */
export const toRepoRelative = (absolutePath: string): string =>
  toPosixPath(relative(REPO_ROOT, absolutePath))

/**
 * ONE directory listing, non-recursive — the other half of SC6's walk home.
 *
 * {@link walkSync} retired the recursive hand-rolled walkers; this retires the
 * single-level `readdirSync(dir)` calls that legitimately are not walks at all
 * (the `dist/` listing that finds the tarballs, the `client/` listing that finds
 * the three static scripts). They were left in place at first because "use the
 * recursive walker" is the wrong advice for them — and the result was a
 * capability the layout gate reported as living outside its home, forever,
 * with no correct destination to move it to.
 *
 * It exists for the same reason `walkSync` does rather than for tidiness: a
 * bare `readdirSync` in a `try { … } catch { return [] }` reports an unreadable
 * directory as an EMPTY one, and every "no unlisted file" assertion downstream
 * then passes over a corpus nobody read. This throws instead, through the same
 * {@link WalkError} so a caller cannot tell the two cases apart by accident.
 *
 * @throws {WalkError} when the directory cannot be read.
 */
export const listDirSync = (options: WalkOptions): readonly string[] => {
  let entries: readonly Dirent[]
  try {
    entries = readdirSync(options.root, { withFileTypes: true, encoding: 'utf8' })
  } catch (error) {
    throw new WalkError(
      `list: cannot read ${relative(REPO_ROOT, options.root) || options.root} — ${
        error instanceof Error ? error.message : String(error)
      }. The corpus is unknown, which is not the same as empty.`
    )
  }

  return entries
    .filter((entry) => entry.isFile() && keeps(join(options.root, entry.name), entry.name, options))
    .map((entry) => join(options.root, entry.name))
    .sort()
}

/**
 * The immediate SUBDIRECTORIES of a directory, absolute and sorted.
 *
 * Same contract as {@link listDirSync} and same reason: a caller enumerating
 * board folders or capture runs wants one level, and the failure mode of
 * swallowing an unreadable root is identical.
 *
 * @throws {WalkError} when the directory cannot be read.
 */
export const listSubdirsSync = (root: string): readonly string[] => {
  let entries: readonly Dirent[]
  try {
    entries = readdirSync(root, { withFileTypes: true, encoding: 'utf8' })
  } catch (error) {
    throw new WalkError(
      `list: cannot read ${relative(REPO_ROOT, root) || root} — ${
        error instanceof Error ? error.message : String(error)
      }. The corpus is unknown, which is not the same as empty.`
    )
  }

  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(root, entry.name))
    .sort()
}
