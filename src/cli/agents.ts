/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { Effect, Console } from 'effect'
import {
  embeddedAgentNames,
  embeddedAgentPath,
} from '@/infrastructure/assets/embedded-static-assets'

const handleAgentsListCommand = (): void => {
  const agents = embeddedAgentNames()

  if (agents.length === 0) {
    Effect.runSync(Console.log('No agent templates found.'))
    return
  }

  Effect.runSync(Console.log('Available agent templates:\n'))
  agents.forEach((agent) => Effect.runSync(Console.log(`  ${agent}`)))
}

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
    process.exit(1)
  }

  const sourceFile = embeddedAgentPath(agentName)

  if (sourceFile === undefined) {
    Effect.runSync(Console.error(`Error: Agent "${agentName}" not found`))
    process.exit(1)
  }

  const targetDir = targetPath || process.cwd()
  const destDir = join(targetDir, '.claude', 'agents')
  await mkdir(destDir, { recursive: true })

  const destFile = join(destDir, `${agentName}.md`)
  const destExists = await Bun.file(destFile).exists()

  if (destExists && !force) {
    Effect.runSync(
      Console.error(
        `Error: Agent "${agentName}" already exists at ${destFile}. Use --force to overwrite.`
      )
    )
    process.exit(1)
  }

  await Bun.write(destFile, Bun.file(sourceFile))

  Effect.runSync(Console.log(`Installed agent "${agentName}" to ${destFile}`))
}

const AGENTS_HELP_TEXT = [
  'Sovrium CLI — agent template management',
  '',
  'Usage:',
  '  sovrium agents list                       List available agent templates',
  '  sovrium agents add <name>                 Install an agent template (alias: install)',
  '  sovrium agents install <name>             Install an agent template',
  '',
  'Options for `agents add` / `agents install`:',
  '  --target <dir>                            Install destination (default: cwd)',
  '  --force                                   Overwrite an existing agent file',
  '',
  'Examples:',
  '  sovrium agents list',
  '  sovrium agents add crud-editor',
  '  sovrium agents add crud-editor --target ./my-project --force',
].join('\n')

const showAgentsHelp = (): void => {
  Effect.runSync(Console.log(AGENTS_HELP_TEXT))
}

export interface AgentsCommandOptions {
  readonly helpRequested?: boolean
}

export const handleAgentsCommand = async (
  subcommand?: string,
  agentName?: string,
  targetPath?: string,
  force = false,
  options?: Readonly<AgentsCommandOptions>
): Promise<void> => {
  if (options?.helpRequested) {
    showAgentsHelp()
    return
  }

  if (subcommand === 'list') {
    handleAgentsListCommand()
    return
  }

  if (subcommand === 'install' || subcommand === 'add') {
    await handleAgentsInstallCommand(agentName, targetPath, force)
    return
  }

  Effect.runSync(
    Console.error(
      'Error: Unknown agents subcommand\n\nUsage:\n  sovrium agents list                    List available agent templates\n  sovrium agents add <name>              Install an agent template\n  sovrium agents install <name>          Install an agent template (alias of add)'
    )
  )
  process.exit(1)
}
