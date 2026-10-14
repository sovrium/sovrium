/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback, useEffect, useState } from 'react'
import { computeQuestionnaireClasses } from '../design/questionnaire-default-classes'
import {
  Actions,
  Question,
  type Answer,
  type Item,
  type QuestionnaireIslandProps,
  type Status,
} from './parts/questionnaire-parts'
import type { ReactElement, ReactNode } from 'react'

/** The line that says a submission did not go through. */
const Failure = ({ text }: { readonly text: string }): ReactElement => (
  <p
    role="alert"
    className="text-destructive text-sm"
  >
    {text}
  </p>
)

/** True when an answer holds something to store. */
const isAnswered = (answer: Answer): boolean => answer !== undefined && answer.length > 0

/** Submit every answer once, through the form the questionnaire names. */
const submitAnswers = async (
  formRef: string,
  answers: Readonly<Record<string, Answer>>
): Promise<boolean> => {
  const body = Object.fromEntries(Object.entries(answers).filter(([, a]) => isAnswered(a)))
  const response = await fetch(`/api/forms/${encodeURIComponent(formRef)}/submissions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'Idempotency-Key': crypto.randomUUID(),
    },
    body: JSON.stringify(body),
  }).catch(() => undefined)
  return response?.ok === true
}

/** The number keys pick a single-choice item's choices, when it asks for it. */
function useShortcuts(
  item: Item | undefined,
  answerWith: (next: Answer, advance: boolean) => void
): void {
  useEffect(() => {
    if (item?.shortcuts !== true || item.choices === undefined || item.multiple === true) {
      return undefined
    }
    const onKey = (event: KeyboardEvent): void => {
      const choice = item.choices?.[Number(event.key) - 1]
      if (choice !== undefined) answerWith(choice.value, true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [item, answerWith])
}

/** In agent mode, a refused answer brings back the screen of the field it names. */
function useErrorScreen(
  agent: QuestionnaireIslandProps['agent'],
  items: readonly Item[],
  setIndex: (index: number) => void
): void {
  const name = agent?.error?.name
  useEffect(() => {
    const at = items.findIndex((item) => item.name === name)
    if (at >= 0) setIndex(at)
  }, [name, items, setIndex])
}

/**
 * The lines around a screen: agent mode's question above it, the progress,
 * and below it the submission's failure or agent mode's refusal, if any.
 */
const ScreenLines = ({
  agent,
  progress,
  failed,
  children,
}: {
  readonly agent: QuestionnaireIslandProps['agent']
  readonly progress: string | undefined
  readonly failed: string | undefined
  readonly children: ReactNode
}): ReactElement => (
  <>
    {agent?.source === undefined ? undefined : (
      <p
        data-slot="questionnaire-source"
        className="text-muted-foreground text-xs"
      >
        {agent.source}
      </p>
    )}
    {agent === undefined ? undefined : (
      <p
        data-slot="questionnaire-message"
        className="text-sm"
      >
        {agent.message}
      </p>
    )}
    {progress === undefined ? undefined : (
      <p className="text-muted-foreground text-xs">{progress}</p>
    )}
    {children}
    {failed === undefined ? undefined : <Failure text={failed} />}
    {agent?.error === undefined ? undefined : <Failure text={agent.error.message} />}
  </>
)

/** The screen on show, and the answers given so far: one per item, by its name. */
function useScreens(items: readonly Item[]) {
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<Readonly<Record<string, Answer>>>({})
  const item = items[index]
  const last = index === items.length - 1
  const answerWith = useCallback(
    (next: Answer, advance: boolean) => {
      if (item === undefined) return
      setAnswers((previous) => ({ ...previous, [item.name]: next }))
      if (advance && !last) setIndex((current) => current + 1)
    },
    [item, last]
  )
  useShortcuts(item, answerWith)
  return { index, setIndex, item, last, answers, answerWith }
}

/**
 * Where the answers go once the last screen is done: back to the agent's turn
 * in agent mode, otherwise in ONE submission through the form `formRef` names.
 */
function useFinish(
  props: Pick<QuestionnaireIslandProps, 'agent' | 'formRef'>,
  setStatus: (status: Status) => void
): (answers: Readonly<Record<string, Answer>>) => void {
  const { agent, formRef } = props
  return useCallback(
    (answers) => {
      if (agent !== undefined) return agent.onSubmit(answers)
      setStatus('sending')
      void submitAnswers(formRef ?? '', answers).then((ok) => setStatus(ok ? 'sent' : 'failed'))
    },
    [agent, formRef, setStatus]
  )
}

/** Whether the answers are on their way — this questionnaire's, or the agent mode's. */
const isSending = (status: Status, agent: QuestionnaireIslandProps['agent']): boolean =>
  status === 'sending' || agent?.sending === true

/** The Decline of agent mode, as the actions row takes it. */
const declineOf = (agent: QuestionnaireIslandProps['agent']) =>
  agent === undefined ? undefined : { label: agent.decline, onDecline: agent.onDecline }

/**
 * `questionnaire` — one question per screen. The answers live here, in the
 * page, until the last screen, and go out in ONE submission through the form
 * `formRef` names: nothing is written before the end. In agent mode they go
 * back to the agent's turn instead (`agent.onSubmit`), every screen offers
 * Decline, and Skip on the last screen sends what was answered.
 */
export default function QuestionnaireIsland({
  formRef,
  agent,
  items,
  showProgress = true,
  labels,
}: QuestionnaireIslandProps): ReactElement {
  const { index, setIndex, item, last, answers, answerWith } = useScreens(items)
  const [status, setStatus] = useState<Status>('answering')
  useErrorScreen(agent, items, setIndex)
  const finish = useFinish({ agent, formRef }, setStatus)
  if (status === 'sent' || item === undefined) return <p role="status">{labels.sent}</p>
  const answer = answers[item.name]
  const skip = (): void =>
    agent !== undefined && last
      ? finish({ ...answers, [item.name]: undefined })
      : answerWith(undefined, true)
  return (
    <div
      data-slot="questionnaire"
      data-mode={agent === undefined ? undefined : 'agent'}
      data-testid={agent?.testId}
      className={computeQuestionnaireClasses()}
    >
      <ScreenLines
        agent={agent}
        progress={
          showProgress ? `Question ${String(index + 1)} of ${String(items.length)}` : undefined
        }
        failed={status === 'failed' ? labels.failed : undefined}
      >
        <Question
          item={item}
          answer={answer}
          onChange={answerWith}
        />
      </ScreenLines>
      <Actions
        item={item}
        index={index}
        last={last}
        canContinue={item.required === false || isAnswered(answer)}
        sending={isSending(status, agent)}
        labels={labels}
        go={setIndex}
        skip={skip}
        finish={() => finish(answers)}
        decline={declineOf(agent)}
      />
    </div>
  )
}
