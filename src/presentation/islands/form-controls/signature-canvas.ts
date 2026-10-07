/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The drawing and the writing of a signature, apart from the pad's React tree.
 *
 * The stroke is drawn in the canvas's own `color` (the foreground ink of the
 * theme), so a signature reads in the ink of the page it was made on. A typed
 * signature is drawn into the same canvas size as an image too, so every stored
 * signature carries one, whichever way it was made.
 */

/** Wire pointer drawing onto `canvas`; calls `onInk` after the first stroke. Returns the cleanup. */
export function wireSignatureCanvas(
  canvas: HTMLCanvasElement,
  penWidth: number,
  onInk: () => void
): () => void {
  const context = canvas.getContext('2d')
  if (context === null) return () => undefined
  const ratio = globalThis.devicePixelRatio || 1
  canvas.setAttribute('width', String(canvas.clientWidth * ratio))
  canvas.setAttribute('height', String(canvas.clientHeight * ratio))
  context.scale(ratio, ratio)
  context.lineWidth = penWidth
  context.lineCap = 'round'
  context.lineJoin = 'round'
  context.strokeStyle = getComputedStyle(canvas).color
  const state = { drawing: false }
  const point = (event: PointerEvent): readonly [number, number] => {
    const box = canvas.getBoundingClientRect()
    return [event.clientX - box.left, event.clientY - box.top]
  }
  const down = (event: PointerEvent): void => {
    state.drawing = true
    canvas.setPointerCapture(event.pointerId)
    context.beginPath()
    context.moveTo(...point(event))
  }
  const move = (event: PointerEvent): void => {
    if (!state.drawing) return
    context.lineTo(...point(event))
    context.stroke()
    onInk()
  }
  const up = (): void => {
    state.drawing = false
  }
  canvas.addEventListener('pointerdown', down)
  canvas.addEventListener('pointermove', move)
  canvas.addEventListener('pointerup', up)
  canvas.addEventListener('pointercancel', up)
  return () => {
    canvas.removeEventListener('pointerdown', down)
    canvas.removeEventListener('pointermove', move)
    canvas.removeEventListener('pointerup', up)
    canvas.removeEventListener('pointercancel', up)
  }
}

/** Wipe the well. */
export function clearCanvas(canvas: HTMLCanvasElement): void {
  canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height)
}

/** A typed name drawn as an image the size of the well. */
export function typedSignatureCanvas(
  name: string,
  width: number,
  height: number
): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(width, 1)
  canvas.height = Math.max(height, 1)
  const context = canvas.getContext('2d')
  if (context !== null) {
    context.font = `italic ${Math.round(height / 3)}px sans-serif`
    context.textBaseline = 'middle'
    context.fillText(name, 16, height / 2)
  }
  return canvas
}

/** The canvas as a PNG. */
export const canvasPng = (canvas: HTMLCanvasElement): Promise<Blob> =>
  new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('no image'))), 'image/png')
  )

/** What a signature write sends, beside the image. */
export interface SignatureWrite {
  readonly table: string
  readonly recordId: string | number
  readonly field: string
  readonly bucket: string
  readonly statement: string
  readonly signerName: string
  readonly method: 'drawn' | 'typed'
}

/**
 * Upload the image through the bucket's ordinary upload route (so the uploader
 * is recorded), then write the signature onto the record through the records
 * API — where the write-once rule is enforced. Resolves the stored value.
 */
export async function writeSignature(
  image: Blob,
  write: SignatureWrite
): Promise<{ readonly signerName: string; readonly signedAt: string }> {
  const body = new FormData()
  body.append('file', image, `signature-${String(write.recordId)}.png`)
  const upload = await fetch(`/api/buckets/${encodeURIComponent(write.bucket)}/files`, {
    method: 'POST',
    body,
    credentials: 'same-origin',
  })
  if (!upload.ok) throw new Error(`upload failed (${upload.status})`)
  const { key } = (await upload.json()) as { readonly key: string }
  const signedAt = new Date().toISOString()
  const value = {
    image: key,
    signerName: write.signerName,
    signedAt,
    statement: write.statement,
    method: write.method,
  }
  const response = await fetch(
    `/api/tables/${encodeURIComponent(write.table)}/records/${encodeURIComponent(String(write.recordId))}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ [write.field]: value }),
    }
  )
  if (!response.ok) throw new Error(`write failed (${response.status})`)
  return { signerName: write.signerName, signedAt }
}
