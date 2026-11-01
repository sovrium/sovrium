/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Sovrium CLI - Admin user management commands
 *
 * `sovrium admin reset-password <email>` (below) recovers a lost password.
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
 *   - `--password-stdin` reads it from standard input (scripting / CI, and
 *     `sovrium dev`): a value on the command line is readable by any user of
 *     the machine in the process list, a value on stdin is not.
 *   - `--password <value>` is used when supplied.
 *   - Otherwise the operator is prompted interactively with echo disabled,
 *     so the secret never lands in shell history. A non-interactive shell
 *     (no TTY) without a password option is an error.
 *
 * Heavy modules (`@/index`, `@/cli/runtime/schema-loader`) are lazy-imported so the
 * native dependency graph is not loaded for lightweight commands.
 */

import { createInterface } from 'node:readline'
import { Writable } from 'node:stream'
import { writeStdout } from '@/cli/commands/document-output'
import { defineFlags, flag } from '@/cli/runtime/flag-schema'
import { stopCommand, withFlagsAsync } from '@/cli/runtime/run-command'
import { printLine } from '@/infrastructure/logging/cli-output'
import type { App, AppEncoded } from '@/domain/models/app'

/** Options forwarded from the CLI dispatcher. */
export interface AdminCommandOptions {
  readonly configFile?: string
  readonly password?: string
  /** `--password-stdin` — read the password from standard input. */
  readonly passwordStdin?: boolean
  /** `--name <name>` — the new account's display name, as typed (untrimmed). */
  readonly name?: string
}

/**
 * The display name a new admin gets: `--name` (trimmed) wins, then a
 * non-blank `AUTH_ADMIN_NAME` (the first-start bootstrap's own rule), then
 * `Administrator`. A `--name` holding nothing but whitespace is a mistake — an
 * unset shell variable, say — so it is refused (exit 1) before anything runs,
 * rather than silently read as "use the default".
 */
const resolveAdminName = (flagName: string | undefined): string => {
  if (flagName !== undefined) {
    const trimmed = flagName.trim()
    if (trimmed.length > 0) return trimmed
    return stopCommand(
      1,
      'Error: --name is empty.\n\n' +
        'Give the admin a display name, e.g. --name "Ines Moreau", or leave --name out\n' +
        'to use AUTH_ADMIN_NAME (else "Administrator").'
    )
  }
  const fromEnv = Bun.env.AUTH_ADMIN_NAME?.trim()
  return fromEnv !== undefined && fromEnv.length > 0 ? fromEnv : 'Administrator'
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
  const { parseAppSchema } = await import('@/cli/runtime/schema-loader')
  return parseAppSchema('admin create', configFile)
}

/** The config decoded as the engine reads it, or exit 1 with the validation report. */
const decodedApp = async (encoded: AppEncoded): Promise<App> => {
  const { decodeAppConfigObject } = await import('@/application/use-cases/config/decode-app-config')
  const decoded = decodeAppConfigObject(encoded)
  if (decoded.valid) return decoded.app
  return stopCommand(1, `Error: Validation failed.\n\n${decoded.report.join('\n')}`)
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

/**
 * The password piped to `--password-stdin`: all of standard input, with ONE
 * trailing newline (`\n` or `\r\n`, what `echo` adds) dropped. An empty
 * result, or `--password` beside it, exits 1 before anything is created.
 */
const readStdinPassword = async (flagPassword: string | undefined): Promise<string> => {
  if (flagPassword !== undefined) {
    return stopCommand(
      1,
      'Error: both --password and --password-stdin were given — no account was created.\n\n' +
        'Give the password one way only; --password-stdin keeps it off the command line.'
    )
  }
  const piped = (await Bun.stdin.text()).replace(/\r?\n$/, '')
  if (piped.length > 0) return piped
  return stopCommand(
    1,
    'Error: --password-stdin read an empty password — no account was created.\n\n' +
      'Pipe the password in, e.g. printf \'%s\' "$ADMIN_PASSWORD" | sovrium admin create <email> --password-stdin'
  )
}

/**
 * Resolve the admin password from `--password-stdin`, the --password flag or
 * an interactive prompt. Errors (and exits 1) when none is given and stdin is
 * not interactive.
 */
const resolvePassword = async (flagPassword?: string, fromStdin = false): Promise<string> => {
  if (fromStdin) return readStdinPassword(flagPassword)
  if (flagPassword !== undefined && flagPassword.length > 0) {
    return flagPassword
  }

  if (!process.stdin.isTTY) {
    return stopCommand(
      1,
      'Error: No password provided.\n\n' +
        'Pass --password-stdin and pipe it in, or run this command in a terminal to be prompted.'
    )
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
    return stopCommand(
      1,
      'Error: No email specified.\n\nUsage:\n  sovrium admin create <email> [config] [--password-stdin | --password <value>] [--name <name>]'
    )
  }

  const name = resolveAdminName(options.name)
  const password = await resolvePassword(options.password, options.passwordStdin === true)

  const app = await loadAppSchemaOptional(options.configFile)
  const { createAdmin } = await import('@/index')

  const result = await createAdmin(app, { email, password, name })

  if (!result.ok) {
    // A database that could not be REACHED (connection refused, unresolvable
    // host, unopenable SQLite file) gets an actionable diagnostic instead of a
    // raw driver stack — operators bare-running `admin create` without a DB
    // shouldn't have to read one. Classified by driver code upstream.
    return stopCommand(
      1,
      formatAdminCreateFailure(result.message, result.databaseUnreachable ?? false)
    )
  }

  printLine(
    // Identifiers print bare: the startup banner already renders
    // `Admin: user@example.com` without quotes, and quoting is a weight
    // channel a monochrome terminal does not have.
    result.created
      ? `Created admin user ${result.email}.\n\nSign in with this address once the server is running.`
      : `Admin user ${result.email} already exists — nothing was changed.`
  )
}

/**
 * Turn a database-driver failure into a clean operator-facing diagnostic.
 *
 * `unreachable` is decided upstream in `createAdmin`, by DRIVER CODE
 * (`isDatabaseUnreachable`), because that is the last place the error object
 * exists. Matching lower-cased fragments against the message here instead
 * would be wrong in both directions: it never fires for a real `bun:sql`
 * connection failure (whose entire message is `Failed to connect`), and it DOES
 * fire for `permission denied for table "user"` — a GRANT problem on a
 * perfectly reachable database — telling the operator to set `DATABASE_URL`.
 *
 * Pass-through for every other failure (weak password, invalid email,
 * duplicate user, …) so domain-level rejections still surface verbatim.
 */
const formatAdminCreateFailure = (rawMessage: string, unreachable: boolean): string =>
  unreachable
    ? [
        'Error: cannot reach database',
        '',
        'Set DATABASE_URL or run from a directory containing ./.sovrium/database.db.',
        '',
        `Underlying error: ${rawMessage}`,
      ].join('\n')
    : `Error: ${rawMessage}`

/**
 * Handle `admin reset-password <email> [config]`: a new random password for an
 * existing account, printed ONCE on stdout as `{"email","password"}` JSON and
 * stored nowhere but as its hash, and every session of the account signed out.
 * An address with no account exits 1 and creates nothing.
 */
const handleAdminResetPasswordCommand = async (
  email: string | undefined,
  options: AdminCommandOptions
): Promise<void> => {
  if (!email) {
    return stopCommand(
      1,
      'Error: No email specified.\n\nUsage:\n  sovrium admin reset-password <email> [config]'
    )
  }
  const app = await decodedApp(await loadAppSchemaOptional(options.configFile))
  const { resolvePasswordPolicy } = await import('@/domain/models/app/auth/password-policy')
  const { randomAccountPassword } = await import('@/cli/runtime/project-data')
  const password = randomAccountPassword(resolvePasswordPolicy(app.auth).minLength)
  const { resetPasswords } = await import('@/index')
  const [result] = await resetPasswords(app, [{ email, password }])
  if (result?.ok !== true) {
    return stopCommand(
      1,
      result !== undefined && 'unknownAccount' in result && result.unknownAccount === true
        ? `Error: ${result.message} Nothing was changed, and no account was created.\n\n` +
            `Create one with: sovrium admin create ${email}`
        : `Error: ${result?.message ?? 'The password was not reset.'}`
    )
  }
  await writeStdout(`${JSON.stringify({ email, password })}\n`)
}

/**
 * Handle the 'admin' command - dispatch to the 'create' or 'reset-password' verb.
 */
const runAdminCommand = async (
  subcommand: string | undefined,
  email: string | undefined,
  options: AdminCommandOptions = {}
): Promise<void> => {
  if (subcommand === 'reset-password') return handleAdminResetPasswordCommand(email, options)
  if (subcommand !== 'create') {
    return stopCommand(
      1,
      `Error: Unknown admin subcommand "${subcommand ?? ''}".\n\n` +
        'Usage:\n  sovrium admin create <email> [config]           Create an admin user\n' +
        '  sovrium admin reset-password <email> [config]   Set a new password, sign every session out'
    )
  }

  await handleAdminCreateCommand(email, options)
}

/** The flags `sovrium admin` reads beyond the shared ones. */
export const adminFlags = defineFlags({
  password: flag.value('--password'),
  passwordStdin: flag.switch('--password-stdin'),
})

/** Handle `sovrium admin <verb> <email>`. */
export const handleAdminCommand = withFlagsAsync(adminFlags, (args) =>
  runAdminCommand(args.subcommand, args.positionalArg, {
    configFile: args.configFile,
    password: args.flags.password,
    passwordStdin: args.flags.passwordStdin,
    name: args.appName,
  })
)
