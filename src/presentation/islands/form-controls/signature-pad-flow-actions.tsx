/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What the pad in flow mode does: the consent line, its actions, the inline
 * decline form and the one error line. Apart from the document and code parts
 * (`signature-pad-flow-parts.tsx`) so each file stays short.
 */

import { type ReactElement } from 'react'
import { computePartButtonClasses } from '@/presentation/design/button-variant-classes'
import { pendingControlProps } from '@/presentation/design/pending-state'
import { flowWord, type FlowClasses } from './signature-flow-words'
import type { PadStrings } from './signature-pad-parts'

const GHOST = computePartButtonClasses({ variant: 'ghost', size: 'sm' })
const OUTLINE = computePartButtonClasses({ variant: 'outline', size: 'sm' })
const PRIMARY = computePartButtonClasses({ variant: 'default', size: 'sm' })
const DESTRUCTIVE = computePartButtonClasses({ variant: 'destructive', size: 'sm' })

/** Directly above the actions: pressing Sign is the agreement. */
export function ConsentNote({ strings }: { readonly strings: PadStrings }): ReactElement {
  return (
    <p
      data-slot="signature-pad-consent"
      className="text-muted-foreground text-xs"
    >
      {flowWord(strings, 'consentNote')}
    </p>
  )
}

/** What the actions row needs: the mark's state, and what each button does. */
interface ActionsProps {
  readonly typed: boolean
  readonly inked: boolean
  readonly ready: boolean
  readonly saving: boolean
  readonly allowTyped: boolean
  readonly onDecline: () => void
  readonly onClear: () => void
  readonly onToggle: () => void
  readonly onSign: () => void
  readonly strings: PadStrings
}

/** Clear, the drawn/typed switch and Sign, pushed to the end of the row. */
function SignControls(props: ActionsProps): ReactElement {
  const s = props.strings
  return (
    <div className="ms-auto flex flex-wrap items-center gap-2">
      {!props.typed && (
        <button
          type="button"
          data-slot="button"
          className={GHOST}
          disabled={!props.inked}
          onClick={props.onClear}
        >
          {flowWord(s, 'clear')}
        </button>
      )}
      {props.allowTyped && (
        <button
          type="button"
          data-slot="button"
          className={OUTLINE}
          onClick={props.onToggle}
        >
          {flowWord(s, props.typed ? 'drawInstead' : 'typeInstead')}
        </button>
      )}
      <button
        type="button"
        data-slot="button"
        className={PRIMARY}
        disabled={!props.ready}
        {...pendingControlProps(props.saving)}
        onClick={props.saving ? undefined : props.onSign}
      >
        {flowWord(s, props.saving ? 'signing' : 'sign')}
      </button>
    </div>
  )
}

/** Decline on the left; Clear, the drawn/typed switch and Sign on the right. */
export function FlowActions(props: ActionsProps): ReactElement {
  return (
    <div
      data-slot="signature-pad-actions"
      className="flex flex-wrap items-center gap-2"
    >
      <button
        type="button"
        data-slot="button"
        className={GHOST}
        onClick={props.onDecline}
      >
        {flowWord(props.strings, 'declineOpen')}
      </button>
      <SignControls {...props} />
    </div>
  )
}

/** Declining, inline: an optional reason, then confirm or go back. */
export function DeclineForm(props: {
  readonly reason: string
  readonly setReason: (reason: string) => void
  readonly declining: boolean
  readonly onConfirm: () => void
  readonly onBack: () => void
  readonly classes: FlowClasses
  readonly strings: PadStrings
}): ReactElement {
  const { classes: c, strings: s } = props
  return (
    <div className="flex flex-col gap-3">
      <div
        data-slot="field"
        className={c.field}
      >
        <label
          htmlFor="signature-pad-decline-reason"
          data-slot="field-label"
          className={c.label}
        >
          {flowWord(s, 'declineReason')}
        </label>
        <textarea
          id="signature-pad-decline-reason"
          data-slot="textarea"
          className={c.textarea}
          maxLength={500}
          value={props.reason}
          onChange={(event) => props.setReason(event.target.value)}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          data-slot="button"
          className={DESTRUCTIVE}
          {...pendingControlProps(props.declining)}
          onClick={props.declining ? undefined : props.onConfirm}
        >
          {flowWord(s, props.declining ? 'declining' : 'declineConfirm')}
        </button>
        <button
          type="button"
          data-slot="button"
          className={GHOST}
          onClick={props.onBack}
        >
          {flowWord(s, 'declineBack')}
        </button>
      </div>
    </div>
  )
}

/** The one refusal line, by contract code; anything else is the connection's. */
export function ErrorLine(props: {
  readonly code: string
  readonly strings: PadStrings
}): ReactElement {
  const known = flowWord(props.strings, `error.${props.code}`)
  return (
    <p
      role="alert"
      className="text-destructive text-sm"
    >
      {known === '' ? flowWord(props.strings, 'saveFailed') : known}
    </p>
  )
}
