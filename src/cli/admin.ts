/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Sovrium CLI - Admin user management commands
 *
 * `sovrium admin create <email>` provisions an admin account against the
 * configured database. Schema-optional by design: the operator does NOT need
 * to carry an `app.yaml` around just to create an admin. Resolution order:
 *
 *   1. Explicit `--config <path>` (when provided) — useful for multi-app
 *      operators who want admin credentials scoped to a specific schema's
 *      `app.auth` (e.g. custom default role).
 *   2. `APP_SCHEMA` env var — same idea, schema-driven auth config.
 *   3. **Neither provided** — fall through to a minimal in-memory app
 *      (`name: 'sovrium-admin-cli'`, `auth: { strategies: [emailAndPassword] }`)
 *      and run against the active database (DATABASE_URL or the default
 *      SQLite file at `./.sovrium/database.db`). The password policy applies
 *      (8–128 chars, enforced by the `buildAuthHooks` before-hook).
 *
 * This command explicitly assigns the admin role — there is no implicit
 * "first user becomes admin" behaviour anywhere in the stack. The only other
 * routes to `role='admin'` are the `AUTH_ADMIN_EMAIL`/`AUTH_ADMIN_PASSWORD`
 * boot bootstrap, `POST /api/auth/admin/set-role` called by an existing admin,
 * and a direct database write.
 *
 * Password input:
 *   - `--password <value>` is used when supplied (scripting / CI).
 *   - Otherwise the operator is prompted interactively with echo disabled,
 *     so the secret never lands in shell history. A non-interactive shell
 *     (no TTY) without `--password` is an error.
 *
 * Heavy modules (`@/index`, `@/presentation/cli`) are lazy-imported so the
 * native dependency graph is not loaded for lightweight commands.
 */

import { createInterface } from 'node:readline'
import { Writable } from 'node:stream'
import { Effect, Console } from 'effect'
import type { AppEncoded } from '@/domain/models/app'

/** Options forwarded from the CLI dispatcher. */
export interface AdminCommandOptions {
  readonly configFile?: string
  readonly password?: string
}

/**
 * Minimal in-memory app config used when the operator runs
 * `sovrium admin create <email>` without supplying a schema file. Carries
 * just enough to satisfy `AppSchema` and trigger `app.auth`-driven layer
 * wiring (admin plugin, Better Auth defaults).
 *
 * Mirrors the AUTH_SECRET / DATABASE_URL operator contract — neither is
 * declared here; both are read from env at runtime exactly like
 * `sovrium start`.
 */
const minimalAdminCliApp: AppEncoded = {
  name: 'sovrium-admin-cli',
  auth: { strategies: [{ type: 'emailAndPassword' }] },
}

/**
 * Resolve the operator-supplied schema, or return the schema-less default.
 *
 * Schema loading is best-effort: if a config path / `APP_SCHEMA` env var IS
 * provided we honor it (operators with multi-app setups care about which
 * `app.auth` block applies); otherwise we silently fall through to the
 * minimal default so the bare `sovrium admin create <email>` flow works.
 */
const loadAppSchemaOptional = async (configFile: string | undefined): Promise<AppEncoded> => {
  // No explicit file, no env var → schema-less default. Skip the schema-loader
  // path entirely so `showNoConfigError('start')` cannot fire here.
  if (!configFile && !Bun.env.APP_SCHEMA) {
    return minimalAdminCliApp
  }
  const { parseAppSchema } = await import('@/presentation/cli')
  return parseAppSchema('admin create', configFile)
}

/**
 * Read a password interactively without echoing it to the terminal.
 *
 * Only called when `--password` was NOT supplied and stdin is a TTY.
 *
 * Readline's keystroke echo is routed into a sink that discards every write,
 * so the password is never displayed (like `sudo`). The prompt label is
 * written to stderr directly — stdout stays clean for redirect-safety. No
 * mutable echo flag is needed because the output stream itself swallows echo.
 */
const promptHiddenPassword = async (): Promise<string> => {
  const silentOutput = new Writable({
    write: (_chunk, _encoding, callback) => callback(),
  })
  const rl = createInterface({ input: process.stdin, output: silentOutput, terminal: true })

  // eslint-disable-next-line functional/no-expression-statements -- interactive prompt label
  process.stderr.write('Admin password: ')

  try {
    return await new Promise<string>((resolve, reject) => {
      rl.question('', resolve)
      // eslint-disable-next-line functional/no-expression-statements -- cancel on Ctrl-C
      rl.once('SIGINT', () => reject(new Error('Password entry cancelled')))
    })
  } finally {
    rl.close()
    // eslint-disable-next-line functional/no-expression-statements -- newline after the (hidden) entry
    process.stderr.write('\n')
  }
}

/**
 * Resolve the admin password from the --password flag or an interactive prompt.
 * Errors (and exits 1) when no flag is given and stdin is not interactive.
 */
const resolvePassword = async (flagPassword?: string): Promise<string> => {
  if (flagPassword !== undefined && flagPassword.length > 0) {
    return flagPassword
  }

  if (!process.stdin.isTTY) {
    Effect.runSync(
      Console.error(
        'Error: No password provided.\n\n' +
          'Pass --password <value>, or run this command in a terminal to be prompted.'
      )
    )
    // eslint-disable-next-line functional/no-expression-statements -- CLI error exit
    process.exit(1)
  }

  return promptHiddenPassword()
}

/**
 * Handle the 'admin create' command.
 */
const handleAdminCreateCommand = async (
  email: string | undefined,
  options: AdminCommandOptions
): Promise<void> => {
  if (!email) {
    Effect.runSync(
      Console.error(
        'Error: No email specified.\n\nUsage:\n  sovrium admin create <email> [config] [--password <value>]'
      )
    )
    // eslint-disable-next-line functional/no-expression-statements -- CLI error exit
    process.exit(1)
  }

  const password = await resolvePassword(options.password)

  const app = await loadAppSchemaOptional(options.configFile)
  const { createAdmin } = await import('@/index')

  const result = await createAdmin(app, { email, password })

  if (!result.ok) {
    // When the message is a generic database-driver failure (ECONNREFUSED,
    // SQLITE_CANTOPEN, ENOENT against the DB file) we replace it with an
    // actionable diagnostic — operators bare-running `admin create` without
    // a DB shouldn't see a raw Postgres / SQLite error stack.
    Effect.runSync(Console.error(rewriteDbUnreachable(result.message)))
    // eslint-disable-next-line functional/no-expression-statements -- CLI error exit
    process.exit(1)
  }

  Effect.runSync(
    Console.log(
      // Identifiers print bare: the startup banner already renders
      // `Admin: user@example.com` without quotes, and quoting is a weight
      // channel a monochrome terminal does not have.
      result.created
        ? `Created admin user ${result.email}.\n\nSign in with this address once the server is running.`
        : `Admin user ${result.email} already exists — nothing was changed.`
    )
  )
}

/**
 * Lower-cased fragments from the database driver layer that indicate the
 * connection itself failed (as opposed to a logical bootstrap error). When
 * any of these match, we replace the raw stack-trace-flavoured message with
 * an actionable diagnostic — the bare `sovrium admin create <email>` flow is
 * meant to feel forgiving, not expose driver internals.
 */
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

/**
 * Turn a low-level DB-driver error message into a clean operator-facing
 * diagnostic. Pass-through for any non-connectivity failure (weak password,
 * invalid email, duplicate user, …) so domain-level rejections still
 * surface verbatim.
 */
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

/**
 * Handle the 'admin' command - dispatch to the 'create' verb.
 */
export const handleAdminCommand = async (
  subcommand: string | undefined,
  email: string | undefined,
  options: AdminCommandOptions = {}
): Promise<void> => {
  if (subcommand !== 'create') {
    Effect.runSync(
      Console.error(
        `Error: Unknown admin subcommand "${subcommand ?? ''}".\n\n` +
          'Usage:\n  sovrium admin create <email> [config]   Create an admin user'
      )
    )
    // eslint-disable-next-line functional/no-expression-statements -- CLI error exit
    process.exit(1)
  }

  // eslint-disable-next-line functional/no-expression-statements -- CLI command execution
  await handleAdminCreateCommand(email, options)
}
