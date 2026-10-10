/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The CLI's flag vocabulary: how one flag's value is read off argv, which flags
 * take a value, which stand alone, and the first token that is neither.
 */

export const hasFlag = (argv: readonly string[], long: string, short: string): boolean =>
  argv.includes(long) || argv.includes(short)

export const getFlagValue = (argv: readonly string[], flag: string): string | undefined => {
  const index = argv.indexOf(flag)
  return index !== -1 ? argv[index + 1] : undefined
}

/**
 * A value-flag's value, where a following FLAG counts as no value at all.
 *
 * `getFlagValue` returns the next token whatever it is, which would read
 * `docs --export --full` as an export into a directory named `--full`. For a
 * flag whose value is a path the caller will write into, that is the wrong
 * guess in the most expensive direction.
 */
export const getFlagPathValue = (argv: readonly string[], flag: string): string | undefined => {
  const value = getFlagValue(argv, flag)
  return value === undefined || value.startsWith('-') ? undefined : value
}

/**
 * A value-flag read in both spellings, `--flag value` and `--flag=value`.
 *
 * `given` says the flag is on the command line; `value` is absent when it was
 * given none — at the end of the line, before another flag, or as `--flag=`.
 * A command that addresses something remote refuses that case rather than
 * falling back to a default: `--app` with no slug deploying to the linked app
 * is the wrong guess in the most expensive direction.
 */
export const readValueFlag = (
  argv: readonly string[],
  flag: string
): { readonly given: boolean; readonly value?: string } => {
  const joined = argv.find((arg) => arg.startsWith(`${flag}=`))
  if (joined !== undefined) {
    const value = joined.slice(flag.length + 1)
    return value === '' ? { given: true } : { given: true, value }
  }
  if (!argv.includes(flag)) return { given: false }
  const next = argv[argv.indexOf(flag) + 1]
  return next === undefined || next.startsWith('-') ? { given: true } : { given: true, value: next }
}

/**
 * Every value of a repeatable value-flag, in argv order.
 *
 * `getFlagValue` uses `indexOf`, which stops at the first occurrence — correct
 * for `--output`, wrong for `--table`. A trailing `--table` with no argument
 * contributes nothing rather than swallowing the next flag.
 */

export const getFlagValues = (argv: readonly string[], flag: string): readonly string[] =>
  argv.flatMap((arg, index) => {
    if (arg !== flag) return []
    const value = argv[index + 1]
    return value === undefined || value.startsWith('-') ? [] : [value]
  })

export const FLAG_VALUE_OPTIONS = [
  '--output',
  '--template',
  // Listed here as well as in KNOWN_VALUE_FLAGS: omitting a value-flag leaves
  // its value in the positional stream, so `sovrium init --from-url <url> ./dir`
  // would treat the URL as the target directory.
  '--from-url',
  '--publicDir',
  '--name',
  '--password',
  // `sovrium seed` — every one of these MUST be listed here as well as in
  // KNOWN_VALUE_FLAGS. Omitting a value-flag leaves its value in the positional
  // stream, so `sovrium seed --mode upsert app.yaml` would treat the string
  // `upsert` as the config path and report "file not found: upsert".
  '--dir',
  '--mode',
  '--table',
  '--today',
  // `sovrium design-system --format md|json`. Listed here as well as in
  // KNOWN_VALUE_FLAGS: omitting a value-flag leaves its value in the positional
  // stream, so `sovrium design-system --format json app.yaml` would treat the
  // string `json` as the config path.
  '--format',
  // `sovrium docs --lang en --section tables`. Same rule: absent here, `en`
  // would be read as the article address and `docs --lang en` would refuse a
  // section nobody registered.
  '--lang',
  '--section',
  // `sovrium docs --export <dir>`. Both lists, same reason: absent here, the
  // directory would be read as the article address.
  '--export',
  // `sovrium mcp --project <dir>`. Both lists again, and this one bites in a
  // way the others do not: `--project /tmp/app` leaves `/tmp/app` in the
  // positional stream, where `isConfigFile` matches it on the `/` and rewrites
  // the whole invocation into an implicit `start`.
  '--project',
  // `sovrium library`. Both lists, same reason: absent here, `--into
  // apps/site/app.yaml` would leave a path in the positional stream, and
  // `--set headline=…` a value read as the entry id.
  '--kind',
  '--category',
  '--set',
  '--as',
  '--into',
  '--tag',
  '--limit',
  // `sovrium skills --target agents`. Both lists: absent here, `agents` would be
  // read as a positional argument.
  '--target',
  // `sovrium changelog --since 0.26.0`. Both lists: absent here, `0.26.0` would
  // be read as the version argument and the request refused as two views.
  '--since',
  // `sovrium restore <file> --data-dir <dir>`. Both lists: absent here, the
  // directory would be read as the backup file.
  '--data-dir',
  // `sovrium render <asset> --data <file> --out <file> --locale <code> --config <file>`.
  '--data',
  '--out',
  '--locale',
  '--config',
  // `sovrium login` / `sovrium deploy`. Both lists, and `--host` bites hardest:
  // absent here, `login --host https://…` leaves a URL in the positional
  // stream, where `isConfigFile` matches it on the `/` and boots a server.
  '--host',
  '--api-key',
  '--app',
  // `sovrium deploy --env <file>`, `sovrium env push --plain <NAME>`,
  // `sovrium seed --confirm <slug>`. Both lists: absent here, the file or the
  // name would be read as the config path.
  '--env',
  '--plain',
  '--confirm',
  // `sovrium seed --request <file> --report <file>`. Both lists: absent here,
  // the file would be read as the config path.
  '--request',
  '--report',
] as const

/** Commands that use two-level noun-verb dispatch (verb in 2nd positional slot). */
export const NOUN_VERB_COMMANDS = ['admin', 'secret'] as const

/**
 * The set of flags the CLI recognizes. Anything else passed with a `--` or
 * `-X` prefix is rejected with an error that names the offending flag, so a
 * typo (`--definitely-not-a-flag-xyzzy`) does not silently fall through to
 * the implicit `start` command and emit a misleading "No configuration
 * provided" message.
 */
const KNOWN_BOOLEAN_FLAGS: ReadonlySet<string> = new Set([
  '--help',
  '-h',
  '--version',
  '-v',
  '--watch',
  '-w',
  '--force',
  '--no-publicDir',
  // `sovrium init --typescript`. Absent from this set, `findUnknownFlag`
  // rejects it outright — a refusal that reads like operator error rather
  // than a gap.
  '--typescript',
  // `sovrium init --git`. Absent from this set, `findUnknownFlag` rejects it
  // outright — a refusal that reads like operator error rather than a gap.
  '--git',
  // `sovrium seed --dry-run`, `sovrium migrate --dry-run`
  '--dry-run',
  // `sovrium migrate --check`. Absent from this set, `findUnknownFlag` rejects
  // the flag outright, so the mode is unreachable however well it is wired.
  '--check',
  // `sovrium migrate --allow-destructive`. Absent from this set, the flag is
  // refused before the command runs, so the consent could never be given.
  '--allow-destructive',
  // `sovrium docs --full`, `sovrium docs --list-sections`.
  '--full',
  '--list-sections',
  // `sovrium validate --json`. Same note as `--check`: a flag missing from this
  // set is refused at parse time, so the machine-readable report would be
  // unreachable however completely the command implemented it.
  '--json',
  // `sovrium library add --no-wire`.
  '--no-wire',
  // `sovrium library add <provider> --all [--yes]`.
  '--all',
  '--yes',
  // `sovrium seed --remote`: seed the app the project's link file names, on the
  // signed-in cloud. A plain `sovrium seed` stays local, link or not.
  '--remote',
  // `sovrium changelog --list`.
  '--list',
  '--insecure-skip-checksum', // `sovrium update`: opt out of the fail-closed checksum
  '--email', // `sovrium render`: as `email/send` delivers it
  // `sovrium login --open | --status | --logout`, `sovrium deploy --no-wait`.
  '--open',
  // `sovrium login --device`: the code flow instead of the one-click return.
  '--device',
  '--status',
  '--logout',
  '--no-wait',
  // `sovrium deploy --seed`: seed the app, if-empty, once it is live.
  '--seed',
  // `sovrium env push --overwrite | --redeploy`.
  '--overwrite',
  '--redeploy',
])

const KNOWN_VALUE_FLAGS: ReadonlySet<string> = new Set([
  // `sovrium render` (see FLAG_VALUE_OPTIONS).
  '--data',
  '--out',
  '--locale',
  '--config',
  '--output',
  '--template',
  // `sovrium init --from-url <https://…>`. A published config document forked
  // into the project, as opposed to `--template`'s whole repository.
  '--from-url',
  '--publicDir',
  '--name',
  '--password',
  // `sovrium reload --message "..."` records the
  // operator's commit message on the new version row.
  '--message',
  // `sovrium seed`. Absent from this set, `findUnknownFlag` rejects the flag
  // outright — a refusal that reads like operator error rather than a gap.
  '--dir',
  '--mode',
  '--table',
  '--today',
  // `sovrium design-system`. Absent from this set, `findUnknownFlag` rejects
  // the flag outright — a refusal naming the flag but not the accepted values.
  '--format',
  // `sovrium docs`. Same reason: the command owns both refusals so it can
  // print the accepted locale and the registered section slugs.
  '--lang',
  '--section',
  // `sovrium docs --export <dir>`. Absent from this set the flag is refused
  // before dispatch as an unknown flag.
  '--export',
  // `sovrium mcp --project <dir>`. Absent from this set the flag is refused
  // before dispatch, so the verb would be unreachable however completely it is
  // implemented.
  '--project',
  // `sovrium library`. Absent from this set each is refused before dispatch,
  // so the verb could never be given a kind, a parameter or a target.
  '--kind',
  '--category',
  '--set',
  '--as',
  '--into',
  // `sovrium library add <provider> --tag <group>`, `library search --limit <n>`.
  '--tag',
  '--limit',
  // `sovrium skills --target claude|agents|all`. Absent from this set the flag
  // is refused before dispatch, so a target could never be chosen.
  '--target',
  // `sovrium changelog --since <version>`. Absent from this set the flag is
  // refused before dispatch as an unknown flag.
  '--since',
  // `sovrium restore --data-dir <dir>`.
  '--data-dir',
  // `sovrium login --host <url> --api-key <key>`, `sovrium deploy --app <slug>`.
  '--host',
  '--api-key',
  '--app',
  // `sovrium deploy --env <file>`, `sovrium env push --plain <NAME>`, `--confirm <slug>`.
  '--env',
  '--plain',
  '--confirm',
  // `sovrium seed --request <file> --report <file>`: how a hosting machine's
  // seed unit hands the command its options and reads its result.
  '--request',
  '--report',
])

/** Strip `=value` from `--flag=value` so the bare flag name can be matched. */
const stripEqValue = (arg: string): string =>
  arg.includes('=') ? arg.slice(0, arg.indexOf('=')) : arg

/**
 * Find the first argv token that looks like a flag (`--foo` or `-x`) but is
 * not in the known-flag allow-list. Returns the offending token, or `undefined`
 * if every flag in `argv` is recognized.
 *
 * A token in the position immediately after a `KNOWN_VALUE_FLAGS` flag is
 * treated as that flag's value and skipped — that captures `--output /tmp/x`
 * (where `/tmp/x` is the value) without rejecting `/tmp/x` as a positional.
 */
export const findUnknownFlag = (argv: readonly string[]): string | undefined => {
  const offenders = argv.filter((arg, i) => {
    if (!arg.startsWith('-')) return false
    const flag = stripEqValue(arg)
    if (KNOWN_BOOLEAN_FLAGS.has(flag) || KNOWN_VALUE_FLAGS.has(flag)) return false
    // If the previous token is a known value-flag and this token does NOT
    // start with `--` or look like a flag-name itself, it's a value not a flag.
    const prev = i > 0 ? argv[i - 1] : undefined
    if (prev !== undefined && KNOWN_VALUE_FLAGS.has(stripEqValue(prev)) && !prev.includes('=')) {
      return false
    }
    return true
  })
  return offenders[0]
}
