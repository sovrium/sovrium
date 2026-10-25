/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { readdir, realpath } from 'node:fs/promises'
import { dirname, join, relative, resolve, sep } from 'node:path'
import {
  entryKind,
  MANIFEST_FILENAME,
  type Finding,
  type Manifest,
} from '@/cli/commands/skills-agent-file'

/**
 * Where `sovrium skills` would write or delete through a symbolic link. Every
 * path a run touches is `lstat`ed first, and a link anywhere there refuses the
 * whole run (see `skills-files.ts`, "Never through a symlink").
 */

/** Every symlink at or below `root` (POSIX, relative to `base`), never following one. */
const linksBelow = async (root: string, base: string): Promise<readonly string[]> => {
  const toRelative = (path: string): string => relative(base, path).split(sep).join('/')
  const kind = await entryKind(root)
  if (kind === 'link') return [`${toRelative(root)}/`]
  if (kind !== 'directory') return []
  const entries = await readdir(root, { withFileTypes: true }).catch(() => [])
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = join(root, entry.name)
      if (entry.isSymbolicLink()) return [toRelative(path)]
      return entry.isDirectory() ? linksBelow(path, base) : []
    })
  )
  return nested.flat()
}

const isInside = (root: string, candidate: string): boolean =>
  candidate === root || candidate.startsWith(`${root}${sep}`)

/**
 * Whether the skills root — or, when it does not exist yet, its parent
 * (`.claude`) — resolves OUTSIDE the project. A dangling link there resolves
 * nowhere, which counts as outside: nothing can be written through it safely.
 */
export const rootEscapesProject = async (projectDir: string, dir: string): Promise<boolean> => {
  const project = await realpath(projectDir).catch(() => resolve(projectDir))
  const probe = async (candidates: readonly string[]): Promise<boolean> => {
    const [candidate, ...rest] = candidates
    if (candidate === undefined) return false
    if ((await entryKind(candidate)) === 'absent') return probe(rest)
    const real = await realpath(candidate).catch(() => undefined)
    return real === undefined || !isInside(project, real)
  }
  return probe([dir, dirname(dir)])
}

/**
 * Every symlink a run would write or delete through: at or below each skill
 * directory the catalogue or the manifest names, and at the manifest path.
 * Sorted, so the first one named is the same on every run.
 */
export const symlinkFindings = async (
  dir: string,
  skills: readonly { readonly name: string }[],
  manifest: Manifest | undefined
): Promise<readonly Finding[]> => {
  const names = new Set([
    ...skills.map(({ name }) => name),
    ...[...(manifest?.files.keys() ?? [])].map((path) => path.split('/')[0] ?? ''),
  ])
  const below = await Promise.all([...names].map(async (name) => linksBelow(join(dir, name), dir)))
  const manifestLink = (await entryKind(join(dir, MANIFEST_FILENAME))) === 'link'
  return [...below.flat(), ...(manifestLink ? [MANIFEST_FILENAME] : [])]
    .toSorted()
    .map((path) => ({ state: 'symlink' as const, path }))
}
