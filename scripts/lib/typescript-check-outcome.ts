/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The TypeScript gate's success decision, as a pure function.
 *
 * It lives here rather than inline in `check-quality.ts` because that module
 * runs the whole quality pipeline at import time (`Effect.runPromise` at module
 * scope, no `import.meta.main` guard), so nothing in it can be unit-tested. The
 * decision this file makes was silently wrong for as long as it was untestable,
 * which is not a coincidence.
 *
 * ## The stdout scan is GONE (Effect 4 migration)
 *
 * This module used to decide success by scanning stdout for `): error TS####:`
 * rather than by exit code, because `@effect/language-service` emitted
 * `warning TS####` / `message TS####` during a plain `tsc --noEmit` and bumped
 * the exit code to 1 or 2. That plugin was removed with the Effect 4 migration,
 * so the gate is back on plain exit-code semantics: `exitCode === 0` passes.
 *
 * ## The bug this STILL exists to prevent
 *
 * `ranToCompletion` is not part of that workaround and does not go with it.
 * The original code mapped a timeout to `{ exitCode: 1, stdout: '' }` and then
 * asked "does stdout contain real errors?" — empty stdout contains none, so the
 * gate reported
 *
 * ```text
 * ✅ TypeScript passed
 * ```
 *
 * on a run that produced no type information whatsoever. The timeout was 60s
 * against a **measured 157s** cold full typecheck of this repo
 * (`tsc --noEmit --incremental false` with the gate's own heap flag), so the
 * bound did not fire occasionally — **every cold-cache run passed the
 * TypeScript gate unconditionally**: CI containers, fresh clones, any run after
 * `--no-cache`. Real type errors were empirically observed sailing through
 * green. `CommandSpawnError` had the identical shape: if `tsc` could not be
 * spawned at all, the gate said the types were fine.
 *
 * ## The fix
 *
 * `ranToCompletion` is the discriminator, and it is a SEPARATE field rather
 * than an inference from empty stdout, because "tsc ran and found nothing" and
 * "tsc never ran" produce identical output and mean opposite things. Absence of
 * evidence was being read as evidence of absence; this makes the distinction
 * explicit and unrepresentable-as-a-mistake.
 */

/**
 * The TypeScript 6 compiler, addressed by path instead of by name.
 *
 * Since [internal ref] the TypeScript gate is `bun check` ({@link BUN_CHECK_COMMAND}),
 * not this binary. TypeScript 6 stays for what a type-check-only tool cannot
 * do: the Declaration Emit gate (`typecheck:declarations`) and the release
 * declaration emit in `scripts/build/build.ts`. Those two are the only call
 * sites; a third is a sign something is reaching for TypeScript 6 that should
 * not.
 *
 * ## `tsc` on PATH is NOT TypeScript 6 in this repo
 *
 * The Effect Diagnostics gate needs `@effect/tsgo`, whose compiler discovery
 * accepts exactly two package names — `typescript` and `@typescript/native` —
 * and rejects any whose major version is below 7. TypeScript 7 cannot be the
 * repo's `typescript`: it deletes the JS compiler API, which
 * `application/use-cases/automations/action-handlers/code.ts` needs for
 * `ts.createProgram` and which `typescript-eslint` peer-requires at `<6.1.0`.
 * So `typescript` stays at 6 and TypeScript 7 is installed alongside it under
 * the alias `@typescript/native`, purely as tsgo's compiler.
 *
 * The alias carries its own `bin.tsc`, and the installer links it LAST:
 *
 * ```text
 * node_modules/.bin/tsc -> ../@typescript/native/bin/tsc   # TypeScript 7.0.2
 * ```
 *
 * So `bunx tsc`, `bun tsc` and a bare `tsc` all run **TypeScript 7**. Since the
 * root tsconfig dropped `baseUrl` that no longer fails loudly on TS5102: it
 * type-checks with TypeScript 7 semantics, which is what `bun check` does too,
 * and so is not a wrong answer for `--noEmit` — but it IS the wrong compiler for
 * a declaration emit. Address TypeScript 6 by this path. The shebang is
 * `#!/usr/bin/env node`, so a spawned child honours
 * `NODE_OPTIONS=--max-old-space-size`.
 *
 * @public
 */
export const TSC_BIN = './node_modules/typescript/bin/tsc'

/**
 * The heap every TypeScript-6 child needs on this repository's type graph.
 *
 * `tsc` is a Node CLI, and at Node's default old-space limit (~4 GB) a whole-repo
 * check OOMs on a developer machine — a bare `./node_modules/typescript/bin/tsc`
 * dies with `JavaScript heap out of memory` before printing a diagnostic. Every
 * call site therefore spawns it with this flag: `typecheck:declarations`, the
 * quality gate's Declaration Emit step and the release declaration emit in
 * `scripts/build/build.ts`. `bun check` is not a Node process and takes none.
 * 12 GB rather than the 8 GB that was measured to be enough, to match the ESLint
 * child and leave headroom as the graph grows.
 *
 * NEVER set on the Bun process itself: Bun rejects Node's `--max-old-space-size`.
 *
 * @public
 */
export const TSC_HEAP_FLAG = '--max-old-space-size=12288'

/**
 * The environment for a spawned `tsc` child: the current one, with
 * {@link TSC_HEAP_FLAG} APPENDED to any `NODE_OPTIONS` already set (Node takes the
 * last occurrence of a flag, so an operator's other options survive).
 *
 * The whole environment, not just the delta: `CommandService.spawn` REPLACES the
 * child's env when one is passed, so a delta alone would drop `PATH`.
 *
 * @public
 */
export const tscChildEnv = (
  base: Readonly<Record<string, string | undefined>> = process.env
): Record<string, string> => {
  const inherited = Object.fromEntries(
    Object.entries(base).filter((entry): entry is [string, string] => entry[1] !== undefined)
  )
  const existing = inherited['NODE_OPTIONS']
  return {
    ...inherited,
    NODE_OPTIONS:
      existing === undefined || existing === '' ? TSC_HEAP_FLAG : `${existing} ${TSC_HEAP_FLAG}`,
  }
}

/**
 * The project config for the DECLARATION-EMIT gate.
 *
 * Not `tsconfig.build.json`: that one emits into `dist/`, and its build-info is
 * deleted on every `bun run build`. See the header of the config itself for the
 * rest, including why the gate checks rather than emits.
 *
 * @public
 */
export const DECLARATION_CHECK_PROJECT = 'tsconfig.declaration-check.json'

/**
 * argv for the TypeScript gate: `bun check`, Bun's port of the TypeScript 7
 * checker. Type-check only — it emits nothing, keeps no incremental
 * cache, and reads the root `tsconfig.json` like `tsc --noEmit` does.
 *
 * `--no-pretty` gives tsc's one-line `file(line,col): error TS####: …` shape on
 * stdout and puts the summary (`checked N files`) on stderr, which is what
 * {@link bunCheckRun} reads. There is no `--incremental` to switch off, so
 * `--no-cache` changes nothing here: every run is a whole-program check.
 *
 * Same spelling in `package.json`'s `typecheck` and in CI, so the three can be
 * compared by eye.
 *
 * @public
 */
export const BUN_CHECK_COMMAND: readonly string[] = ['bun', 'check', '--no-pretty']

/**
 * `tsc` argv for the Declaration Emit gate.
 *
 * Both builders live here, beside `TSC_BIN` and the timeouts, rather than
 * inline at their call sites, for the reason this module's header gives: a
 * decision spelled inside `check-quality.ts` cannot be unit-tested, and an
 * argv IS a decision — `--incremental false` and the project path are exactly
 * the kind of detail that goes quietly wrong and still reports success.
 *
 * @public
 */
export const declarationCheckCommand = (noCache: boolean): readonly string[] =>
  noCache
    ? [TSC_BIN, '-p', DECLARATION_CHECK_PROJECT, '--incremental', 'false']
    : [TSC_BIN, '-p', DECLARATION_CHECK_PROJECT]

/**
 * How long the full-repo typecheck may take before the gate gives up.
 *
 * The previous value was 60s, chosen when the timeout path was (incorrectly)
 * harmless. A measured cold `tsc --noEmit --incremental false` on this repo
 * takes **157s** (warm/incremental: ~16s), so 60s did not time out
 * occasionally — it timed out on **every** cold run, and reported success each
 * time.
 *
 * 600s is deliberately generous rather than snug: now that a timeout FAILS the
 * build, a too-tight bound turns a slow machine into a red build, which is the
 * failure mode that pressures people into raising the number back up without
 * understanding why it was there. A bound this loose still catches the thing a
 * timeout is for — a genuinely hung process — while never firing on a merely
 * slow one. Override with `QUALITY_TSC_TIMEOUT_MS` for a constrained runner.
 */
export const DEFAULT_TSC_TIMEOUT_MS = 600_000

/** Resolve the tsc timeout, honouring a `QUALITY_TSC_TIMEOUT_MS` override. */
export const resolveTscTimeoutMs = (
  env: Readonly<Record<string, string | undefined>> = process.env
): number => {
  const raw = env['QUALITY_TSC_TIMEOUT_MS']?.trim()
  if (raw === undefined || raw === '' || !/^\d+$/.test(raw)) return DEFAULT_TSC_TIMEOUT_MS
  const parsed = Number.parseInt(raw, 10)
  return parsed > 0 ? parsed : DEFAULT_TSC_TIMEOUT_MS
}

/** The raw outcome of attempting to run tsc. */
export interface TscRunResult {
  /**
   * `false` when the process timed out or could not be spawned — i.e. when
   * `stdout` carries no information about the type graph and must NOT be
   * interpreted as "no errors found".
   */
  readonly ranToCompletion: boolean
  readonly exitCode: number
  readonly stdout: string
  readonly stderr: string
}

/**
 * A run that never produced output. `ranToCompletion: false` is the whole
 * point — see this module's header for what reading empty stdout as "clean"
 * used to cost.
 */
export const incompleteRun = (stderr: string): TscRunResult => ({
  ranToCompletion: false,
  exitCode: 1,
  stdout: '',
  stderr,
})

/** A run that finished and produced output, whatever its exit code. */
export const completedRun = (r: {
  readonly exitCode: number
  readonly stdout: string
  readonly stderr: string
}): TscRunResult => ({ ...r, ranToCompletion: true })

/**
 * Read how many files a `bun check` run checked, from its summary line:
 * `✓ No type errors in 8,196 files [1.7s]` on a clean run,
 * `Found 3 errors in 2 files, checked 8,196 files [1.8s]` on a dirty one.
 * Thousands separators are accepted. `undefined` when no summary is present.
 *
 * @public
 */
export const parseBunCheckFileCount = (output: string): number | undefined => {
  const match = /(?:No type errors in|checked)\s+([\d,]+)\s+files?\b/.exec(output)
  if (match?.[1] === undefined) return undefined
  return Number.parseInt(match[1].replaceAll(',', ''), 10)
}

/**
 * {@link completedRun} for `bun check`, with a checked-file floor.
 *
 * Measured on Bun 1.4.3, `bun check` already exits 1 whenever it checked zero
 * files — a config error (`TS5102`, `TS18003` no inputs, `TS18002` empty
 * `files`) prints `checked 0 files` and fails. This floor does not replace that;
 * it pins it, so a future release that exits 0 on an empty program, or a
 * summary this gate no longer recognises, is a RED run rather than a confident
 * green over nothing — the same rule the Effect Diagnostics gate applies to
 * tsgo's `Checked 0 files out of N`.
 *
 * Pure.
 *
 * @public
 */
export const bunCheckRun = (r: {
  readonly exitCode: number
  readonly stdout: string
  readonly stderr: string
}): TscRunResult => {
  const checked = parseBunCheckFileCount(`${r.stdout}\n${r.stderr}`)
  if (r.exitCode !== 0 || (checked !== undefined && checked > 0)) return completedRun(r)
  return completedRun({
    ...r,
    exitCode: 1,
    stderr: [
      checked === undefined
        ? 'bun check exited 0 without a `checked N files` summary this gate recognises.'
        : 'bun check exited 0 having checked 0 files.',
      'A run that cannot show it checked something is not a clean bill of health.',
      r.stderr,
    ].join('\n'),
  })
}

/**
 * Decide whether the TypeScript gate passed.
 *
 * Both clauses are load-bearing and they guard different things. A run that did
 * not complete is a FAILURE, never a pass, regardless of what its (empty) stdout
 * looks like. A run that completed is judged on tsc's own exit code — the
 * stdout scan that used to sit here existed ONLY to tolerate
 * `@effect/language-service` diagnostics, and it went out with the plugin.
 *
 * Pure.
 */
export const isTypeScriptCheckSuccessful = (result: TscRunResult): boolean =>
  result.ranToCompletion && result.exitCode === 0

/**
 * The operator-facing explanation for a failed run.
 *
 * A timeout and a type error need visibly different messages: one says "fix
 * your code", the other says "the gate never got an answer". Reporting the
 * second as the first sends the reader hunting for type errors that were never
 * detected. Returns `undefined` when the check passed. Pure.
 */
export const describeTypeScriptFailure = (result: TscRunResult): string | undefined => {
  if (isTypeScriptCheckSuccessful(result)) return undefined
  if (!result.ranToCompletion) {
    return [
      'TypeScript did NOT complete, so no type information was produced.',
      'This is a gate failure, not a clean bill of health — an incomplete run',
      'cannot tell you the types are fine.',
      '',
      result.stderr,
      '',
      'If this was a timeout on a slow or cold machine, raise the bound via',
      'QUALITY_TSC_TIMEOUT_MS (milliseconds) rather than ignoring the failure.',
    ].join('\n')
  }
  return result.stdout || result.stderr
}

/**
 * How long `effect-tsgo diagnostics` (the Effect Diagnostics gate) may take
 * before the gate gives up.
 *
 * A measured full-repo run (4294 files) takes ~30s and does NOT cache — cold and
 * warm runs cost the same, because the CLI rebuilds the program every time. 300s
 * is deliberately loose for the same reason the tsc bound is: a timeout FAILS
 * this gate, so a snug bound turns a loaded machine into a red build, and that
 * is exactly the pressure that gets a timeout quietly raised until it stops
 * meaning anything. Override with `QUALITY_TSGO_TIMEOUT_MS`.
 */
export const DEFAULT_TSGO_TIMEOUT_MS = 300_000

/** Resolve the tsgo timeout, honouring a `QUALITY_TSGO_TIMEOUT_MS` override. */
export const resolveTsgoTimeoutMs = (
  env: Readonly<Record<string, string | undefined>> = process.env
): number => {
  const raw = env['QUALITY_TSGO_TIMEOUT_MS']?.trim()
  if (raw === undefined || raw === '' || !/^\d+$/.test(raw)) return DEFAULT_TSGO_TIMEOUT_MS
  const parsed = Number.parseInt(raw, 10)
  return parsed > 0 ? parsed : DEFAULT_TSGO_TIMEOUT_MS
}

/**
 * Read the checked-file count out of a tsgo diagnostics run's stdout.
 *
 * ## Why this exists at all
 *
 * `effect-tsgo diagnostics` reports
 *
 * ```text
 * Checked 0 files out of 4294 files.
 * 0 errors, 0 warnings and 0 messages.
 * ```
 *
 * and **exits 0** whenever the Effect language service is not actually active —
 * most easily by deleting the `plugins` entry from tsconfig.json, but equally by
 * pointing `--project` at a config whose `include` resolves to nothing. That is
 * byte-identical, on both stdout and the exit code, to a run that inspected the
 * whole repo and found it clean.
 *
 * So the count is consumed as an explicit precondition rather than inferred from
 * "no diagnostics were printed". Absence of evidence is not evidence of absence
 * — the same conflation that once let every cold `tsc` run pass this pipeline
 * unconditionally (see the header of this module).
 *
 * Returns `undefined` when the line is missing entirely, which the caller must
 * also treat as a failure: it means the output did not have the shape this gate
 * knows how to verify, not that everything was fine.
 *
 * @public
 */
export const parseCheckedFileCount = (stdout: string): number | undefined => {
  const match = /Checked\s+(\d+)\s+files?\s+out of\s+\d+\s+files?\./.exec(stdout)
  if (match?.[1] === undefined) return undefined
  return Number.parseInt(match[1], 10)
}

/**
 * The three severity counts a tsgo diagnostics run reports.
 *
 * @public
 */
export interface TsgoDiagnosticCounts {
  readonly errors: number
  readonly warnings: number
  readonly messages: number
}

/**
 * Read the `N errors, N warnings and N messages.` summary out of a tsgo
 * diagnostics run's stdout.
 *
 * ## Why the exit code is not enough
 *
 * `effect-tsgo diagnostics` exits non-zero for ERROR-level diagnostics only. A
 * run reporting `0 errors, 7 warnings and 2017 messages.` exits **0**. So a gate
 * that wants "any Effect diagnostic fails the build" — which is the policy since
 * the census was driven to zero — cannot read the exit code; it has to read the
 * counts.
 *
 * Returns `undefined` when the line is missing, and the caller must treat that
 * as a FAILURE for the same reason `parseCheckedFileCount` does: output that
 * does not have the shape this gate knows how to verify is not evidence that
 * everything was fine. Note that the zero case still prints plural nouns
 * (`0 errors, 0 warnings and 0 messages.`), but the singular forms are accepted
 * so a one-of-each run parses rather than silently reading as unverifiable.
 *
 * @public
 */
export const parseDiagnosticCounts = (stdout: string): TsgoDiagnosticCounts | undefined => {
  const match = /(\d+)\s+errors?,\s+(\d+)\s+warnings?\s+and\s+(\d+)\s+messages?\./.exec(stdout)
  if (match?.[1] === undefined || match[2] === undefined || match[3] === undefined) return undefined
  return {
    errors: Number.parseInt(match[1], 10),
    warnings: Number.parseInt(match[2], 10),
    messages: Number.parseInt(match[3], 10),
  }
}

/**
 * Render the reason a diagnostics run failed the gate, or `undefined` when it
 * passed.
 *
 * Shared by `check-quality.ts` so the pass/fail rule and the message that
 * explains it cannot drift apart.
 *
 * @public
 */
export const describeDiagnosticFailure = (
  counts: TsgoDiagnosticCounts | undefined
): string | undefined => {
  if (counts === undefined) {
    return (
      'Effect Diagnostics produced no `N errors, N warnings and N messages.` summary line. ' +
      'The gate cannot confirm a clean run from output it does not recognise.'
    )
  }
  const total = counts.errors + counts.warnings + counts.messages
  if (total === 0) return undefined
  return (
    `Effect Diagnostics reported ${counts.errors} error(s), ${counts.warnings} warning(s) and ` +
    `${counts.messages} message(s). Every severity fails this gate: fix the diagnostic, or — ` +
    'when the flagged shape is the thing under test — disable that one line with a stated ' +
    'reason via `// @effect-diagnostics-next-line <rule>:off`.'
  )
}

/**
 * How many individual diagnostic lines a failure report prints before eliding.
 *
 * Small on purpose: the gate is meant to sit at zero, so a failing run is
 * normally a handful of new diagnostics. A regression that reintroduces
 * thousands would otherwise scroll the actual cause off the terminal.
 *
 * @public
 */
export const MAX_DIAGNOSTIC_LINES = 40

/**
 * Build the operator-facing failure report for a diagnostics run.
 *
 * Every severity fails the gate now, so every diagnostic line is relevant — but
 * a full census once measured ~2000 lines, which buries rather than informs.
 * The report is therefore: the reason, the first `MAX_DIAGNOSTIC_LINES`
 * diagnostics, an explicit elision notice naming the command that reproduces
 * the whole list, and the summary counts.
 *
 * The elision is stated rather than silent. A truncated list that does not say
 * it was truncated is how "I fixed all four" becomes "I fixed four of 400".
 *
 * Pure, so the format is testable — `check-quality.ts` runs its pipeline at
 * import time and nothing inside it can be unit-tested (see this module's
 * header).
 *
 * @public
 */
export const formatDiagnosticReport = (stdout: string, reason: string | undefined): string => {
  const lines = stdout.split('\n')
  const diagnostics = lines.filter((line) => /\): (error|warning|message) effect\(/.test(line))
  const summaries = lines.filter((line) => /^\d+ errors?, /.test(line.trim()))
  const elided = diagnostics.length - MAX_DIAGNOSTIC_LINES
  return [
    reason,
    ...diagnostics.slice(0, MAX_DIAGNOSTIC_LINES),
    ...(elided > 0
      ? [
          `… and ${elided} more. Full list: bunx effect-tsgo diagnostics ` +
            '--project tsconfig.tsgo.json --format text',
        ]
      : []),
    ...summaries,
  ]
    .filter((s): s is string => s !== undefined && s.length > 0)
    .join('\n')
}
