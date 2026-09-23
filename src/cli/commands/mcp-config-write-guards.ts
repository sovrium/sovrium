/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Bound 1 of [internal ref] A8 surface 10: where a config write tool may point.
 *
 * Four questions, asked in this order, each with its own refusal:
 *
 * 1. **Inside the project?** Plain `path.relative` containment, no `realpath`,
 *    matching `findProjectJailEscape` — so a symlinked temp root (`/var` →
 *    `/private/var` on macOS) is not mistaken for an escape merely because one
 *    side was canonicalised and the other was not.
 * 2. **A protected location?** `.git/`, `[internal ref]`, any `.env*`, the data
 *    directory, `.sovrium-template.json`. A tool that can write `.env` is a
 *    credential-writing tool; a tool that can write `.git/` rewrites history.
 * 3. **A config extension?** `.yaml`, `.yml`, `.json` and nothing else.
 * 4. **A symlink?** Separate from question 1 on purpose: the TARGET can be a
 *    perfectly ordinary file inside the jail while the link is the escape hatch,
 *    so `linked.yaml` passes questions 1–3 and is refused here.
 *
 * The order is what makes each refusal say the useful thing. `.env` carries no
 * allowed extension, so asking question 3 first would refuse it by talking about
 * file formats — which tells its caller nothing about why a credential file is
 * off limits, and would read as an invitation to rename it `.env.yaml`.
 *
 * Every message names WHAT was refused. A generic "not allowed" leaves a caller
 * retrying blindly, and a caller that retries blindly is one that eventually
 * finds a path that works.
 */

import { basename, extname, relative, resolve, sep } from 'node:path'
import { parseDataDir } from '@/domain/models/process-env/data-dir'
import { isPathWithin } from '@/domain/models/process-env/desktop'

/** The only extensions a config file may carry. */
const CONFIG_EXTENSIONS: ReadonlySet<string> = new Set(['.yaml', '.yml', '.json'])

/** Directories whose contents are never config, named by their first segment. */
const PROTECTED_DIRECTORIES: ReadonlySet<string> = new Set(['.git', '.claude'])

/** The marker `sovrium init` leaves behind; rewriting it re-labels the project. */
const TEMPLATE_MARKER = '.sovrium-template.json'

/** A located write target: inside the jail, and describable to its caller. */
export interface LocatedTarget {
  /** The jail this was resolved against. */
  readonly projectDir: string
  /** Absolute, resolved against the project directory. */
  readonly absolutePath: string
  /** Project-relative, in the form `_config_list_files` publishes. */
  readonly relativePath: string
}

/** Why a path may not be written, in the words its caller has to act on. */
export type TargetRefusal = { readonly refused: string }

const refuse = (message: string): TargetRefusal => ({ refused: message })

/**
 * Resolve `path` against the project directory, refusing any result that leaves
 * it.
 *
 * An absolute `path` goes through the same rule rather than a special case:
 * `resolve` returns it unchanged, and it is then inside the root or it is not.
 */
export const locateInProject = (
  projectDir: string,
  path: string
): LocatedTarget | TargetRefusal => {
  const absolutePath = resolve(projectDir, path)
  if (!isPathWithin(projectDir, absolutePath)) {
    return refuse(
      `Refused: ${path} resolves outside the project directory. The project directory is ` +
        `${projectDir}, and every file this tool may write has to stay inside it.`
    )
  }
  return { projectDir, absolutePath, relativePath: relative(projectDir, absolutePath) }
}

/**
 * The data directory, spelled the way its caller would — project-relative when
 * it sits inside the project, absolute when the operator relocated it.
 */
const nameDataDir = (projectDir: string, dataDir: string): string => {
  const rel = relative(projectDir, dataDir)
  return rel === '' || rel.startsWith('..') ? dataDir : rel
}

/** The protected location `target` sits in, named as its caller would spell it. */
const findProtectedLocation = (target: Readonly<LocatedTarget>): string | undefined => {
  const segments = target.relativePath.split(sep)
  const first = segments[0] ?? ''
  if (PROTECTED_DIRECTORIES.has(first)) return first
  const dotEnv = segments.find((segment) => segment.startsWith('.env'))
  if (dotEnv !== undefined) return dotEnv
  if (basename(target.absolutePath) === TEMPLATE_MARKER) return TEMPLATE_MARKER

  // `SOVRIUM_DATA_DIR` can legitimately be set to the project directory itself,
  // and a data dir that CONTAINS the project would otherwise make every config
  // file unwritable — a "protection" that protects the config from being edited
  // is just a broken tool. So the rule applies only where the data dir is a
  // place inside, or beside, the project rather than above it.
  const dataDir = parseDataDir()
  if (isPathWithin(dataDir, target.projectDir)) return undefined
  return isPathWithin(dataDir, target.absolutePath)
    ? nameDataDir(target.projectDir, dataDir)
    : undefined
}

/**
 * Bound 1's second and third questions, both pure path arithmetic.
 *
 * `undefined` means the target passed; a {@link TargetRefusal} carries the
 * sentence explaining which rule it met.
 */
export const refuseProtectedOrNonConfig = (
  target: Readonly<LocatedTarget>
): TargetRefusal | undefined => {
  const location = findProtectedLocation(target)
  if (location !== undefined) {
    return refuse(
      `Refused: ${target.relativePath} is inside ${location}, which this tool never writes. ` +
        `${location} holds credentials, version-control state or runtime data rather than ` +
        `configuration — edit it yourself if you mean to.`
    )
  }

  const extension = extname(target.absolutePath).toLowerCase()
  if (!CONFIG_EXTENSIONS.has(extension)) {
    return refuse(
      `Refused: ${target.relativePath} is not a config file. This tool writes .yaml, .yml and ` +
        `.json files only — application behaviour is declared in config, never in code.`
    )
  }

  return undefined
}

/**
 * Bound 1's fourth question, the only one that has to touch the filesystem.
 *
 * `lstat` rather than `stat`, which is the whole point: `stat` follows the link
 * and reports on its target, so a symlink would be indistinguishable from the
 * ordinary file it points at.
 */
export const refuseSymlink = async (
  target: Readonly<LocatedTarget>
): Promise<TargetRefusal | undefined> => {
  const { lstat } = await import('node:fs/promises')
  const stats = await lstat(target.absolutePath).catch(() => undefined)
  if (stats?.isSymbolicLink() !== true) return undefined
  return refuse(
    `Refused: ${target.relativePath} is a symlink. A symlink can point anywhere, including out ` +
      `of the project directory, so this tool writes real files only — name the file it points ` +
      `at instead.`
  )
}

/** Whether a located-or-refused result is the refusal. */
export const isTargetRefusal = (value: LocatedTarget | TargetRefusal): value is TargetRefusal =>
  'refused' in value
