/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The toolchain's terminal voice — one renderer for every script under
 * `scripts/`, and a thin one, because the format itself lives in
 * `src/infrastructure/logging/cli-output.ts`.
 *
 * ## Why this delegates rather than implements
 *
 * `[internal ref]` binds `scripts/` to the
 * same standard as the product CLI. A second implementation of the journal
 * grammar would be a second thing to keep in step, and the first one already
 * drifted: this module used to carry an emoji table (`✅ ❌ ⚠️ 🔄 ✨ ⏭️`), an
 * 80-column `─` rule and its own `▼`/`▲` group markers, while
 * `[internal ref]` next door used `✓`/`✗` and a 60-column rule and
 * `QualityReportService` used a 50-column one. Three vocabularies and three
 * rule widths appeared in a single failing `bun run quality`.
 *
 * So there is exactly one `formatClock`, one `formatDuration`, one journal
 * splitter, and they are the product's. Reaching into `src/` from `scripts/`
 * is precedented and unguarded: `boundaries/include` is `['src/**\/*']`
 *, and ~40 non-test scripts already import
 * from `@/` — including four under `scripts/build/`.
 *
 * ## The mode this renders
 *
 * A JOURNAL (T39). That is not a stylistic pick: `check-quality.ts` spawns
 * around fourteen children and runs its file-mode checks at
 * `concurrency: 'unbounded'`, and `check-drift.ts` runs forty-odd gates
 * concurrently — which is precisely T39's "a foreground command that keeps
 * running while background work reports into the same TTY", and precisely the
 * interleaving T34 permits a bracketed source tag for.
 *
 * Each gate is a mini-command in T42's sense: one start line, one result line.
 * T6 forbids completing a step inside a stream because "the next line's
 * appearance already is the completion signal" — under unbounded concurrency
 * the next line belongs to a DIFFERENT gate, so that signal does not exist and
 * T42's carve-out applies for the same structural reason it does under
 * `--watch`.
 *
 * ## What is NOT terminal voice
 *
 * {@link annotation} emits GitHub-Actions/[internal ref] log commands
 * (`::error file=…,line=…::message`). Those are a machine protocol read by a
 * CI log parser, not bytes an operator reads, so they are Data mode (T7) and
 * byte-exact — no clock, no tag, no glyph. `check-code-scanning-alerts.test.ts`
 * pins the prefix at line index 0.
 */

import * as Context from 'effect/Context'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import * as Logger from 'effect/Logger'
import {
  printJournal,
  printJournalError,
  printJournalWarning,
  printProgress,
} from '@/infrastructure/logging/cli-output'

/**
 * GitHub Actions annotation type
 */
export type AnnotationType = 'notice' | 'warning' | 'error'

/**
 * Logger configuration.
 *
 * `tag` is the bracketed source tag every line of this script's journal
 * carries (T34, T39): lowercase, `[a-z][a-z-]*`. It names the TOOL, and a gate
 * inside that tool narrows it further through {@link LoggerService.journal}.
 */
export interface LoggerConfig {
  readonly tag: string
  readonly enableGitHubActions: boolean
}

/**
 * Default logger configuration.
 *
 * The default tag is deliberately generic: every entry script passes its own,
 * and a line reading `[tool]` in a real run means somebody forgot.
 */
export const defaultLoggerConfig: LoggerConfig = {
  tag: 'tool',
  enableGitHubActions: !!process.env.GITHUB_ACTIONS,
}

/**
 * Logger Service Interface
 */
export interface LoggerService {
  /**
   * Narrate the START of the whole command (T4 Stream, T20): a present
   * participle, flush left, no clock and no tag — it precedes the journal
   * rather than belonging to it. `…` is appended for you.
   */
  readonly opening: (participle: string) => Effect.Effect<void>

  /** A journal line on stdout under this script's own tag. */
  readonly info: (message: string) => Effect.Effect<void>

  /** A journal line on stderr carrying `Warning:` (T41). */
  readonly warn: (message: string) => Effect.Effect<void>

  /** A journal line on stderr carrying `Error:` (T41). */
  readonly error: (message: string) => Effect.Effect<void>

  /** A resolved-fact journal line on stdout. */
  readonly success: (message: string) => Effect.Effect<void>

  /** A step's START line, present participle (T20). `…` is appended for you. */
  readonly progress: (message: string) => Effect.Effect<void>

  /**
   * A journal line under an EXPLICIT tag — one gate inside this tool.
   * This is the spelling a per-gate result line wants.
   */
  readonly journal: (tag: string, message: string) => Effect.Effect<void>

  /** As {@link journal}, on stderr, carrying `Warning:`. */
  readonly journalWarning: (tag: string, message: string) => Effect.Effect<void>

  /** As {@link journal}, on stderr, carrying `Error:`. */
  readonly journalError: (tag: string, message: string) => Effect.Effect<void>

  /**
   * Emit a CI log-annotation command. DATA MODE (T7) — byte-exact, no chrome.
   * A no-op when `enableGitHubActions` is false.
   */
  readonly annotation: (
    type: AnnotationType,
    message: string,
    file?: string,
    line?: number
  ) => Effect.Effect<void>
}

/**
 * Logger Service Tag (for dependency injection)
 */
export const LoggerService = Context.Service<LoggerService>('LoggerService')

/**
 * Build a CI log-annotation command. Data mode: the exact bytes a CI log
 * parser expects, and nothing else.
 */
const createAnnotation = (
  type: AnnotationType,
  message: string,
  file?: string,
  line?: number
): string => {
  const props: string[] = []
  if (file) {
    props.push(`file=${file}`)
  }
  if (line !== undefined) {
    props.push(`line=${line}`)
  }
  const propsStr = props.length > 0 ? ` ${props.join(',')}` : ''
  return `::${type}${propsStr}::${message}`
}

/**
 * Live Logger Service Implementation
 */
export const LoggerServiceLive = (config: LoggerConfig = defaultLoggerConfig) =>
  Layer.succeed(
    LoggerService,
    LoggerService.of({
      opening: (participle: string) => Effect.sync(() => printProgress(participle)),

      info: (message: string) => Effect.sync(() => printJournal(config.tag, message)),

      warn: (message: string) => Effect.sync(() => printJournalWarning(config.tag, message)),

      error: (message: string) => Effect.sync(() => printJournalError(config.tag, message)),

      success: (message: string) => Effect.sync(() => printJournal(config.tag, message)),

      // A start line and a result line render identically — both are one
      // stamped sentence. What separates them is the participle, which is the
      // call site's to choose (T20), and the `…` it carries.
      progress: (message: string) => Effect.sync(() => printJournal(config.tag, `${message}…`)),

      journal: (tag: string, message: string) => Effect.sync(() => printJournal(tag, message)),

      journalWarning: (tag: string, message: string) =>
        Effect.sync(() => printJournalWarning(tag, message)),

      journalError: (tag: string, message: string) =>
        Effect.sync(() => printJournalError(tag, message)),

      annotation: (type: AnnotationType, message: string, file?: string, line?: number) =>
        Effect.sync(() => {
          if (config.enableGitHubActions) {
            // CI log-command protocol (T7 data mode), not terminal voice. `no-console`
            // is already off for `scripts/**`.
            console.log(createAnnotation(type, message, file, line))
          }
        }),
    })
  )

/**
 * Helper functions for common operations
 */

/** Narrate the start of the whole command. */
export const opening = (participle: string) =>
  LoggerService.pipe(Effect.flatMap((service) => service.opening(participle)))

/**
 * Log info message
 * @public
 */
export const info = (message: string) =>
  LoggerService.pipe(Effect.flatMap((service) => service.info(message)))

/**
 * Log warning message
 * @public
 */
export const warn = (message: string) =>
  LoggerService.pipe(Effect.flatMap((service) => service.warn(message)))

/**
 * Log error message
 * @public
 */
export const error = (message: string) =>
  LoggerService.pipe(Effect.flatMap((service) => service.error(message)))

/**
 * Log success message
 */
export const success = (message: string) =>
  LoggerService.pipe(Effect.flatMap((service) => service.success(message)))

/**
 * Log progress message
 */
export const progress = (message: string) =>
  LoggerService.pipe(Effect.flatMap((service) => service.progress(message)))

/** A journal line under an explicit gate tag. */
export const journal = (tag: string, message: string) =>
  LoggerService.pipe(Effect.flatMap((service) => service.journal(tag, message)))

/** A `Warning:` journal line under an explicit gate tag. */
export const journalWarning = (tag: string, message: string) =>
  LoggerService.pipe(Effect.flatMap((service) => service.journalWarning(tag, message)))

/** An `Error:` journal line under an explicit gate tag. */
export const journalError = (tag: string, message: string) =>
  LoggerService.pipe(Effect.flatMap((service) => service.journalError(tag, message)))

/**
 * Create GitHub Actions annotation
 * @public
 */
export const annotation = (type: AnnotationType, message: string, file?: string, line?: number) =>
  LoggerService.pipe(Effect.flatMap((service) => service.annotation(type, message, file, line)))

/**
 * Logger layer plus an Effect logger that renders `Effect.log` through the same
 * journal.
 *
 * The override is load-bearing rather than cosmetic. Effect's default logger
 * stamps its own `timestamp=… level=… fiber=…` prefix, and the previous
 * override here replaced it with a bare `console.log` — which put every
 * `Effect.logError` on STDOUT, in a run whose whole point is that a failure is
 * greppable off stderr (T31). Routing both through the journal fixes the stream
 * as well as the shape.
 */
export const LoggerServicePretty = (config: LoggerConfig = defaultLoggerConfig) =>
  Layer.merge(
    LoggerServiceLive(config),
    Logger.layer([
      Logger.make(({ logLevel, message }) => {
        // `LogLevel` is a plain STRING union in Effect 4 — `"Fatal" | "Error" |
        // "Warn" | "Info" | …`, per
        // `vendor/effect/packages/effect/src/LogLevel.ts:67` — not a tagged
        // object. A `logLevel._tag` test narrows to `never` and silently routes
        // every line, failures included, to stdout.
        const text = String(message)
        if (logLevel === 'Error' || logLevel === 'Fatal') {
          return printJournalError(config.tag, text)
        }
        if (logLevel === 'Warn') {
          return printJournalWarning(config.tag, text)
        }
        return printJournal(config.tag, text)
      }),
    ])
  )
