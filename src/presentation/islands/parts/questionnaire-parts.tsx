/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  computeQuestionnaireActionsClasses,
  computeQuestionnaireButtonClasses,
  computeQuestionnaireChoiceClasses,
  computeQuestionnaireInputClasses,
  computeQuestionnairePromptClasses,
} from '../../design/questionnaire-default-classes'
import type { ReactElement } from 'react'

/**
 * The parts of one questionnaire screen: the choices, the typed answer and the
 * actions row. Held apart from the island so each stays one job.
 */

export interface Choice {
  readonly value: string
  readonly label: string
  readonly description?: string
}

export interface Item {
  readonly name: string
  readonly prompt: string
  readonly description?: string
  readonly choices?: readonly Choice[]
  readonly multiple?: boolean
  readonly required?: boolean
  readonly input?: {
    readonly label: string
    readonly placeholder?: string
    /** The box's input type (`date`, `email`, `number`, …); text when absent. */
    readonly type?: string
  }
  readonly shortcuts?: boolean
}

/**
 * AGENT MODE, set by the chat and never by an author: the questions are the
 * ones an agent asked in its turn, and the answers go back to that turn
 * (`onSubmit`) rather than through a form. Every screen offers Decline, and
 * Skip on the last screen sends too.
 */
export interface QuestionnaireAgentMode {
  /** The agent's question, read above the screens. */
  readonly message: string
  /** Who is asking when it is not the agent itself — an external MCP server — read above the question. */
  readonly source?: string
  readonly decline: string
  readonly onSubmit: (answers: Readonly<Record<string, Answer>>) => void
  readonly onDecline: () => void
  readonly testId?: string
  /** The answer is on its way: the actions wait. */
  readonly sending?: boolean
  /** The answer was refused: the field it names, and why. */
  readonly error?: { readonly name: string; readonly message: string }
}

export interface QuestionnaireIslandProps {
  /** The form the answers are submitted through; absent in agent mode. */
  readonly formRef?: string
  readonly agent?: QuestionnaireAgentMode
  readonly items: readonly Item[]
  readonly showProgress?: boolean
  readonly labels: {
    readonly submit: string
    readonly next: string
    readonly previous: string
    readonly skip: string
    readonly sent: string
    readonly failed: string
  }
}

export type Answer = string | readonly string[] | undefined
export type Status = 'answering' | 'sending' | 'sent' | 'failed'

/** The choices of one item: radios for one answer, checkboxes for several. */
export function Choices({
  item,
  answer,
  onChange,
}: {
  readonly item: Item
  readonly answer: Answer
  readonly onChange: (next: Answer, advance: boolean) => void
}): ReactElement {
  const chosen = new Set(typeof answer === 'string' ? [answer] : (answer ?? []))
  return (
    <div
      data-slot="questionnaire-choices"
      className="flex flex-col gap-2"
    >
      {(item.choices ?? []).map((choice, index) => (
        <label
          key={choice.value}
          data-slot="questionnaire-choice"
          className={computeQuestionnaireChoiceClasses()}
        >
          <input
            type={item.multiple === true ? 'checkbox' : 'radio'}
            name={item.name}
            value={choice.value}
            checked={chosen.has(choice.value)}
            className="accent-primary size-4"
            onChange={(event) => {
              if (item.multiple !== true) return onChange(choice.value, true)
              const next = event.target.checked
                ? [...chosen, choice.value]
                : [...chosen].filter((value) => value !== choice.value)
              return onChange(next, false)
            }}
          />
          <span className="flex flex-col">
            <span>{choice.label}</span>
            {choice.description === undefined ? undefined : (
              <span className="text-muted-foreground text-xs">{choice.description}</span>
            )}
          </span>
          {item.shortcuts === true ? (
            <kbd className="text-muted-foreground ms-auto text-xs">{index + 1}</kbd>
          ) : undefined}
        </label>
      ))}
    </div>
  )
}

/** The typed answer of an `input` item. */
export function TypedAnswer({
  item,
  answer,
  onChange,
}: {
  readonly item: Item
  readonly answer: Answer
  readonly onChange: (next: Answer, advance: boolean) => void
}): ReactElement {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium">
      {item.input?.label}
      <input
        type={item.input?.type ?? 'text'}
        name={item.name}
        value={typeof answer === 'string' ? answer : ''}
        placeholder={item.input?.placeholder}
        className={computeQuestionnaireInputClasses()}
        onChange={(event) => onChange(event.target.value, false)}
      />
    </label>
  )
}

/** Agent mode's Decline: the person skips the whole question. */
const DeclineButton = ({
  decline,
  sending,
}: Pick<ActionsProps, 'decline' | 'sending'>): ReactElement | null =>
  decline === undefined ? null : (
    <button
      type="button"
      className={computeQuestionnaireButtonClasses('ghost')}
      disabled={sending}
      onClick={decline.onDecline}
    >
      {decline.label}
    </button>
  )

export interface ActionsProps {
  readonly item: Item
  readonly index: number
  readonly last: boolean
  readonly canContinue: boolean
  readonly sending: boolean
  readonly labels: QuestionnaireIslandProps['labels']
  readonly go: (index: number) => void
  readonly skip: () => void
  readonly finish: () => void
  /** Agent mode's Decline, on every screen. */
  readonly decline?: { readonly label: string; readonly onDecline: () => void } | undefined
}

/** Previous, Skip, and Next or the submit button on the last screen. */
export function Actions({
  item,
  index,
  last,
  canContinue,
  sending,
  labels,
  go,
  skip,
  finish,
  decline,
}: ActionsProps): ReactElement {
  const waitsForNext = item.multiple === true || item.input !== undefined
  return (
    <div className={computeQuestionnaireActionsClasses()}>
      <DeclineButton
        decline={decline}
        sending={sending}
      />
      {index > 0 ? (
        <button
          type="button"
          className={computeQuestionnaireButtonClasses('outline')}
          onClick={() => go(index - 1)}
        >
          {labels.previous}
        </button>
      ) : undefined}
      {item.required === false ? (
        <button
          type="button"
          className={computeQuestionnaireButtonClasses('ghost')}
          onClick={skip}
        >
          {labels.skip}
        </button>
      ) : undefined}
      {last ? (
        <button
          type="button"
          className={computeQuestionnaireButtonClasses('default')}
          disabled={!canContinue || sending}
          onClick={finish}
        >
          {labels.submit}
        </button>
      ) : undefined}
      {!last && waitsForNext ? (
        <button
          type="button"
          className={computeQuestionnaireButtonClasses('default')}
          disabled={!canContinue}
          onClick={() => go(index + 1)}
        >
          {labels.next}
        </button>
      ) : undefined}
    </div>
  )
}

/** One question: the prompt as the legend, its description, and its choices or its box. */
export function Question({
  item,
  answer,
  onChange,
}: {
  readonly item: Item
  readonly answer: Answer
  readonly onChange: (next: Answer, advance: boolean) => void
}): ReactElement {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className={computeQuestionnairePromptClasses()}>{item.prompt}</legend>
      {item.description === undefined ? undefined : (
        <p className="text-muted-foreground text-sm">{item.description}</p>
      )}
      {item.input === undefined ? (
        <Choices
          item={item}
          answer={answer}
          onChange={onChange}
        />
      ) : (
        <TypedAnswer
          item={item}
          answer={answer}
          onChange={onChange}
        />
      )}
    </fieldset>
  )
}
