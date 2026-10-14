/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { lazy, Suspense, useMemo } from 'react'
import {
  computeMarkerClasses,
  computeMarkerContentClasses,
} from '@/presentation/design/marker-default-classes'
import { toContent, toItems } from './elicitation-form'
import type { ChatElicitation, ChatElicitationAnswer, QuestionLabels } from './types'
import type { Answer } from '../parts/questionnaire-parts'
import type { ReactElement } from 'react'

/**
 * A question the agent asked in its turn (`elicit`), drawn as the
 * `questionnaire` in AGENT MODE: one screen per field of the flat form, typed
 * per field, with Decline on every screen and "Send answer" on the last. The
 * answers go back to the turn, never through a form. Once answered, the
 * questionnaire gives way to a `marker` saying how.
 *
 * The questionnaire is the page component's own island, loaded on the first
 * question only — a chat whose agent never asks pays nothing for it.
 */
const Questionnaire = lazy(() => import('../questionnaire-island'))

/**
 * The line a question leaves once it is over: its values, or that it was
 * declined; for a dismissed one, the question itself, and who asked it.
 */
const AnsweredMarker = ({
  text,
  testId = 'chat-elicitation-answered',
}: {
  readonly text: string
  readonly testId?: string
}): ReactElement => (
  <div
    data-slot="marker"
    data-variant="default"
    data-testid={testId}
    className={computeMarkerClasses('default')}
  >
    <span
      data-slot="marker-content"
      className={computeMarkerContentClasses()}
    >
      {text}
    </span>
  </div>
)

interface ChatElicitationPartProps {
  readonly elicitation: ChatElicitation
  readonly labels: QuestionLabels
  /** A request is in flight: the answer cannot be sent twice. */
  readonly busy: boolean
  readonly onAnswer: (elicitationId: string, answer: ChatElicitationAnswer) => void
}

/** The open question, as the questionnaire in agent mode. */
function OpenQuestion({
  elicitation,
  labels,
  busy,
  onAnswer,
}: ChatElicitationPartProps): ReactElement {
  const items = useMemo(() => toItems(elicitation, labels), [elicitation, labels])
  const agent = useMemo(
    () => ({
      message: elicitation.message,
      ...(elicitation.server !== undefined && {
        source: `${labels.askedBy} ${elicitation.server}`,
      }),
      decline: labels.decline,
      testId: 'chat-elicitation',
      sending: busy || elicitation.state === 'sending',
      ...(elicitation.error !== undefined && {
        error: { name: elicitation.error.field, message: elicitation.error.message },
      }),
      onSubmit: (answers: Readonly<Record<string, Answer>>) =>
        onAnswer(elicitation.id, { action: 'accept', content: toContent(elicitation, answers) }),
      onDecline: () => onAnswer(elicitation.id, { action: 'decline' }),
    }),
    [elicitation, labels, busy, onAnswer]
  )
  const questionnaireLabels = useMemo(
    () => ({ ...labels, submit: labels.send, sent: labels.answered, failed: '' }),
    [labels]
  )
  return (
    <Suspense fallback={null}>
      <Questionnaire
        agent={agent}
        items={items}
        labels={questionnaireLabels}
      />
    </Suspense>
  )
}

/** A question the agent asked: the questionnaire while open, then the line saying how it ended. */
export function ChatElicitationPart(props: ChatElicitationPartProps): ReactElement | null {
  const { elicitation, labels } = props
  switch (elicitation.state) {
    case 'cancelled':
      return (
        <AnsweredMarker
          testId="chat-elicitation-cancelled"
          text={
            elicitation.server === undefined
              ? elicitation.message
              : `${labels.askedBy} ${elicitation.server} · ${elicitation.message}`
          }
        />
      )
    case 'declined':
      return <AnsweredMarker text={labels.declined} />
    case 'closed':
      return (
        <AnsweredMarker
          testId="chat-elicitation-closed"
          text={labels.closed}
        />
      )
    case 'answered':
      return (
        <AnsweredMarker text={`${labels.answered} ${(elicitation.summary ?? []).join(' · ')}`} />
      )
    case 'open':
    case 'sending':
      return <OpenQuestion {...props} />
  }
}
