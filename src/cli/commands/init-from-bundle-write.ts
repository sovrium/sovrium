/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Write an opened bundle as a new project, atomically.
 *
 * The tree is written into a temporary SIBLING of the target, then renamed
 * into place in one step, so a failure part-way leaves no half-written
 * project, and the temporary directory is removed on every failure.
 *
 * ### What lands where
 *
 * | In the bundle                       | In the project                        |
 * | ----------------------------------- | ------------------------------------- |
 * | `project/app.json`                  | `app.yaml`, generated from the config |
 * | `project/CLAUDE.md`, `PROMPT.md`    | `CLAUDE.md`, `PROMPT.md` at the root  |
 * | `project/<path>` (declared assets)  | `<path>`                              |
 * | `public/**`, `seed/**`              | `public/**`, `seed/**`                |
 * | `manifest.json`, `manifest.sig`     | nothing                               |
 *
 * `app.yaml` is generated, so the comments of the original config are not
 * carried: that is the honest cost of converting to the format a person and
 * their AI edit most safely. Every file is written without an execute,
 * setuid, setgid or sticky bit, whatever the archive recorded.
 *
 * ### Provenance: the bundle's identity, never its link
 *
 * `.sovrium-template.json` records the app name, the archive's sha256, the
 * manifest's sha256, the publisher verdict and, for a fetched bundle, the HOST
 * of the final URL alone. No path and no query: a per-recipient token rides in
 * a short link's path as readily as in a query string, and this file is meant
 * to be committed.
 */

import { randomBytes } from 'node:crypto'
import { mkdir, rename, rm, writeFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { BUNDLE_CONFIG_ENTRY } from '@/application/use-cases/server/bundle-manifest'
import { PROVENANCE_FILENAME } from '@/cli/commands/init-from-url-provenance'
import { CLAUDE_MD_BODY } from '@/cli/commands/init-scaffold-content'
import { renderYamlFragment } from '@/cli/commands/library-wire'
import { caseCollisions, writtenFileMode } from '@/domain/kernel/identity/bundle-entry-refusal'
import { refuse, type Step } from './init-from-bundle-source'
import type { OpenedBundle } from './init-from-bundle-open'

/** One file of the project to be: where it goes, its bytes and the mode it is written with. */
interface PlannedFile {
  readonly path: string
  readonly bytes: Uint8Array
  readonly mode: number
}

/** Files the import writes itself, which no bundle entry may claim. */
const RESERVED = new Set(['app.yaml', 'app.yml', 'app.json', 'app.ts', PROVENANCE_FILENAME])

/** The project path of an archive entry, `project/` dropped. */
const projectPath = (archivePath: string): string =>
  archivePath.startsWith('project/') ? archivePath.slice('project/'.length) : archivePath

/** Two entries naming the same project path (`project/public/a` and `public/a`). */
const duplicates = (paths: readonly string[]): readonly string[] =>
  paths.filter((path, index) => paths.indexOf(path) !== index)

/** Plan every bundled file, refusing one that would collide with another or with a generated file. */
export const planProjectFiles = (bundle: OpenedBundle): Step<readonly PlannedFile[]> => {
  const planned = bundle.files
    .filter((entry) => entry.path !== BUNDLE_CONFIG_ENTRY)
    .map((entry) => ({
      path: projectPath(entry.path),
      bytes: entry.bytes,
      mode: writtenFileMode(entry.mode),
    }))
  const reserved = planned.filter((file) => RESERVED.has(file.path.toLowerCase()))
  const paths = planned.map((file) => file.path)
  const clashes = [
    ...reserved.map((file) => `  ${file.path} would replace a file the import writes itself`),
    ...duplicates(paths).map((path) => `  ${path} is carried twice`),
    ...caseCollisions(paths).map(
      ([first, second]) =>
        `  ${first} and ${second} would land on the same file on a case-insensitive disk`
    ),
  ]
  return clashes.length === 0
    ? { ok: true, value: planned }
    : refuse(`The bundle's files collide once laid out as a project:\n${clashes.join('\n')}`)
}

/** The provenance sidecar: identity only. */
const provenance = (bundle: OpenedBundle, host: string | undefined): string =>
  `${JSON.stringify(
    {
      name: bundle.manifest.app.name,
      ...(host === undefined ? {} : { host }),
      sha256: bundle.sha256,
      manifestSha256: bundle.manifestSha256,
      verdict: bundle.verdict.verdict,
      importedAt: new Date().toISOString(),
    },
    undefined,
    2
  )}\n`

const writeOne = async (root: string, file: PlannedFile): Promise<void> => {
  const path = join(root, file.path)
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, file.bytes, { mode: file.mode })
}

/** Everything the project holds, written into `root`. */
const writeTree = async (
  root: string,
  bundle: OpenedBundle,
  files: readonly PlannedFile[],
  host: string | undefined
): Promise<void> => {
  await mkdir(root)
  await Promise.all(files.map((file) => writeOne(root, file)))
  await writeFile(
    join(root, 'app.yaml'),
    renderYamlFragment(
      "Generated by 'sovrium init --from-bundle' from the bundle's validated config.",
      bundle.config
    )
  )
  if (!files.some((file) => file.path === 'CLAUDE.md')) {
    await writeFile(join(root, 'CLAUDE.md'), `# ${bundle.manifest.app.name}\n\n${CLAUDE_MD_BODY}`)
  }
  await writeFile(join(root, PROVENANCE_FILENAME), provenance(bundle, host))
}

/**
 * Write the project into a temporary sibling of `targetDir`, let `finish` add
 * the support files every scaffold gets, then rename it into place. On any
 * failure the sibling is removed and nothing is left behind.
 */
export const writeBundleProject = async (options: {
  readonly targetDir: string
  readonly bundle: OpenedBundle
  readonly files: readonly PlannedFile[]
  readonly host: string | undefined
  readonly finish: (root: string) => Promise<unknown>
}): Promise<Step<string>> => {
  const { targetDir, bundle, files, host } = options
  const staging = join(
    dirname(targetDir),
    `.${basename(targetDir)}.sovrium-import-${randomBytes(6).toString('hex')}`
  )
  try {
    await writeTree(staging, bundle, files, host)
    await options.finish(staging)
    await rename(staging, targetDir)
    return { ok: true, value: targetDir }
  } catch (error) {
    await rm(staging, { recursive: true, force: true })
    return refuse(
      `Could not write the project into ${targetDir}, so nothing was left behind: ` +
        (error instanceof Error ? error.message : String(error))
    )
  }
}
