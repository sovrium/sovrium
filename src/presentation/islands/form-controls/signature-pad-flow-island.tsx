/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `signature-pad-flow` island — the pad on a flow's signing page.
 *
 * It signs as the signer of the signing session, on the statement frozen for
 * her: the statement, the document to open, the code step when her flow
 * verifies a channel, the well or her typed name, the consent line, and the
 * actions. Pressing Sign is the consent. It can also decline, inline. A
 * refusal reads out by its contract code; a session that is over (404) hides
 * the well and the actions.
 */

import { useState, type ReactElement } from 'react'
import { postFlowDecline, postFlowSignature } from './signature-flow-requests'
import { ConsentNote, DeclineForm, ErrorLine, FlowActions } from './signature-pad-flow-actions'
import { DeclinedReading, DocumentRow, VerifyBlock } from './signature-pad-flow-parts'
import { SignatureInput, SignedReading } from './signature-pad-parts'
import { useFlowCode, useFlowMark, useFlowOutcome } from './use-signature-flow-pad'
import type { FlowPadProps } from './signature-flow-words'

type Mark = ReturnType<typeof useFlowMark>
type Outcome = ReturnType<typeof useFlowOutcome>
type Code = ReturnType<typeof useFlowCode>

/** Sign with the mark in hand and the code when one was asked; the pad moves on with the answer. */
async function signWith(props: FlowPadProps, state: { mark: Mark; outcome: Outcome; code: Code }) {
  const { mark, outcome, code } = state
  outcome.setBusy('sign')
  const signature = await mark.signature()
  const answer =
    signature === undefined
      ? ({ ok: false, code: 'IMAGE_INVALID' } as const)
      : await postFlowSignature({
          ...signature,
          ...(code.proof === undefined ? {} : { challenge: code.proof }),
        })
  outcome.setBusy(undefined)
  if (!answer.ok) return outcome.refused(answer.code)
  const signerName = mark.typed ? mark.name.trim() : props.signerName
  outcome.setPhase({ kind: 'signed', signerName, signedAt: answer.body.signedAt })
}

/** Decline with the reason given; the pad reads her answer. */
async function declineWith(outcome: Outcome, reason: string) {
  outcome.setBusy('decline')
  const answer = await postFlowDecline(reason)
  outcome.setBusy(undefined)
  if (answer.ok) outcome.setPhase({ kind: 'declined' })
  else outcome.refused(answer.code)
}

/** The well (or typed name), the consent line and the actions, while she signs. */
function SigningStep(props: FlowPadProps & { mark: Mark; outcome: Outcome; code: Code }) {
  const { mark, outcome, code } = props
  const s = props.uiStrings
  return (
    <>
      {code.channel !== undefined && (
        <VerifyBlock
          {...{ channel: code.channel, code: code.code, setCode: code.setCode }}
          {...{ classes: props.classes, strings: s, secondsLeft: code.secondsLeft }}
          destination={code.challenge?.destinationHint}
          sending={outcome.busy === 'code'}
          onSend={() => void code.send()}
        />
      )}
      <SignatureInput
        {...{ typed: mark.typed, name: mark.name, setName: mark.setName }}
        canvasRef={mark.canvasRef}
        height={props.height}
        strings={s}
      />
      {outcome.error !== undefined && (
        <ErrorLine
          code={outcome.error}
          strings={s}
        />
      )}
      <ConsentNote strings={s} />
      <FlowActions
        {...{ typed: mark.typed, inked: mark.inked, allowTyped: props.allowTyped, strings: s }}
        ready={mark.ready && code.complete}
        saving={outcome.busy === 'sign'}
        onDecline={() => outcome.setPhase({ kind: 'decline' })}
        onClear={mark.clear}
        onToggle={() => mark.setTyped(!mark.typed)}
        onSign={() => void signWith(props, { mark, outcome, code })}
      />
    </>
  )
}

/** The inline decline form, and its refusal line. */
function DecliningStep(props: FlowPadProps & { outcome: Outcome }) {
  const { outcome } = props
  const [reason, setReason] = useState('')
  return (
    <>
      <DeclineForm
        {...{ reason, setReason, classes: props.classes, strings: props.uiStrings }}
        declining={outcome.busy === 'decline'}
        onConfirm={() => void declineWith(outcome, reason)}
        onBack={() => outcome.setPhase({ kind: 'sign' })}
      />
      {outcome.error !== undefined && (
        <ErrorLine
          code={outcome.error}
          strings={props.uiStrings}
        />
      )}
    </>
  )
}

export default function SignaturePadFlowIsland(props: FlowPadProps): ReactElement {
  const outcome = useFlowOutcome()
  const mark = useFlowMark(props.penWidth, outcome.phase.kind === 'sign')
  const code = useFlowCode(props.verify[0], outcome)
  const { phase } = outcome
  if (phase.kind === 'signed') {
    return (
      <SignedReading
        {...{ signerName: phase.signerName, signedAt: phase.signedAt }}
        {...{ statement: props.statement, lang: props.lang, strings: props.uiStrings }}
        classes={props.signedClasses}
      />
    )
  }
  if (phase.kind === 'declined') {
    const { icons, signedClasses: classes, uiStrings: strings } = props
    return <DeclinedReading {...{ icon: icons.declined, classes, strings }} />
  }
  return (
    <div
      role="group"
      aria-label={props.label}
      data-slot="signature-pad"
      data-signing-mode="flow"
      className="flex flex-col gap-4"
    >
      <p
        data-slot="signature-pad-statement"
        className="text-foreground text-sm"
      >
        {props.statement}
      </p>
      <DocumentRow
        {...{ url: props.documentUrl, pages: props.documentPages, icon: props.icons.document }}
        {...{ classes: props.classes, strings: props.uiStrings }}
      />
      {phase.kind === 'sign' && <SigningStep {...{ ...props, mark, outcome, code }} />}
      {phase.kind === 'decline' && <DecliningStep {...{ ...props, outcome }} />}
      {phase.kind === 'ended' && (
        <ErrorLine
          code="NOT_FOUND"
          strings={props.uiStrings}
        />
      )}
    </div>
  )
}
