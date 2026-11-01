/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The shape `parseArgs` hands the command table: which command was asked for,
 * its positional arguments, and the flags more than one verb reads. A flag only
 * one verb reads is declared in that verb's own schema (`defineFlags`) and
 * reaches it as `args.flags`.
 */

export interface ParsedArgs {
  readonly command: string
  readonly configFile?: string
  readonly watchMode: boolean
  readonly outputPath?: string
  readonly templateName?: string
  readonly subcommand?: string
  readonly appName?: string
  readonly forceFlag: boolean
  /**
   * Static-asset directory for `start` / `build`.
   *
   * - `string`    — explicit path from `--publicDir <path>`.
   * - `false`     — explicit opt-out from `--no-publicDir`. Suppresses both
   *                 the env-var fallback AND the anchored `./public` default.
   * - `undefined` — no flag; caller falls back to env → anchored default.
   */
  readonly publicDir?: string | false
  /** Third positional arg for noun-verb commands (e.g. `admin create <email>`, `secret generate <scope>`). */
  readonly positionalArg?: string
  /**
   * `--help`/`-h` was present in argv AND a positional command preceded it.
   * The global `--help` short-circuit only fires when there is NO leading
   * positional, so this flag lets sub-command handlers (`admin`, `secret`, …)
   * emit their own context-specific help text without having
   * to inspect raw argv themselves.
   */
  readonly helpRequested?: boolean
  /**
   * `--mode <value>` — the RAW string, deliberately unvalidated here, and
   * named for no command because two read it.
   *
   * Each command owns its own refusal so it can print its accepted set:
   * `sovrium seed` reads it as its write mode (`if-empty|replace|…`), and
   * `sovrium design-system` as its colour mode (`light|dark`). A parser that
   * quietly fell back to a default would run `if-empty` when the operator typed
   * `replace`, and the nightly reset would report success while refreshing
   * nothing.
   */
  readonly mode?: string
  /** `--dry-run` — report the plan, write nothing. */
  readonly dryRun?: boolean
  /**
   * `--check` — answer whether the database is safe to migrate, write nothing.
   *
   * Distinct from `--dry-run` rather than a mode of it: a dry run answers "what
   * would change", a check answers "would it survive". They exit on different
   * grounds — a check exits 1 on an unsafe database that a dry run would happily
   * describe — so collapsing them would make one of the two exit codes a lie.
   */
  readonly check?: boolean
  /**
   * `--json` — report the verdict as one JSON document on stdout.
   *
   * `sovrium validate`'s machine-readable mode. Distinct from `--format`, which
   * names an output DIALECT for a document a human still reads: this switches
   * who the command is talking to, and with it the promise that stdout carries
   * nothing a `JSON.parse` would choke on.
   */
  readonly json?: boolean
  /**
   * `--format <value>` — the RAW string, deliberately unvalidated here.
   *
   * `sovrium design-system` owns the refusal so it can print the accepted set.
   * A parser that quietly fell back to the default would hand a CI step asking
   * for `yaml` a markdown file, exit 0, and let nobody look again.
   */
  readonly format?: string
  /**
   * Every positional argument AFTER the command word, in argv order.
   *
   * `sovrium docs` addresses articles, subcommands and lookup keys positionally
   * — `docs app-schema/llms-txt`, `docs config llms.full`, `docs search llms` —
   * and none of those fit the `configFile` / `subcommand` / `positionalArg`
   * slots, which are shaped for `admin create <email> [config]`.
   */
  readonly positionalArgs?: readonly string[]
}
