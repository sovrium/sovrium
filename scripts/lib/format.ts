/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The repository's formatter, as one module: `bun fmt` (Bun 1.4.4+), driven
 * through its CLI because it has no JavaScript API.
 *
 * Every script that writes a file the Format gate reads goes through here, so
 * the gate and the writers can never disagree about what "formatted" means.
 * Until [internal ref] the writers called Prettier's API while the gate ran the
 * Prettier CLI; the two now share one implementation by construction rather
 * than by both happening to resolve the same `.prettierrc.json`.
 *
 * `bun fmt` reads `.prettierrc.json` and `.prettierignore` itself (plus
 * `.gitignore` and `.git/info/exclude`), and maps the config's
 * `prettier-plugin-tailwindcss` entry onto its built-in Tailwind sorter. The
 * Prettier LIBRARY is still a runtime dependency of the binary — `sovrium
 * build` formats HTML with it — and is deliberately not touched here.
 *
 * Two behaviours of `--stdin-filepath` callers must know:
 *
 *  - A path that `.prettierignore` (or `.gitignore`) excludes comes back
 *    UNCHANGED, exit 0. So does a path outside the working directory. That
 *    matches Prettier, and it means an ignored target is never reformatted.
 *  - A path with no inferable language, or text that does not parse, exits 2.
 *    {@link formatText} turns that into a thrown error naming the file.
 */

import { relative } from 'node:path'
import { REPO_ROOT } from './drift/walk'

/**
 * The Bun running this script, never the first `bun` on PATH. `bun fmt` exists
 * from 1.4.4 on; a PATH that still resolves an older Bun would hand the
 * formatting to a binary that has no such subcommand. The script was started by
 * the pinned runtime, so `process.execPath` is the one `packageManager` names.
 */
const BUN = process.execPath

/** `bun fmt`'s exit codes (https://bun.com/docs/format). */
export const FORMAT_EXIT = {
  /** Every matched file is formatted. */
  clean: 0,
  /** At least one file needs formatting (`--check`, `--list-different`). */
  unformatted: 1,
  /** Something went wrong: a syntax error, an unmatched pattern, an unsupported plugin. */
  error: 2,
} as const

/** The Format gate: read-only, exits 1 on an unformatted file and 2 on an error. */
export const FORMAT_CHECK_COMMAND: readonly string[] = [BUN, 'fmt', '--check', '.']

/**
 * The files the gate covers, one per line. Run beside {@link FORMAT_CHECK_COMMAND}
 * because `--check` prints the same "All matched files use Prettier code style!"
 * whether it checked fourteen thousand files or none: an ignore file that
 * swallowed the tree would pass silently.
 */
export const FORMAT_LIST_COMMAND: readonly string[] = [BUN, 'fmt', '--list-files', '.']

/** Count the paths `bun fmt --list-files` printed. */
export const countListedFiles = (stdout: string): number =>
  stdout.split('\n').filter((line) => line.trim().length > 0).length

/** A `bun fmt` run that did not produce formatted output. */
export class FormatError extends Error {
  constructor(
    readonly filepath: string,
    readonly exitCode: number,
    readonly stderr: string
  ) {
    super(`bun fmt could not format ${filepath} (exit ${exitCode}): ${stderr.trim()}`)
    this.name = 'FormatError'
  }
}

const toCliPath = (filepath: string, cwd: string): string => {
  const rel = relative(cwd, filepath)
  // Inside the tree: hand `bun fmt` the relative path, which is how it matches
  // `.prettierignore`. Outside it, pass the path through unchanged; it comes
  // back unformatted, exactly as Prettier treats a file outside its root.
  return rel.length > 0 && !rel.startsWith('..') ? rel : filepath
}

/** How {@link formatText} treats the ignore files. */
export interface FormatTextOptions {
  /**
   * `respect` (the default) reads `.prettierignore`, `.gitignore` and
   * `.git/info/exclude`, so an ignored path comes back unchanged. `none`
   * formats the text whatever the path: for a GENERATOR whose output is
   * ignored by the gate (`*.generated.ts`) but has always been written
   * formatted, as Prettier's API did — it never read an ignore file.
   */
  readonly ignore?: 'respect' | 'none'
  readonly cwd?: string
}

/**
 * An ignore file that does not exist. `--ignore-path` REPLACES bun fmt's default
 * list, and a missing ignore file is read as empty, so naming one turns every
 * ignore rule off. A missing relative path rather than `/dev/null`, because
 * `generate-admin-preset.ts` runs inside `build:binary` on the Windows release
 * runner too.
 */
const NO_IGNORE_FILE = '.sovrium-format-reads-no-ignore-file'

/**
 * Format `text` as the file at `filepath` would be formatted, and return it.
 *
 * `filepath` picks the language and, unless `ignore: 'none'`, the ignore
 * rules; it need not exist. Throws {@link FormatError} on a syntax error or an
 * unknown language.
 */
export const formatText = (
  text: string,
  filepath: string,
  options: FormatTextOptions = {}
): string => {
  const cwd = options.cwd ?? REPO_ROOT
  const ignoreArgs = options.ignore === 'none' ? [`--ignore-path=${NO_IGNORE_FILE}`] : []
  const result = Bun.spawnSync(
    [BUN, 'fmt', ...ignoreArgs, `--stdin-filepath=${toCliPath(filepath, cwd)}`],
    { cwd, stdin: Buffer.from(text), stdout: 'pipe', stderr: 'pipe' }
  )
  if (result.exitCode !== FORMAT_EXIT.clean) {
    throw new FormatError(filepath, result.exitCode, result.stderr.toString())
  }
  return result.stdout.toString()
}
