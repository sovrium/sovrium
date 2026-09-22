/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The three shapes the toolchain needs and the product CLI has no analogue for.
 *
 * Everything else — `formatDuration`, `formatBytes`, `formatClock`, the journal
 * printers, `printStderr`, `formatFailure`, the glyph set — is imported
 * directly from `@/infrastructure/logging/cli-output` by whoever needs it.
 * There is deliberately NO re-export barrel here: `scripts/**\/*.ts` is both an
 * `entry` and a `project` glob in `knip.config.ts` with `includeEntryExports`
 * on, so a re-export nobody calls is reported as dead code — correctly.
 *
 *.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as Effect from 'effect/Effect'
import {
  type CliBlock,
  type CliFailure,
  type CliLine,
  formatDuration,
  inflect,
  printDocument,
  printJournal,
  printJournalError,
  printStderr,
} from '@/infrastructure/logging/cli-output'

const PROJECT_ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..')

/**
 * The engine version, read from `package.json` at call time.
 *
 * Not cached and not imported: a tool banner is printed once per run, and an
 * `import … from '../package.json'` would put a JSON module in the graph of
 * every script that prints anything.
 */
export const toolVersion = (): string => {
  const manifest = readFileSync(join(PROJECT_ROOT, 'package.json'), 'utf8')
  return (JSON.parse(manifest) as { readonly version: string }).version
}

/**
 * The toolchain identity header (T30, and the product's own banner rule).
 *
 * The shipped product renders `<app> v<ver> (Sovrium v<engine>)` — the app it
 * booted, qualified by the engine underneath
 * (`src/infrastructure/logging/startup-summary.ts`). An internal tool has no
 * second version to qualify it with: the tool IS the engine's own repository,
 * at one version. So the two collapse to `Sovrium <tool> v<version>` rather
 * than rendering a hollow `quality v0.24.0 (Sovrium v0.24.0)`.
 */
export const toolIdentity = (tool: string): CliLine => ({
  text: `Sovrium ${tool} v${toolVersion()}`,
})

/**
 * Close a green run with a banner (T4 Banner, T5): identity header, then the
 * caller's blocks, rendered with exactly one blank line between them.
 *
 * A banner renders only COMPLETED phases, which is why this is the CLOSE of a
 * run and never its opening. The opening is a flush-left stream line.
 */
export const toolBanner = (tool: string, blocks: readonly CliBlock[]): void =>
  printDocument([[toolIdentity(tool)], ...blocks])

/** One `✓ <name> in <duration>` banner row. */
export const gateRow = (name: string, durationMs: number): CliLine => ({
  glyph: 'ok',
  text: `${name} in ${formatDuration(durationMs)}`,
})

/**
 * Close a RED run with a statement, not a banner.
 *
 * This is forced, not chosen. T8's glyph set is closed at `✓ ⚠ →` and carries
 * no failure mark — "`✗` is not in the glyph set and never will be" (T3) —
 * because severity is a WORD and a stream. So a run with failures cannot be
 * rendered as a grouped-`✓` block at all, and takes T21's shape instead:
 * the constraint, what did not happen, the offending rows, and one verb-led
 * line telling the operator where to go.
 */
export const toolFailure = (params: {
  readonly tool: string
  readonly failed: readonly { readonly name: string; readonly durationMs: number }[]
  readonly total: number
  readonly guidance: string
}): CliFailure => ({
  headline:
    params.failed.length === 1 && params.failed.length === params.total
      ? // FAIL-FAST: this gate is the only one that got to run, so a ratio
        // would read `1 of 1 failed` — "everything failed" — when in fact
        // nothing else was attempted. Name the gate and the consequence
        // instead, which needs no count we do not have. A planned-gate total
        // is not available here and would be wrong anyway: the `--skip-*`
        // flags change it per run.
        `${params.failed[0]?.name ?? 'A check'} failed — the run stopped there, so the remaining checks did not run.`
      : // Several failed, so every one of them ran and the ratio is true.
        `${inflect(params.failed.length, `${params.tool} check`)} of ${params.total} failed — the tree is not ready to merge.`,
  detail: params.failed.map((check) => `${check.name} (${formatDuration(check.durationMs)})`),
  guidance: params.guidance,
})

/**
 * The journal source tag for one gate (T34, T39): lowercase, `[a-z][a-z-]*`.
 *
 * Derived from the check's display name rather than declared beside it, so a
 * new gate cannot be added without one. The parenthetical suffix the pipeline
 * composes at runtime is dropped — `Unit Test (auth.test.ts)` and
 * `E2E Regression Tests (0 specs ran — see warning above)` must not each mint
 * their own tag, or the property the tag exists for (filtering one gate back
 * out of an interleaved screen) is lost.
 */
export const tagOf = (name: string): string =>
  name
    .replace(/\s*\(.*$/, '')
    .toLowerCase()
    .replace(/[^a-z]+/g, '-')
    .replace(/^-+|-+$/g, '')

/**
 * Report a delegated tool's own output VERBATIM, under the gate's tag.
 *
 * The headline is ours and goes through the journal, so it carries the clock,
 * the tag and the word `Error:` (T41). The tool's block does NOT: ESLint's
 * formatter, `tsc`'s diagnostics and Knip's table are foreign documents whose
 * columns are load-bearing, and stamping each of their lines would mangle the
 * alignment the tool chose. T44 governs a multi-line report OF OURS entering
 * the journal; this is the same posture T33 already takes towards a delegated
 * tool's exit code — propagate it, do not reinterpret it.
 *
 * `printStderr` and not `console.error`: Bun paints the latter red on a TTY,
 * which T35 #3 bans and which would make the bytes differ between a terminal
 * and a redirect.
 */
export const reportToolFailure = (
  name: string,
  headline: string,
  output: string
): Effect.Effect<void> =>
  Effect.sync(() => {
    printJournalError(tagOf(name), headline)
    if (output.trim().length > 0) {
      printStderr(output.trimEnd())
    }
  })

/**
 * The present participle naming what a gate DOES, for its start line (T20).
 *
 * The no-repeat rule (terminal-language.md §13): the TAG names the gate and the
 * SENTENCE names the work, and neither repeats the other. `Running Prettier…`
 * under a `[prettier]` tag says the same word twice and tells the reader
 * nothing they could not see; `Checking formatting…` tells them what the next
 * fifty seconds are for.
 *
 * Matched by NAME PREFIX so the parameterised names keep working —
 * `Unit Test (auth.test.ts)` is composed at runtime. A gate with no entry falls
 * back to `Running`, which is the old behaviour and is never wrong, only dull.
 */
const GATE_WORK: readonly (readonly [string, string])[] = [
  ['Prettier', 'Checking formatting'],
  ['ESLint', 'Linting'],
  ['Workflow Lint', 'Linting the CI workflows'],
  ['Drift Checks', 'Running the drift gates'],
  ['Guide Config Validation', 'Validating the guide configs'],
  ['Committed Secrets', 'Scanning tracked .env files'],
  ['Dependency Audit', 'Checking advisories'],
  ['TypeScript', 'Checking types'],
  ['Declaration Emit', 'Checking the .d.ts declaration emit'],
  ['Effect Diagnostics', 'Collecting Effect diagnostics'],
  ['Unit Tests', 'Running the unit tests'],
  ['Unit Test', 'Running the unit test'],
  ['Knip', 'Looking for unused code'],
  ['Test File Presence', 'Checking test-file presence'],
  ['E2E Regression Tests', 'Running the related regression specs'],
  ['E2E Ran Gate', 'Confirming the specs actually ran'],
]

/** The start-line participle for a gate (T20, §13 no-repeat rule). */
export const gateWork = (name: string): string =>
  GATE_WORK.find(([gate]) => name.startsWith(gate))?.[1] ?? 'Running'

/**
 * Whether a gate's SCOPE CENSUS should print.
 *
 * Thirty of the forty-six drift gates close by narrating what they looked at
 * and what they deliberately did not — "… scope — 662 of 1026 fences decoded …
 * not covered: …". Those lines are the reason a green gate is readable as
 * evidence rather than as an assertion, and they belong on a standalone run.
 *
 * Under the ORCHESTRATOR they are noise squared: `check-drift.ts` runs all
 * forty-six concurrently, so thirty multi-hundred-character censuses interleave
 * with the verdict journal, unstamped and in no order — and `check-quality.ts`
 * buffers the whole child anyway, so on a green run every one of them is
 * computed, written and then discarded unread.
 *
 * The seam is a module-level flag rather than an argument threaded through
 * forty-six signatures, and rather than an env var: the gates are IMPORTED by
 * the orchestrator, not spawned, so there is one process and one module
 * instance, and the flag is set before any gate runs.
 */
let scopeNotesSuppressed = false

/** Called by `check-drift.ts` before it runs the gates. */
export const suppressScopeNotes = (): void => {
  scopeNotesSuppressed = true
}

/**
 * A gate's scope census: a stamped journal line on a standalone run, nothing at
 * all under the orchestrator.
 */
export const scopeNote = (tag: string, text: string): void => {
  if (scopeNotesSuppressed) return
  printJournal(tag, text)
}

/**
 * A clause a gate could NOT evaluate — printed everywhere, suppression included.
 *
 * The distinction from {@link scopeNote} is the whole reason this exists, and it
 * is not a volume preference. A scope census narrates a run that happened, so
 * dropping it under the orchestrator loses nothing but noise. An abstention
 * narrates a run that did NOT happen: the gate returns `ok` having skipped a
 * clause, and if that is suppressed the only place it would have appeared is the
 * very environment where it is true. CI would read a clean verdict over a check
 * nobody performed, which is the false green the drift suite exists to refuse.
 *
 * Rare and conditional by construction — a gate that abstains on every run is
 * not abstaining, it is disabled, and should be deleted or fixed instead. The
 * text says which clause, why it could not run, what DID run beside it, and the
 * command that evaluates it for real; `⚠` is in T8's closed glyph set.
 */
export const printAbstention = (tag: string, text: string): void => {
  printJournal(tag, `⚠ ${text}`)
}
