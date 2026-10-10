/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The one question a cloud command asks before it changes something —
 * `Create [internal ref]? [Y/n]` — and the rule for when it
 * asks at all.
 *
 * `--yes` answers it in advance. With no terminal to answer (a script, a CI
 * job) and no `--yes`, the command refuses rather than guessing: an
 * unattended run never creates or sends what nobody confirmed.
 */

import { createInterface } from 'node:readline'
import { Effect } from 'effect'

/** Whether a person can answer: both stdin and stdout are a terminal. */
export const isInteractive = (): boolean =>
  process.stdin.isTTY === true && process.stdout.isTTY === true

/** What a command does about a confirmation: go on, ask, or refuse. */
export type ConsentStep = 'proceed' | 'ask' | 'refuse'

/** `--yes` goes on; otherwise a terminal is asked and a script is refused. */
export const consentStep = (options: {
  readonly yes: boolean
  readonly interactive: boolean
}): ConsentStep => (options.yes ? 'proceed' : options.interactive ? 'ask' : 'refuse')

/**
 * `[Y/n]`: Enter, `y` or `yes` (any case, blanks around) is yes; anything else
 * is no. With `enterMeansYes: false` (`[y/N]`), Enter is no as well.
 */
export const readsAsYes = (answer: string, enterMeansYes = true): boolean =>
  (enterMeansYes ? /^(?:y|yes)?$/i : /^(?:y|yes)$/i).test(answer.trim())

/**
 * Ask `question` on the terminal and read one line, or `undefined` when the
 * input is closed (Ctrl-D) or interrupted (Ctrl-C). The question goes to
 * stderr so a command's stdout stays what it prints for scripts.
 */
export const askLine = (question: string): Effect.Effect<string | undefined> =>
  Effect.callback<string | undefined>((resume) => {
    const prompt = createInterface({ input: process.stdin, output: process.stderr })
    let answered = false
    const settle = (answer: string | undefined) => {
      if (answered) return
      answered = true
      prompt.close()
      resume(Effect.succeed(answer))
    }
    prompt.once('SIGINT', () => settle(undefined))
    prompt.once('close', () => settle(undefined))
    prompt.question(`${question} `, (answer) => settle(answer))
  })

/**
 * Ask `question [Y/n]` — or `[y/N]` when `enterMeansYes` is false — and read
 * one line. A closed input or an interrupt reads as no.
 */
export const askYesNo = (question: string, enterMeansYes = true): Effect.Effect<boolean> =>
  Effect.map(askLine(`${question} ${enterMeansYes ? '[Y/n]' : '[y/N]'}`), (answer) =>
    answer === undefined ? false : readsAsYes(answer, enterMeansYes)
  )

/**
 * The confirmation a cloud command asks before it changes something: `--yes`
 * goes on, a terminal is asked `question`, and a script — or a "no" — fails
 * with `refusal`.
 */
export const confirmOrFail = <E>(options: {
  readonly yes: boolean
  readonly question: string
  readonly refusal: E
  /** `false` asks `[y/N]`: Enter declines. Default `true`, `[Y/n]`. */
  readonly enterMeansYes?: boolean
}): Effect.Effect<void, E> => {
  const step = consentStep({ yes: options.yes, interactive: isInteractive() })
  if (step === 'proceed') return Effect.void
  if (step === 'refuse') return Effect.fail(options.refusal)
  return Effect.flatMap(askYesNo(options.question, options.enterMeansYes), (yes) =>
    yes ? Effect.void : Effect.fail(options.refusal)
  )
}
