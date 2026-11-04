/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `signature-pad` island — the well a signer signs in.
 *
 * The statement sits above a dashed well; the signer draws, or (with
 * `allowTyped`) types their full name instead, and presses Sign. The mark is
 * posted as a PNG to the field's signing route by `writeSignature`, with the
 * page it is drawn on and the digest of the statement shown; the server stores
 * the signature it authors. Once stored, the pad becomes the reading "Signed by
 * … on …", which is what the server renders for a signed field from then on.
 */

import { useEffect, useRef, useState, type ReactElement } from 'react'
import {
  canvasPng,
  clearCanvas,
  typedSignatureCanvas,
  wireSignatureCanvas,
  writeSignature,
} from './signature-canvas'
import {
  PadActions,
  PadStatement,
  SaveFailed,
  SignatureInput,
  SignedReading,
  type PadStrings,
} from './signature-pad-parts'
import type { SignedItemClasses } from '@/presentation/design/signature-signed-item'

interface SignaturePadIslandProps {
  readonly table: string
  readonly recordId: string | number
  readonly field: string
  readonly page: string
  readonly statement: string
  readonly statementDigest: string
  readonly height: number
  readonly penWidth: number
  readonly allowTyped: boolean
  readonly label: string
  readonly lang?: string
  /** The signed reading's item classes, resolved by the server. */
  readonly signedClasses: SignedItemClasses
  /** Every word the pad draws, in the page language (`signaturePad.*`). */
  readonly uiStrings: PadStrings
}

type Status =
  | { readonly kind: 'idle' }
  | { readonly kind: 'saving' }
  | { readonly kind: 'failed' }
  | { readonly kind: 'signed'; readonly signerName: string; readonly signedAt: string }

/** Sign with the mark in hand: post it to the signing route; reports the outcome. */
async function signWith(
  props: SignaturePadIslandProps,
  mark: {
    readonly typed: boolean
    readonly name: string
    readonly canvas: HTMLCanvasElement | null
  }
): Promise<Status> {
  const image = mark.typed ? typedSignatureCanvas(mark.name, 480, props.height) : mark.canvas
  if (image === null) return { kind: 'idle' }
  try {
    const written = await writeSignature(await canvasPng(image), {
      table: props.table,
      recordId: props.recordId,
      field: props.field,
      page: props.page,
      statementDigest: props.statementDigest,
      method: mark.typed ? 'typed' : 'drawn',
      ...(mark.typed ? { typedName: mark.name } : {}),
    })
    return { kind: 'signed', ...written }
  } catch {
    return { kind: 'failed' }
  }
}

/** Wipe the well and forget its ink. */
function clear(canvas: HTMLCanvasElement | null, setInked: (inked: boolean) => void): void {
  if (canvas) clearCanvas(canvas)
  setInked(false)
}

export default function SignaturePadIsland(props: SignaturePadIslandProps): ReactElement {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [typed, setTyped] = useState(false)
  const [name, setName] = useState('')
  const [inked, setInked] = useState(false)
  const [status, setStatus] = useState<Status>({ kind: 'idle' })

  useEffect(() => {
    const canvas = canvasRef.current
    if (typed || canvas === null) return undefined
    return wireSignatureCanvas(canvas, props.penWidth, () => setInked(true))
  }, [typed, props.penWidth])

  if (status.kind === 'signed') {
    return (
      <SignedReading
        signerName={status.signerName}
        signedAt={status.signedAt}
        statement={props.statement}
        lang={props.lang}
        classes={props.signedClasses}
        strings={props.uiStrings}
      />
    )
  }

  const sign = async (): Promise<void> => {
    setStatus({ kind: 'saving' })
    setStatus(await signWith(props, { typed, name: name.trim(), canvas: canvasRef.current }))
  }

  return (
    <div
      role="group"
      aria-label={props.label}
      data-slot="signature-pad"
      className="flex flex-col gap-3"
    >
      <PadStatement statement={props.statement} />
      <SignatureInput
        {...{ typed, name, setName, canvasRef }}
        height={props.height}
        strings={props.uiStrings}
      />
      {status.kind === 'failed' && <SaveFailed strings={props.uiStrings} />}
      <PadActions
        typed={typed}
        inked={inked}
        ready={typed ? name.trim().length > 0 : inked}
        saving={status.kind === 'saving'}
        allowTyped={props.allowTyped}
        onClear={() => clear(canvasRef.current, setInked)}
        onToggle={() => setTyped(!typed)}
        onSign={() => void sign()}
        strings={props.uiStrings}
      />
    </div>
  )
}
