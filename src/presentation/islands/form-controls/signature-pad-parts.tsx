/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The pieces of the signature pad that hold no state: its reading, the way the
 * mark is made, and its actions. Apart from the island so its own file stays a
 * state machine.
 */

import { useMemo, type ReactElement } from 'react'
import { computePartButtonClasses } from '@/presentation/design/button-variant-classes'
import { computeInputDefaultClasses } from '@/presentation/design/input-default-classes'
import {
  computeInputGroupLabelClasses,
  computeInputGroupRootClasses,
} from '@/presentation/design/input-group-default-classes'
import { pendingControlProps } from '@/presentation/design/pending-state'
import {
  SignatureSignedItem,
  type SignedItemClasses,
} from '@/presentation/design/signature-signed-item'

/** Clear: base-nova's ghost button, small. */
const CLEAR = computePartButtonClasses({ variant: 'ghost', size: 'sm' })
/** The drawn/typed switch: base-nova's outline button, small. */
const TOGGLE = computePartButtonClasses({ variant: 'outline', size: 'sm' })
/** Sign, the one primary button of the pad. */
const SIGN = computePartButtonClasses({ variant: 'default', size: 'sm' })

export function SignedReading({
  signerName,
  signedAt,
  statement,
  lang,
  classes,
}: {
  readonly signerName: string
  readonly signedAt: string
  readonly statement: string
  readonly lang?: string
  readonly classes: SignedItemClasses
}): ReactElement {
  const day = new Intl.DateTimeFormat(lang ?? 'en-GB', { dateStyle: 'long' }).format(
    Date.parse(signedAt)
  )
  return (
    <SignatureSignedItem
      title={`Signed by ${signerName} on ${day}`}
      statement={statement}
      classes={classes}
    />
  )
}

/** The words the signer agrees to, above the well. */
export function PadStatement({ statement }: { readonly statement: string }): ReactElement {
  return (
    <p
      data-slot="signature-pad-statement"
      className="text-muted-foreground text-sm"
    >
      {statement}
    </p>
  )
}

/** The way the signer makes the mark: a drawn well, or a typed full name. */
export function SignatureInput({
  typed,
  name,
  setName,
  canvasRef,
  height,
}: {
  readonly typed: boolean
  readonly name: string
  readonly setName: (name: string) => void
  readonly canvasRef: React.RefObject<HTMLCanvasElement | null>
  readonly height: number
}): ReactElement {
  const wellStyle = useMemo(() => ({ height }), [height])
  if (typed) {
    return (
      <div
        data-slot="field"
        className={computeInputGroupRootClasses()}
      >
        <label
          htmlFor="signature-pad-typed-name"
          data-slot="field-label"
          className={computeInputGroupLabelClasses()}
        >
          Full name
        </label>
        <input
          id="signature-pad-typed-name"
          type="text"
          autoComplete="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          data-slot="input"
          className={computeInputDefaultClasses()}
        />
      </div>
    )
  }
  return (
    <canvas
      ref={canvasRef}
      data-signature-well=""
      data-slot="signature-pad-well"
      aria-label="Signing well: draw your signature"
      className="bg-background text-foreground focus-visible:ring-ring/50 w-full touch-none rounded-lg border border-dashed outline-none focus-visible:ring-3"
      style={wellStyle}
    />
  )
}

/** Clear, the typed/drawn switch and Sign. */
export function PadActions(props: {
  readonly typed: boolean
  readonly inked: boolean
  readonly ready: boolean
  readonly saving: boolean
  readonly allowTyped: boolean
  readonly onClear: () => void
  readonly onToggle: () => void
  readonly onSign: () => void
}): ReactElement {
  return (
    <div
      data-slot="signature-pad-actions"
      className="flex flex-wrap items-center justify-end gap-2"
    >
      {!props.typed && (
        <button
          type="button"
          data-slot="button"
          className={CLEAR}
          disabled={!props.inked}
          onClick={props.onClear}
        >
          Clear
        </button>
      )}
      {props.allowTyped && (
        <button
          type="button"
          data-slot="button"
          className={TOGGLE}
          onClick={props.onToggle}
        >
          {props.typed ? 'Draw instead' : 'Type your name instead'}
        </button>
      )}
      <button
        type="button"
        data-slot="button"
        className={SIGN}
        disabled={!props.ready}
        {...pendingControlProps(props.saving)}
        onClick={props.saving ? undefined : props.onSign}
      >
        {props.saving ? 'Signing…' : 'Sign'}
      </button>
    </div>
  )
}

/** The one failure a signer can act on. */
export function SaveFailed(): ReactElement {
  return (
    <p
      role="alert"
      className="text-destructive text-sm"
    >
      The signature could not be saved. Check the connection and sign again.
    </p>
  )
}
