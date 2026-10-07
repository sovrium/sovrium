/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The shape `parseArgs` hands the command table: which command was asked for,
 * its positional arguments, and every flag it reads.
 */

export interface ParsedArgs {
  readonly command: string
  readonly configFile?: string
  readonly watchMode: boolean
  readonly outputPath?: string
  /** `sovrium restore --data-dir <dir>`; a following flag counts as no value. */
  readonly dataDir?: string
  readonly templateName?: string
  readonly subcommand?: string
  readonly appName?: string
  /**
   * `--typescript` — scaffold a typed `app.ts` instead of `app.yaml` (`init`).
   *
   * Deliberately an EITHER/OR rather than an addition: `app.yaml` shadows
   * `app.ts` in `DEFAULT_CONFIG_FILENAMES`, so scaffolding both would leave the
   * typed config inert and edited-but-never-read.
   */
  readonly typescript?: boolean
  /**
   * `--git` — run `git init` and land one commit over the fresh scaffold
   * (`init`).
   *
   * A convenience, never a prerequisite: undo is engine-owned and works with
   * no repository at all, so a host without `git` loses this and nothing else.
   */
  readonly gitInit?: boolean
  /**
   * `--from-url <https://…>` — fork ONE published config document (`init`).
   *
   * Distinct from `--template owner/repo`, which fetches a whole repository.
   * This is the shape a gallery, a blog post or a colleague can publish
   * without owning one.
   */
  readonly fromUrl?: string
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
  /** Value of --password (admin create scripting/CI override). */
  readonly password?: string
  /**
   * `--help`/`-h` was present in argv AND a positional command preceded it.
   * The global `--help` short-circuit only fires when there is NO leading
   * positional, so this flag lets sub-command handlers (`admin`, `secret`, …)
   * emit their own context-specific help text without having
   * to inspect raw argv themselves.
   */
  readonly helpRequested?: boolean
  /** `--dir <path>` — seed-file directory for `sovrium seed`. */
  readonly seedDir?: string
  /**
   * `--mode <value>` — the RAW string, deliberately unvalidated here.
   *
   * `sovrium seed` owns the refusal so it can print the accepted set; a parser
   * that quietly fell back to the default would run `if-empty` when the
   * operator typed `replace`, and the nightly reset would report success while
   * refreshing nothing.
   */
  readonly seedMode?: string
  /**
   * Every `--table <name>` occurrence, in argv order.
   *
   * Repeatable by design: `sovrium seed --table deals --table tasks` must seed
   * BOTH. A single-value reader would silently honour the first and leave the
   * second table empty behind a green exit code.
   */
  readonly seedTables?: readonly string[]
  /** `--dry-run` — report the plan, write nothing. */
  readonly dryRun?: boolean
  /**
   * `--as <email>` read for `sovrium seed`: the account every seeded row is
   * written as. The same token `libraryAs` reads — each verb owns its meaning.
   */
  readonly seedAs?: string
  /** `--today <YYYY-MM-DD>` — the day every `{{today…}}` in a seed run resolves against. */
  readonly seedToday?: string
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
   * `--allow-destructive` — `sovrium migrate`'s one-shot consent to drop a table
   * the config no longer declares while it still holds rows.
   */
  readonly allowDestructive?: boolean
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
  /** `--full` — print the whole manual rather than an index (`docs`). */
  readonly full?: boolean
  /** `--list-sections` — print the section vocabulary and stop (`docs`). */
  readonly listSections?: boolean
  /**
   * `--lang <value>` — the RAW string, deliberately unvalidated here.
   *
   * `sovrium docs` owns the refusal for the same reason `--format` is left
   * raw: the in-binary manual is English, and serving English to a reader who
   * asked for French is precisely the failure the flag exists to prevent.
   */
  readonly lang?: string
  /**
   * Every `--section <slug>` occurrence, in argv order.
   *
   * Repeatable by design: `sovrium docs --full --section tables --section forms`
   * must print BOTH. A single-value reader would honour the first and drop the
   * second behind a green exit code, which is the `--table` defect one flag up.
   */
  readonly docsSections?: readonly string[]
  /**
   * `--export <dir>` — `sovrium docs` writes every article plus a manifest.
   *
   * `exportRequested` is carried separately from the directory because a bare
   * `--export` must be REFUSED by name, not read as "no export": run from a
   * project root, silently falling back to the working directory would write
   * two hundred files beside `app.ts`.
   */
  readonly exportRequested?: boolean
  readonly exportDir?: string
  /**
   * Every positional argument AFTER the command word, in argv order.
   *
   * `sovrium docs` addresses articles, subcommands and lookup keys positionally
   * — `docs app-schema/llms-txt`, `docs config llms.full`, `docs search llms` —
   * and none of those fit the `configFile` / `subcommand` / `positionalArg`
   * slots, which are shaped for `admin create <email> [config]`.
   */
  readonly positionalArgs?: readonly string[]
  /**
   * `--project <dir>` — the directory `sovrium mcp` reads its config from.
   *
   * Distinct from `configFile`, and deliberately: the stdio MCP verb is handed
   * a PROJECT, not a document. It then discovers the config inside it exactly
   * as `sovrium start` does, so a client's saved invocation keeps working when
   * the author renames `app.yaml` to `app.ts`.
   */
  readonly projectDir?: string
  /** `--kind <value>` — the RAW string; `sovrium library` owns the refusal. */
  readonly libraryKind?: string
  /** `--category <value>` — narrows `sovrium library list`. */
  readonly libraryCategory?: string
  /**
   * Every `--set key=value` occurrence, in argv order (`sovrium library add`).
   *
   * Repeatable for the reason `--table` is: an entry declares several
   * parameters, and a single-value reader would keep the first and drop the
   * rest behind a green exit code.
   */
  readonly librarySets?: readonly string[]
  /** `--as <name>` — install a library entry under another name. */
  readonly libraryAs?: string
  /** `--into <config>` — the config `sovrium library add` installs into. */
  readonly libraryInto?: string
  /** `--no-wire` — write the fragment, print the wiring line instead of editing. */
  readonly noWire?: boolean
  /** `--tag <group>` — install one group of a provider's operations. */
  readonly libraryTag?: string
  /** `--limit <n>` — the RAW string; `sovrium library search` owns the refusal. */
  readonly libraryLimit?: string
  /** `--all` — install every operation of a provider. */
  readonly libraryAll?: boolean
  /** `--yes` — confirm an `--all` install above the confirmation threshold. */
  readonly libraryYes?: boolean
  /** `--target <value>` — the RAW string; `sovrium skills` owns the refusal. */
  readonly skillsTarget?: string
  /** `--list` — print one line per release (`changelog`). */
  readonly changelogList?: boolean
  /**
   * `--since <version>` — every release after that version (`changelog`).
   *
   * `changelogSinceRequested` is carried beside the value so a bare `--since`
   * is refused by name instead of silently printing the default view.
   */
  readonly changelogSinceRequested?: boolean
  readonly changelogSince?: string
}
