/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A configuration the decode pipeline refused.
 *
 * Its `message` is ALREADY the report the author should read — the located,
 * named lines `buildExcessPropertyReport` (or a semantic check) produced. This
 * type exists for one reason: so a CLI can tell a refusal apart from a crash.
 *
 * WHY THAT DISTINCTION EARNS A TYPE. `formatRuntimeError` answers "what went
 * wrong inside the engine": for a plain `Error` it returns `.stack`, and for an
 * Effect `FiberFailure` it unwraps the real `Cause`. That is correct for a fault
 * and wrong for a refusal. A config Sovrium declined is not a bug in Sovrium,
 * and a reader whose app just stopped booting on a breaking change should see
 * the property we could not read on line one — not a stack frame inviting them
 * to debug our code instead of their config.
 *
 * The fault branch in `start.ts` used to read `Console.error('Failed to start
 * server:', error)`, handing the object to Bun's pretty printer for a
 * source-context window. That form is gone: the printer colours its output on a
 * TTY, which T35 #3 bans. The branch now formats through `formatRuntimeError`
 * and keeps the stack, which is the half this distinction turns on.
 *
 * Only this shape prints as prose. Everything else keeps its stack.
 */
export class ConfigRejectedError extends Error {
  constructor(message: string) {
    super(message)
    // eslint-disable-next-line functional/no-expression-statements -- Required for Error subclass
    this.name = 'ConfigRejectedError'
  }
}

/** Narrow a caught value to a config refusal. Pure. */
export const isConfigRejectedError = (error: unknown): error is ConfigRejectedError =>
  error instanceof ConfigRejectedError

/**
 * Render a refusal as the block a CLI prints.
 *
 * `action` is the past participle of what did not happen (`started`, `built`),
 * so the first line states the consequence before the diagnosis — a reader who
 * stops after one line still knows nothing was left half-done.
 *
 * THE `Error:` PREFIX IS LOAD-BEARING, not decoration. It is the conventional
 * CLI marker operators and log scrapers grep for, and the output this replaced
 * carried it too (as the first line of a stack). Dropping it would have been a
 * silent break for anyone matching on it.
 *
 * NOTHING IS SAID ABOUT THE CAUSE. An earlier draft closed with "every property
 * in your config must be one Sovrium understands" — true of the common case and
 * wrong for every other refusal this same path carries (a config that is not an
 * object at all, an unresolvable foreign key). Asserting a cause the caller has
 * not established is how a helpful message becomes a misleading one; the report
 * itself already names what happened.
 *
 * The closing line names `sovrium validate` because it is the only way to ask
 * the same question without side effects, and because now that this refusal is
 * fatal it is the command a CI gate should be running. Pure.
 */
export const formatConfigRejection = (
  error: Readonly<ConfigRejectedError>,
  action: string
): string =>
  [
    `Error: Sovrium refused this configuration — nothing was ${action}.`,
    '',
    error.message,
    '',
    'Run `sovrium validate <config>` to check a config without side effects.',
  ].join('\n')
