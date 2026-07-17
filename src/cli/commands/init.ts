/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { Effect, Console } from 'effect'
import {
  isRemoteTemplateRef,
  scaffoldFromRemoteTemplate,
} from '@/cli/commands/init-remote-template'
import { CLAUDE_MD_BODY, PUBLIC_README_BODY } from '@/cli/commands/init-scaffold-content'
import { ENV_EXAMPLE_CONTENT } from '@/cli/env-example-template'
import {
  embeddedAgentPath,
  embeddedTemplateDir,
} from '@/infrastructure/assets/embedded-static-assets'

interface TemplateEntry {
  readonly template: string
  readonly agent?: string
}

const TEMPLATE_MAP: Readonly<Record<string, TemplateEntry>> = {
  'hello-world': { template: 'hello-world' },
  'landing-page': { template: 'landing-page', agent: 'website-editor.md' },
  crm: { template: 'crm', agent: 'crm-editor.md' },
  'api-only': { template: 'api-only', agent: 'api-editor.md' },
  intranet: { template: 'intranet', agent: 'intranet-editor.md' },
  'mcp-server': { template: 'mcp-server', agent: 'mcp-editor.md' },
  blog: { template: 'blog', agent: 'blog-editor.md' },
  'docs-site': { template: 'docs-site' },
  projects: { template: 'projects', agent: 'app-editor.md' },
  helpdesk: { template: 'helpdesk', agent: 'app-editor.md' },
  'content-calendar': { template: 'content-calendar', agent: 'app-editor.md' },
  people: { template: 'people', agent: 'app-editor.md' },
  events: { template: 'events', agent: 'app-editor.md' },
  assets: { template: 'assets', agent: 'app-editor.md' },
  expenses: { template: 'expenses', agent: 'app-editor.md' },
  'company-os': { template: 'company-os', agent: 'app-editor.md' },
  'automation-recipes': { template: 'automation-recipes', agent: 'app-editor.md' },
  'knowledge-base': { template: 'knowledge-base', agent: 'app-editor.md' },
  api: { template: 'api-only', agent: 'api-editor.md' },
  landing: { template: 'landing-page', agent: 'website-editor.md' },
}

const WEB_FACING_TEMPLATE_NAMES: ReadonlySet<string> = new Set([
  'hello-world',
  'landing-page',
  'crm',
  'intranet',
  'blog',
  'docs-site',
  'projects',
  'helpdesk',
  'content-calendar',
  'people',
  'events',
  'assets',
  'expenses',
  'company-os',
  'automation-recipes',
  'knowledge-base',
])

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

const generateGitignore = (): string =>
  [
    '# Sovrium runtime data (SQLite database, server lock file, file uploads).',
    '# Relocatable via the SOVRIUM_DATA_DIR env var.',
    '.sovrium/',
    '',
    '# Environment variables (may contain secrets)',
    '.env',
    '.env.local',
    '',
  ].join('\n')

const writeGitignoreIfMissing = async (targetDir: string): Promise<boolean> => {
  const gitignorePath = join(targetDir, '.gitignore')
  if (await Bun.file(gitignorePath).exists()) return false
  await writeFile(gitignorePath, generateGitignore())
  return true
}

const writePublicDirIfMissing = async (targetDir: string): Promise<readonly string[]> => {
  const publicDir = join(targetDir, 'public')
  await mkdir(publicDir, { recursive: true })

  const gitkeepPath = join(publicDir, '.gitkeep')
  const readmePath = join(publicDir, 'README.md')
  const [wroteGitkeep, wroteReadme] = await Promise.all([
    Bun.file(gitkeepPath)
      .exists()
      .then(async (exists) => {
        if (exists) return false
        await writeFile(gitkeepPath, '')
        return true
      }),
    Bun.file(readmePath)
      .exists()
      .then(async (exists) => {
        if (exists) return false
        await writeFile(readmePath, PUBLIC_README_BODY)
        return true
      }),
  ])
  return [...(wroteGitkeep ? [gitkeepPath] : []), ...(wroteReadme ? [readmePath] : [])]
}

const writeEnvExampleIfMissing = async (targetDir: string): Promise<boolean> => {
  const envExamplePath = join(targetDir, '.env.example')
  if (await Bun.file(envExamplePath).exists()) return false
  await writeFile(envExamplePath, ENV_EXAMPLE_CONTENT)
  return true
}

const generateClaudeMd = (appName: string): string => `# ${appName}\n\n${CLAUDE_MD_BODY}`

const writeScaffoldFiles = async (targetDir: string, appYamlContent: string): Promise<string> => {
  const targetPath = join(targetDir, 'app.yaml')
  const appName = basename(targetDir)
  await writeFile(targetPath, appYamlContent)
  await writeFile(join(targetDir, 'CLAUDE.md'), generateClaudeMd(appName))
  return targetPath
}

const resolveTemplate = (templateName: string): TemplateEntry => {
  const entry = TEMPLATE_MAP[templateName]
  if (entry === undefined) {
    Effect.runSync(
      Console.error(
        `Error: Unknown template "${templateName}" — does not exist\n\nAvailable templates: ` +
          Object.keys(TEMPLATE_MAP).join(', ')
      )
    )
    process.exit(1)
  }

  const tree = embeddedTemplateDir(entry.template)
  if (Object.keys(tree).length === 0) {
    Effect.runSync(
      Console.error(`Error: Template directory has no embedded files: ${entry.template}`)
    )
    process.exit(1)
  }

  return entry
}

const writeOneTreeFile = async (
  srcEmbeddedPath: string,
  destAbsPath: string,
  clobber: boolean
): Promise<boolean> => {
  if (!clobber && (await Bun.file(destAbsPath).exists())) return false
  await mkdir(dirname(destAbsPath), { recursive: true })
  await Bun.write(destAbsPath, Bun.file(srcEmbeddedPath))
  return true
}

const MIRROR_ONLY_FILES: ReadonlySet<string> = new Set(['README.md', 'LICENSE'])

const copyTemplateTree = async (
  templateName: string,
  targetDir: string,
  forceFlag: boolean
): Promise<readonly string[]> => {
  const tree = embeddedTemplateDir(templateName)
  const relPaths = Object.keys(tree)
    .filter((relPath) => !MIRROR_ONLY_FILES.has(relPath))
    .toSorted()
  const written = await Promise.all(
    relPaths.map((relPath) => {
      const clobber = forceFlag && relPath === 'app.yaml'
      return writeOneTreeFile(tree[relPath]!, join(targetDir, relPath), clobber)
    })
  )
  return relPaths.filter((_, i) => written[i] === true)
}

export interface InitCommandOptions {
  readonly templateName?: string
  readonly outputDir?: string
  readonly positionalDir?: string
  readonly forceFlag?: boolean
  readonly skipAgent?: boolean
  readonly appName?: string
}

const installPairedAgent = async (
  entry: TemplateEntry,
  targetDir: string,
  skipAgent: boolean
): Promise<void> => {
  if (skipAgent || entry.agent === undefined) return

  const agentBasename = entry.agent.replace(/\.md$/, '')
  const sourcePath = embeddedAgentPath(agentBasename)
  if (sourcePath === undefined) {
    Effect.runSync(
      Console.error(`Warning: paired agent "${entry.agent}" not embedded — skipping agent install`)
    )
    return
  }

  const agentsDir = join(targetDir, '.claude', 'agents')
  await mkdir(agentsDir, { recursive: true })

  const destPath = join(agentsDir, entry.agent)
  await Bun.write(destPath, Bun.file(sourcePath))
  Effect.runSync(Console.log(`Installed agent ${destPath}`))
}

const scaffoldFromTemplate = async (
  templateName: string,
  targetDir: string,
  skipAgent: boolean,
  forceFlag: boolean
): Promise<void> => {
  const entry = resolveTemplate(templateName)
  const relPaths = await copyTemplateTree(entry.template, targetDir, forceFlag)
  await writeFile(join(targetDir, 'CLAUDE.md'), generateClaudeMd(basename(targetDir)))
  Effect.runSync(
    Console.log(
      `Created ${targetDir}/ from template "${templateName}" (${relPaths.length} file${relPaths.length === 1 ? '' : 's'})`
    )
  )
  await installPairedAgent(entry, targetDir, skipAgent)
}

const scaffoldDefault = async (targetDir: string, appName: string | undefined): Promise<void> => {
  const createdPath = await writeScaffoldFiles(
    targetDir,
    generateDefaultAppYaml(appName || basename(targetDir))
  )
  Effect.runSync(Console.log(`Created ${createdPath}`))
}

const assertNoConflict = async (targetPath: string, forceFlag: boolean): Promise<void> => {
  if (forceFlag) return
  const exists = await Bun.file(targetPath).exists()
  if (!exists) return
  Effect.runSync(Console.error(`Error: ${targetPath} already exists (use --force to overwrite)`))
  process.exit(1)
}

export const handleInitCommand = async (options: InitCommandOptions = {}): Promise<void> => {
  const {
    templateName,
    outputDir,
    positionalDir,
    forceFlag = false,
    skipAgent = false,
    appName,
  } = options
  const targetDir = positionalDir || outputDir || process.cwd()

  await assertNoConflict(join(targetDir, 'app.yaml'), forceFlag)
  await mkdir(targetDir, { recursive: true })

  if (templateName && isRemoteTemplateRef(templateName)) {
    await scaffoldFromRemoteTemplate(templateName, targetDir, forceFlag)
  } else if (templateName) {
    await scaffoldFromTemplate(templateName, targetDir, skipAgent, forceFlag)
  } else {
    await scaffoldDefault(targetDir, appName)
  }

  const isWebFacing =
    templateName === undefined ||
    (() => {
      const entry = TEMPLATE_MAP[templateName]
      return entry !== undefined && WEB_FACING_TEMPLATE_NAMES.has(entry.template)
    })()
  await scaffoldSupportFiles(targetDir, isWebFacing)
}

const scaffoldSupportFiles = async (targetDir: string, isWebFacing: boolean): Promise<void> => {
  const wroteGitignore = await writeGitignoreIfMissing(targetDir)
  if (wroteGitignore) {
    Effect.runSync(Console.log(`Created ${join(targetDir, '.gitignore')}`))
  }

  const wroteEnvExample = await writeEnvExampleIfMissing(targetDir)
  if (wroteEnvExample) {
    Effect.runSync(Console.log(`Created ${join(targetDir, '.env.example')}`))
  }

  if (isWebFacing) {
    const publicCreated = await writePublicDirIfMissing(targetDir)
    publicCreated.forEach((path) => Effect.runSync(Console.log(`Created ${path}`)))
  }
}
