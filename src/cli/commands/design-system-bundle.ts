/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `sovrium design-system --format bundle --output <dir> [--force]`
 *
 * Writes the portable design-system bundle into a directory: the brief, the
 * token documents for both colour modes with their resolver, the theme CSS,
 * the rendered component kit and the fonts it uses, and the manifest that
 * checksums them all. Offline, like the two single-document formats.
 *
 * ─── A NON-EMPTY DIRECTORY IS REFUSED, AND `--force` IS NOT "EMPTY IT" ─────
 *
 * A bundle is many files. Written over a directory that already holds others,
 * it leaves a mixture nobody can tell apart from a clean export, so the
 * command refuses before writing anything. `--force` overwrites the bundle's
 * OWN files and leaves every other file where it was: the operator may have
 * pointed it at a directory by mistake, and deleting what is not ours is not
 * a recoverable mistake.
 *
 * The manifest is written LAST, so a run interrupted half-way leaves a
 * directory with no manifest rather than a manifest describing files that are
 * not there.
 */

import { mkdir, readdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { printStderr } from '@/infrastructure/logging/cli-output'
import { formatRuntimeError } from '@/infrastructure/logging/format-runtime-error'
import { lazyImportIndex } from './utils'
import type { PageExportSelection } from '@/application/use-cases/admin/design-system-pages'
import type { App } from '@/domain/models/app'

/** Whether a path names a directory that exists and holds at least one entry. */
const isOccupied = async (dir: string): Promise<boolean> =>
  readdir(dir)
    .then((entries) => entries.length > 0)
    .catch(() => false)

/** Write one file, creating its parent directories. */
const writeBundleFile = async (dir: string, path: string, bytes: Uint8Array): Promise<void> => {
  const target = join(dir, path)
  await mkdir(dirname(target), { recursive: true })
  await writeFile(target, bytes)
}

/**
 * Export the bundle of a decoded app into `outputDir`.
 *
 * @param app - the validated config.
 * @param outputDir - the directory to write; created when missing.
 * @param force - overwrite the bundle's own files in a non-empty directory.
 * @param source - where the app's logo files are read from.
 */
export const writeDesignSystemBundle = async (
  app: App,
  outputDir: string | undefined,
  force: boolean,
  source: { readonly publicDir?: string; readonly pages?: PageExportSelection } = {}
): Promise<void> => {
  if (outputDir === undefined) {
    printStderr(
      `Error: --format bundle writes a directory, so it needs --output <dir>.\n\n` +
        `  sovrium design-system app.yaml --format bundle --output design-system`
    )
    process.exit(1)
  }
  if (!force && (await isOccupied(outputDir))) {
    printStderr(
      `Error: ${outputDir} is not empty.\n\n` +
        `  A bundle written over other files cannot be told apart from a clean export.\n` +
        `  Choose an empty or new directory, or pass --force to overwrite the bundle's own\n` +
        `  files there (other files are left in place).`
    )
    process.exit(1)
  }

  const started = performance.now()
  const { buildDesignSystemBundle } = await lazyImportIndex()
  const bundle = await buildDesignSystemBundle(app, source).catch((error: unknown) => {
    printStderr(
      `Error: The design system bundle could not be built.\n\n` +
        `  ${formatRuntimeError(error)}\n\n` +
        `  Nothing was written to ${outputDir}.`
    )
    return process.exit(1)
  })

  await mkdir(outputDir, { recursive: true })
  await Promise.all(bundle.files.map((file) => writeBundleFile(outputDir, file.path, file.bytes)))
  await writeBundleFile(outputDir, 'manifest.json', bundle.manifestBytes)

  bundle.notices.forEach((notice) => printStderr(notice))
  const seconds = ((performance.now() - started) / 1000).toFixed(1)
  const kitPages = bundle.manifest.files.filter(
    (file) => file.role === 'kit' && file.path.endsWith('.html')
  ).length
  const drawnPages = bundle.manifest.files.filter((file) => file.path.endsWith('.page.html'))
  console.log(
    `Design system bundle written to ${outputDir} ` +
      `(${bundle.files.length + 1} files, ${kitPages} kit pages, ` +
      `${source.pages === undefined ? '' : `${drawnPages.length} app pages, `}${seconds}s)`
  )
}
