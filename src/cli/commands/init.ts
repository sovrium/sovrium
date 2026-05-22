/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { Effect, Console } from 'effect'
import { embeddedExamplePath } from '@/infrastructure/assets/embedded-static-assets'

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

const sanitizeAppName = (dirName: string): string => {
  const sanitized = dirName
    .toLowerCase()
    .replace(/[^a-z0-9-._~]/g, '-')
    .replace(/^[._-]+/, '')
    .replace(/-+/g, '-')
    .replace(/-$/, '')
  return sanitized.length > 0 ? sanitized : 'my-app'
}

const generateDefaultAppYaml = (appName: string): string =>
  [`name: ${sanitizeAppName(appName)}`, `description: A Sovrium application`, ''].join('\n')

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

const writeScaffoldFiles = async (targetDir: string, appYamlContent: string): Promise<string> => {
  const targetPath = join(targetDir, 'app.yaml')
  const appName = basename(targetDir)
  await writeFile(targetPath, appYamlContent)
  await writeFile(join(targetDir, 'CLAUDE.md'), generateClaudeMd(appName))
  return targetPath
}

const resolveTemplate = (templateName: string): string => {
  const exampleFile = TEMPLATE_MAP[templateName]
  if (!exampleFile) {
    Effect.runSync(
      Console.error(
        `Error: Unknown template "${templateName}" — does not exist\n\nAvailable templates: ` +
          Object.keys(TEMPLATE_MAP).join(', ')
      )
    )
    process.exit(1)
  }

  const srcPath = embeddedExamplePath(exampleFile)
  if (srcPath === undefined) {
    Effect.runSync(Console.error(`Error: Template file not found: ${exampleFile}`))
    process.exit(1)
  }

  return srcPath
}

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

  if (!forceFlag) {
    const exists = await Bun.file(targetPath).exists()
    if (exists) {
      Effect.runSync(
        Console.error(`Error: ${targetPath} already exists (use --force to overwrite)`)
      )
      process.exit(1)
    }
  }

  await mkdir(targetDir, { recursive: true })

  if (templateName) {
    const srcPath = resolveTemplate(templateName)
    await Bun.write(targetPath, Bun.file(srcPath))
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
