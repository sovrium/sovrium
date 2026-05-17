/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Sovrium CLI - Agent template management commands
 *
 * Extracted from cli.ts to keep the main CLI file within line limits.
 */

import { readdir, mkdir, copyFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { Effect, Console } from 'effect'
import { agentsPath } from '@/infrastructure/utils/package-paths'

/**
 * Handle the 'agents list' command - list available agent templates
 */
const handleAgentsListCommand = async (): Promise<void> => {
  const agentsDir = agentsPath()
  const dirExists = await Bun.file(join(agentsDir, '.'))
    .exists()
    .catch(() => false)

  try {
    const files = await readdir(agentsDir)
    const agents = files
      .filter((f) => f.endsWith('.md') && f !== 'README.md')
      .map((f) => basename(f, '.md'))
      .toSorted()

    if (agents.length === 0) {
      Effect.runSync(Console.log('No agent templates found.'))
      return
    }

    Effect.runSync(Console.log('Available agent templates:\n'))

    agents.forEach((agent) => Effect.runSync(Console.log(`  ${agent}`)))
  } catch {
    if (!dirExists) {
      Effect.runSync(Console.error(`Error: Agents directory not found: ${agentsDir}`))
    } else {
      Effect.runSync(Console.error(`Error: Failed to read agents directory: ${agentsDir}`))
    }
    // eslint-disable-next-line functional/no-expression-statements
    process.exit(1)
  }
}

/**
 * Handle the 'agents install' command - copy agent template to .claude/agents/
 */
const handleAgentsInstallCommand = async (
  agentName?: string,
  targetPath?: string,
  force = false
): Promise<void> => {
  if (!agentName) {
    Effect.runSync(
      Console.error(
        'Error: No agent name specified\n\nUsage:\n  sovrium agents install <name> [--target <dir>]'
      )
    )
    // eslint-disable-next-line functional/no-expression-statements
    process.exit(1)
  }

  const agentsDir = agentsPath()
  const sourceFile = join(agentsDir, `${agentName}.md`)
  const sourceExists = await Bun.file(sourceFile).exists()

  if (!sourceExists) {
    Effect.runSync(Console.error(`Error: Agent "${agentName}" not found`))
    // eslint-disable-next-line functional/no-expression-statements
    process.exit(1)
  }

  const targetDir = targetPath || process.cwd()
  const destDir = join(targetDir, '.claude', 'agents')
  // eslint-disable-next-line functional/no-expression-statements
  await mkdir(destDir, { recursive: true })

  const destFile = join(destDir, `${agentName}.md`)
  const destExists = await Bun.file(destFile).exists()

  if (destExists && !force) {
    Effect.runSync(
      Console.error(
        `Error: Agent "${agentName}" already exists at ${destFile}. Use --force to overwrite.`
      )
    )
    // eslint-disable-next-line functional/no-expression-statements
    process.exit(1)
  }

  // eslint-disable-next-line functional/no-expression-statements
  await copyFile(sourceFile, destFile)

  Effect.runSync(Console.log(`Installed agent "${agentName}" to ${destFile}`))
}

/**
 * Handle the 'agents' command - dispatch to list or install subcommand
 */
export const handleAgentsCommand = async (
  subcommand?: string,
  agentName?: string,
  targetPath?: string,
  force = false
): Promise<void> => {
  if (subcommand === 'list') {
    // eslint-disable-next-line functional/no-expression-statements
    await handleAgentsListCommand()
    return
  }

  if (subcommand === 'install') {
    // eslint-disable-next-line functional/no-expression-statements
    await handleAgentsInstallCommand(agentName, targetPath, force)
    return
  }

  Effect.runSync(
    Console.error(
      'Error: Unknown agents subcommand\n\nUsage:\n  sovrium agents list                    List available agent templates\n  sovrium agents install <name>          Install an agent template'
    )
  )
  // eslint-disable-next-line functional/no-expression-statements
  process.exit(1)
}
