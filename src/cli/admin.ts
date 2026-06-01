/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { createInterface } from 'node:readline'
import { Writable } from 'node:stream'
import { Effect, Console } from 'effect'
import type { AppEncoded } from '@/domain/models/app'

export interface AdminCommandOptions {
  readonly configFile?: string
  readonly password?: string
}

const minimalAdminCliApp: AppEncoded = {
  name: 'sovrium-admin-cli',
  auth: { strategies: [{ type: 'emailAndPassword' }] },
}

const loadAppSchemaOptional = async (configFile: string | undefined): Promise<AppEncoded> => {
  if (!configFile && !Bun.env.APP_SCHEMA) {
    return minimalAdminCliApp
  }
  const { parseAppSchema } = await import('@/presentation/cli')
  return parseAppSchema('admin create', configFile)
}

const promptHiddenPassword = async (): Promise<string> => {
  const silentOutput = new Writable({
    write: (_chunk, _encoding, callback) => callback(),
  })
  const rl = createInterface({ input: process.stdin, output: silentOutput, terminal: true })

  process.stderr.write('Admin password: ')

  try {
    return await new Promise<string>((resolve, reject) => {
      rl.question('', resolve)
      rl.once('SIGINT', () => reject(new Error('Password entry cancelled')))
    })
  } finally {
    rl.close()
    process.stderr.write('\n')
  }
}

const resolvePassword = async (flagPassword?: string): Promise<string> => {
  if (flagPassword !== undefined && flagPassword.length > 0) {
    return flagPassword
  }

  if (!process.stdin.isTTY) {
    Effect.runSync(
      Console.error(
        'Error: No password provided. Pass --password <value> in a non-interactive shell, or run in a terminal to be prompted.'
      )
    )
    process.exit(1)
  }

  return promptHiddenPassword()
}

const handleAdminCreateCommand = async (
  email: string | undefined,
  options: AdminCommandOptions
): Promise<void> => {
  if (!email) {
    Effect.runSync(
      Console.error(
        'Error: No email specified\n\nUsage:\n  sovrium admin create <email> [config] [--password <value>]'
      )
    )
    process.exit(1)
  }

  const password = await resolvePassword(options.password)

  const app = await loadAppSchemaOptional(options.configFile)
  const { createAdmin } = await import('@/index')

  const result = await createAdmin(app, { email, password })

  if (!result.ok) {
    Effect.runSync(Console.error(rewriteDbUnreachable(result.message)))
    process.exit(1)
  }

  Effect.runSync(
    Console.log(
      result.created
        ? `Created admin user "${result.email}".`
        : `Admin user "${result.email}" already exists — no changes made.`
    )
  )
}

const DB_UNREACHABLE_FRAGMENTS: readonly string[] = [
  'econnrefused',
  'enotfound',
  'etimedout',
  'getaddrinfo',
  'sqlite_cantopen',
  'sqlite_busy',
  "couldn't connect",
  'unable to open',
  'permission denied',
]

const rewriteDbUnreachable = (rawMessage: string): string => {
  const lowered = rawMessage.toLowerCase()
  if (DB_UNREACHABLE_FRAGMENTS.some((fragment) => lowered.includes(fragment))) {
    return [
      'Error: cannot reach database',
      '',
      'Set DATABASE_URL or run from a directory containing ./.sovrium/database.db.',
      '',
      `Underlying error: ${rawMessage}`,
    ].join('\n')
  }
  return `Error: ${rawMessage}`
}

export const handleAdminCommand = async (
  subcommand: string | undefined,
  email: string | undefined,
  options: AdminCommandOptions = {}
): Promise<void> => {
  if (subcommand !== 'create') {
    Effect.runSync(
      Console.error(
        'Error: Unknown admin subcommand\n\nUsage:\n  sovrium admin create <email> [config]   Create an admin user'
      )
    )
    process.exit(1)
  }

  await handleAdminCreateCommand(email, options)
}
