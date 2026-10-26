/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `--help` text for `init` and for the `admin` verbs, registered by
 * `command-help.ts`, which stays under its line ceiling that way.
 *
 * `admin` is a noun-verb command: `admin create --help` and
 * `admin reset-password --help` each answer with their own text, keyed by the
 * verb in `ADMIN_VERB_HELP`.
 */

export const INIT_HELP_TEXT = [
  'Usage: sovrium init [dir] [options]',
  '',
  'Scaffold a new Sovrium project (app.yaml, .gitignore, .env.example, public/).',
  'Writes into [dir] when given, otherwise the current directory.',
  '',
  'Arguments:',
  '  dir                           Target directory (default: current directory)',
  '',
  'Options:',
  '  --template <name>             Bundled template, or <owner>/<repo>[#ref] from GitHub',
  '  --from-url <url>              Fork one published YAML or JSON config over HTTPS',
  '  --from-bundle <source>        Open an archive written by `sovrium bundle` (an https:',
  '                                link, a file: URL or a path) as a new project',
  '  --inspect                     With --from-bundle: check the bundle, print it as JSON,',
  '                                write no project',
  '  --expect-sha256 <hex>         With --from-bundle: refuse an archive with another sha256',
  '  --with-demo-data              With --from-bundle: create admin@localhost.sovrium, print',
  '                                its random password once as JSON, and load seed/',
  '  --name <name>                 App name written into the generated config',
  '  --typescript                  Scaffold a typed app.ts (plus sovrium.d.ts + tsconfig.json)',
  '                                instead of app.yaml — see `sovrium types`',
  '  --git                         Initialise a git repository and commit the scaffold',
  '  --force                       Overwrite existing files',
  '  --help, -h                    Show this help message',
  '',
  'Examples:',
  '  sovrium init                                       # Scaffold into the current directory',
  '  sovrium init ./my-app --typescript                 # Scaffold a typed app.ts',
  '  sovrium init ./my-app --template blog              # Scaffold from a bundled template',
  '  sovrium init ./my-app --template sovrium/crm-template  # Scaffold from a GitHub repo',
  '  sovrium init ./crm --from-url https://example.com/starters/crm.yaml  # Fork one config',
  '  sovrium init --from-bundle ./downloads/crm.tar.gz ./crm             # Open a bundle',
].join('\n')

export const ADMIN_HELP_TEXT = [
  'Usage: sovrium admin create <email> [config] [options]',
  '',
  "Create an admin user in the configured database ('admin reset-password <email>' resets one).",
  'The password is prompted for unless --password is supplied.',
  'The account is named after --name, else AUTH_ADMIN_NAME, else "Administrator".',
  '',
  'Arguments:',
  '  email                         Email address of the admin to create',
  '  config                        Path to config file (.json, .yaml, .yml, .ts)',
  '',
  'Options:',
  '  --password <value>            Admin password (for scripting / CI; else prompted)',
  '  --name <name>                 Display name of the new admin',
  '  --help, -h                    Show this help message',
  '',
  'Examples:',
  '  sovrium admin create me@example.com app.yaml',
].join('\n')

const ADMIN_RESET_PASSWORD_HELP_TEXT = [
  'Usage: sovrium admin reset-password <email> [config] [options]',
  '',
  'Give an existing account a new random password when the old one is lost, and sign',
  'every session of that account out. The password is printed ONCE, as one line of',
  'JSON on stdout ({"email","password"}); only its hash is stored. It runs against',
  "the same database as 'admin create' and needs no running server.",
  '',
  'An address with no account exits 1, prints no password and creates nothing:',
  "use 'admin create' for that.",
  '',
  'Arguments:',
  '  email                         Email address of the account to reset',
  '  config                        Path to config file (.json, .yaml, .yml, .ts); its',
  '                                password policy can ask for a longer password',
  '',
  'Options:',
  '  --help, -h                    Show this help message',
  '',
  'Environment variables:',
  '  DATABASE_URL                  Postgres connection (omit → embedded SQLite)',
  '',
  'Examples:',
  '  sovrium admin reset-password admin@localhost.sovrium app.yaml',
].join('\n')

/** Per-verb `admin` help; a verb not listed (or none) answers with `create`'s. */
const ADMIN_VERB_HELP: Readonly<Record<string, string>> = {
  create: ADMIN_HELP_TEXT,
  'reset-password': ADMIN_RESET_PASSWORD_HELP_TEXT,
}

/** The `admin` help for `verb` — `create`'s when the verb has none of its own. */
export const getAdminHelp = (verb: string | undefined): string =>
  (verb === undefined ? undefined : ADMIN_VERB_HELP[verb]) ?? ADMIN_HELP_TEXT
