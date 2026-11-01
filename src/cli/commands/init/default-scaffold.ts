/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `sovrium init` with no template: a starter config named after the directory,
 * the project's `CLAUDE.md`, and under `--typescript` the files that make a
 * typed config check. The strategy is chosen in `init.ts`.
 */

import { writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { CLAUDE_MD_BODY } from '@/cli/commands/init/scaffold-content'
import { writeConfigTypesFiles } from '@/cli/commands/types'

/**
 * Sanitize a directory name into a valid npm package name for use in app.yaml.
 * Converts to lowercase, replaces invalid characters with hyphens,
 * strips leading dots/underscores/hyphens, and falls back to 'my-app'.
 */
const sanitizeAppName = (dirName: string): string => {
  const sanitized = dirName
    .toLowerCase()
    .replace(/[^a-z0-9-._~]/g, '-')
    .replace(/^[._-]+/, '')
    .replace(/-+/g, '-')
    .replace(/-$/, '')
  return sanitized.length > 0 ? sanitized : 'my-app'
}

/**
 * Generate default app.yaml content using the directory name as the app name
 */
const generateDefaultAppYaml = (appName: string): string =>
  [`name: ${sanitizeAppName(appName)}`, `description: A Sovrium application`, ''].join('\n')

/**
 * Generate the default `app.ts` for `sovrium init --typescript`.
 *
 * The import is TYPE-ONLY and the object is checked with `satisfies` — never a
 * `defineConfig()` value import. The binary leaves bare-package specifiers
 * unresolved, so a value import would type-check and then fail at boot, whereas
 * `import type` is erased at transpile time and never resolved at all. That is
 * why the emitted declaration exports no runtime value either.
 *
 * `satisfies` over an `AppConfig` annotation: it validates the literal against
 * the type WITHOUT widening it, so the export keeps its precise shape and a
 * misspelled property is still an excess-property error.
 *
 * `sanitizeAppName` restricts the name to `[a-z0-9-._~]`, so no quote escaping
 * is required in the emitted single-quoted string.
 */
const generateDefaultAppTs = (appName: string): string =>
  [
    "import type { AppConfig } from 'sovrium'",
    '',
    'export default {',
    `  name: '${sanitizeAppName(appName)}',`,
    "  description: 'A Sovrium application',",
    '} satisfies AppConfig',
    '',
  ].join('\n')

/**
 * Generate `CLAUDE.md` content for a scaffolded sovrium project (title + body).
 */
export const generateClaudeMd = (appName: string): string => `# ${appName}\n\n${CLAUDE_MD_BODY}`

/**
 * Write scaffold files (the config file + CLAUDE.md) to the target directory.
 *
 * `configFilename` is `app.yaml` by default and `app.ts` under `--typescript`.
 * Exactly ONE of them is written: `DEFAULT_CONFIG_FILENAMES` resolves
 * `app.yaml` before `app.ts`, so scaffolding both would leave the typed config
 * permanently shadowed — edited by its author and never read by the runtime.
 */
const writeScaffoldFiles = async (
  targetDir: string,
  configFilename: string,
  configContent: string
): Promise<string> => {
  const targetPath = join(targetDir, configFilename)
  const appName = basename(targetDir)
  await writeFile(targetPath, configContent)
  await writeFile(join(targetDir, 'CLAUDE.md'), generateClaudeMd(appName))
  return targetPath
}

/**
 * The no-template scaffold: a config file and CLAUDE.md — and,
 * under `--typescript`, the two files that make the typed config check.
 *
 * `sovrium.d.ts` + `tsconfig.json` are written here rather than left to a
 * follow-up `sovrium types` so the scaffolded directory type-checks and
 * validates on the first try. Emitting `app.ts` alone would hand the author a
 * config whose very first line — `import type { AppConfig } from 'sovrium'` —
 * is an unresolved-module error.
 */
export const scaffoldDefault = async (
  targetDir: string,
  appName: string | undefined,
  typescript: boolean
): Promise<readonly string[]> => {
  const resolvedName = appName || basename(targetDir)
  const createdPath = typescript
    ? await writeScaffoldFiles(targetDir, 'app.ts', generateDefaultAppTs(resolvedName))
    : await writeScaffoldFiles(targetDir, 'app.yaml', generateDefaultAppYaml(resolvedName))

  const typesFiles = typescript ? await writeConfigTypesFiles(targetDir) : undefined
  const typesPaths = typesFiles
    ? [typesFiles.declarationPath, ...(typesFiles.tsconfigWritten ? [typesFiles.tsconfigPath] : [])]
    : []

  return [createdPath, ...typesPaths]
}
