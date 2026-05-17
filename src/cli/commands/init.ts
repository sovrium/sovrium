/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { mkdir, writeFile, copyFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { Effect, Console } from 'effect'
import { examplesPath } from '@/infrastructure/utils/package-paths'

/**
 * Template name -> example file mapping
 */
const TEMPLATE_MAP: Readonly<Record<string, string>> = {
  blog: 'hello-world.yaml',
  'hello-world': 'hello-world.yaml',
  crud: 'crud-app.yaml',
  'crud-app': 'crud-app.yaml',
  api: 'api-only.yaml',
  'api-only': 'api-only.yaml',
  landing: 'landing-page.yaml',
  'landing-page': 'landing-page.yaml',
}

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
 * Generate default CLAUDE.md content for a sovrium project
 */
const generateClaudeMd = (appName: string): string =>
  [
    `# ${appName}`,
    '',
    'This is a sovrium application.',
    '',
    '## Getting Started',
    '',
    '```bash',
    'sovrium start app.yaml',
    '```',
    '',
  ].join('\n')

/**
 * Write scaffold files (app.yaml + CLAUDE.md) to the target directory
 */
const writeScaffoldFiles = async (targetDir: string, appYamlContent: string): Promise<string> => {
  const targetPath = join(targetDir, 'app.yaml')
  const appName = basename(targetDir)
  // eslint-disable-next-line functional/no-expression-statements
  await writeFile(targetPath, appYamlContent)
  // eslint-disable-next-line functional/no-expression-statements
  await writeFile(join(targetDir, 'CLAUDE.md'), generateClaudeMd(appName))
  return targetPath
}

/**
 * Resolve and validate template, returning the source file path
 */
const resolveTemplate = async (templateName: string): Promise<string> => {
  const exampleFile = TEMPLATE_MAP[templateName]
  if (!exampleFile) {
    Effect.runSync(
      Console.error(
        `Error: Unknown template "${templateName}" — does not exist\n\nAvailable templates: ` +
          Object.keys(TEMPLATE_MAP).join(', ')
      )
    )
    // eslint-disable-next-line functional/no-expression-statements
    process.exit(1)
  }

  const srcPath = join(examplesPath(), exampleFile)
  const srcExists = await Bun.file(srcPath).exists()
  if (!srcExists) {
    Effect.runSync(Console.error(`Error: Template file not found: ${srcPath}`))
    // eslint-disable-next-line functional/no-expression-statements
    process.exit(1)
  }

  return srcPath
}

/**
 * Handle the 'init' command - scaffold a new project from a template or defaults
 */
export interface InitCommandOptions {
  readonly templateName?: string
  readonly outputDir?: string
  readonly positionalDir?: string
  readonly forceFlag?: boolean
  readonly appName?: string
}

export const handleInitCommand = async (options: InitCommandOptions = {}): Promise<void> => {
  const { templateName, outputDir, positionalDir, forceFlag = false, appName } = options
  const targetDir = positionalDir || outputDir || process.cwd()
  const targetPath = join(targetDir, 'app.yaml')

  // Check if app.yaml already exists (unless --force)
  if (!forceFlag) {
    const exists = await Bun.file(targetPath).exists()
    if (exists) {
      Effect.runSync(
        Console.error(`Error: ${targetPath} already exists (use --force to overwrite)`)
      )
      // eslint-disable-next-line functional/no-expression-statements
      process.exit(1)
    }
  }

  // eslint-disable-next-line functional/no-expression-statements
  await mkdir(targetDir, { recursive: true })

  if (templateName) {
    const srcPath = await resolveTemplate(templateName)
    // eslint-disable-next-line functional/no-expression-statements
    await copyFile(srcPath, targetPath)
    // eslint-disable-next-line functional/no-expression-statements
    await writeFile(join(targetDir, 'CLAUDE.md'), generateClaudeMd(basename(targetDir)))

    Effect.runSync(Console.log(`Created ${targetPath} from template "${templateName}"`))
  } else {
    const createdPath = await writeScaffoldFiles(
      targetDir,
      generateDefaultAppYaml(appName || basename(targetDir))
    )

    Effect.runSync(Console.log(`Created ${createdPath}`))
  }
}
