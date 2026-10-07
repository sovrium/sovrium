/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `signature-pad` island — the well a signer signs in.
 *
 * The statement sits above a ruled well; the signer draws, or (with
 * `allowTyped`) types their full name instead, and presses Sign. The mark is
 * uploaded as a PNG and the signature written onto the record — image, signer,
 * instant, method and the statement as it read — by `writeSignature`. Once
 * written, the pad becomes the reading "Signed by … on …", which is what the
 * server renders for a signed field from then on.
 */

import { useEffect, useRef, useState, type ReactElement } from 'react'
import {
  canvasPng,
  clearCanvas,
  typedSignatureCanvas,
  wireSignatureCanvas,
  writeSignature,
} from './signature-canvas'
import { PadActions, SaveFailed, SignatureInput, SignedReading } from './signature-pad-parts'

interface SignaturePadIslandProps {
  readonly table: string
  readonly recordId: string | number
  readonly field: string
  readonly bucket: string
  readonly statement: string
  readonly signerName: string
  readonly height: number
  readonly penWidth: number
  readonly allowTyped: boolean
  readonly label: string
  readonly lang?: string
}

type Status =
  | { readonly kind: 'idle' }
  | { readonly kind: 'saving' }
  | { readonly kind: 'failed' }
  | { readonly kind: 'signed'; readonly signerName: string; readonly signedAt: string }

/** Sign with the mark in hand: upload it and write the signature; reports the outcome. */
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
      bucket: props.bucket,
      statement: props.statement,
      signerName: mark.typed ? mark.name : props.signerName,
      method: mark.typed ? 'typed' : 'drawn',
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
      className="flex flex-col gap-3"
    >
      <p className="text-sm">{props.statement}</p>
      <SignatureInput
        typed={typed}
        name={name}
        setName={setName}
        canvasRef={canvasRef}
        height={props.height}
      />
      {status.kind === 'failed' && <SaveFailed />}
      <PadActions
        typed={typed}
        inked={inked}
        ready={typed ? name.trim().length > 0 : inked}
        saving={status.kind === 'saving'}
        allowTyped={props.allowTyped}
        onClear={() => clear(canvasRef.current, setInked)}
        onToggle={() => setTyped(!typed)}
        onSign={() => void sign()}
      />
    </div>
  )
}
