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

const BUTTON =
  'inline-flex h-9 items-center rounded-md border border-border px-4 text-sm font-medium hover:bg-muted disabled:opacity-50'
const PRIMARY =
  'inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50'

export function SignedReading({
  signerName,
  signedAt,
  statement,
  lang,
}: {
  readonly signerName: string
  readonly signedAt: string
  readonly statement: string
  readonly lang?: string
}): ReactElement {
  const day = new Intl.DateTimeFormat(lang ?? 'en-GB', { dateStyle: 'long' }).format(
    Date.parse(signedAt)
  )
  return (
    <figure
      role="status"
      className="flex flex-col gap-1"
    >
      <figcaption className="text-sm font-medium">{`Signed by ${signerName} on ${day}`}</figcaption>
      <blockquote className="text-muted-foreground text-sm">{statement}</blockquote>
    </figure>
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
      <label className="flex flex-col gap-1 text-sm">
        Full name
        <input
          type="text"
          autoComplete="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="border-border h-9 rounded-md border px-3"
        />
      </label>
    )
  }
  return (
    <canvas
      ref={canvasRef}
      data-signature-well=""
      aria-label="Signing well: draw your signature"
      className="border-border text-foreground w-full touch-none rounded-md border border-b-2"
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
    <div className="flex flex-wrap items-center gap-2">
      {!props.typed && (
        <button
          type="button"
          className={BUTTON}
          disabled={!props.inked}
          onClick={props.onClear}
        >
          Clear
        </button>
      )}
      {props.allowTyped && (
        <button
          type="button"
          className={BUTTON}
          onClick={props.onToggle}
        >
          {props.typed ? 'Draw instead' : 'Type your name instead'}
        </button>
      )}
      <span className="flex-1" />
      <button
        type="button"
        className={PRIMARY}
        disabled={!props.ready || props.saving}
        onClick={props.onSign}
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
      className="text-error-fg text-sm"
    >
      The signature could not be saved. Check the connection and sign again.
    </p>
  )
}
