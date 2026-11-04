/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The state of the pad in flow mode, in three hooks: the mark she makes, the
 * code she is sent, and where her answer stands. The island composes them and
 * sends the requests (`signature-flow-requests.ts`).
 */

import { useEffect, useRef, useState } from 'react'
import { canvasPng, clearCanvas, wireSignatureCanvas } from './signature-canvas'
import { requestFlowCode, type FlowChallenge, type FlowSignature } from './signature-flow-requests'
import type { FlowPhase } from './signature-flow-words'

/** Seconds until `instant`, never below zero. */
const secondsUntil = (instant: string | undefined, now: number): number =>
  instant === undefined ? 0 : Math.max(0, Math.ceil((Date.parse(instant) - now) / 1000))

/** The seconds left until `until`, ticking each second while the wait runs. */
function useSecondsLeft(until: string | undefined): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (secondsUntil(until, Date.now()) === 0) return undefined
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [until, now])
  return secondsUntil(until, now)
}

/** The mark: drawn in the well (wired while `active`), or her typed name. */
export function useFlowMark(penWidth: number, active: boolean) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [typed, setTyped] = useState(false)
  const [name, setName] = useState('')
  const [inked, setInked] = useState(false)
  useEffect(() => {
    const canvas = canvasRef.current
    if (typed || !active || canvas === null) return undefined
    return wireSignatureCanvas(canvas, penWidth, () => setInked(true))
  }, [typed, active, penWidth])
  const clear = (): void => {
    if (canvasRef.current) clearCanvas(canvasRef.current)
    setInked(false)
  }
  /** The mark as the sign road takes it; `undefined` when the drawing cannot be read. */
  const signature = async (): Promise<FlowSignature | undefined> => {
    if (typed) return { method: 'typed', typedName: name.trim() }
    const canvas = canvasRef.current
    const image = canvas === null ? undefined : await canvasPng(canvas).catch(() => undefined)
    return image === undefined ? undefined : { method: 'drawn', image }
  }
  const ready = typed ? name.trim().length > 0 : inked
  return { canvasRef, typed, setTyped, name, setName, inked, ready, clear, signature }
}

/** Where her answer stands, the request in flight, and the last refusal. */
export function useFlowOutcome() {
  const [phase, setPhase] = useState<FlowPhase>({ kind: 'sign' })
  const [busy, setBusy] = useState<'sign' | 'decline' | 'code' | undefined>(undefined)
  const [error, setError] = useState<string | undefined>(undefined)
  /** A refusal read out; a session that is over (404) closes the pad. */
  const refused = (code: string): void => {
    setError(code)
    if (code === 'NOT_FOUND') setPhase({ kind: 'ended' })
  }
  return { phase, setPhase, busy, setBusy, error, setError, refused }
}

/** The code step on `channel`: ask for a code, keep what came back, wait before a new one. */
export function useFlowCode(
  channel: string | undefined,
  outcome: ReturnType<typeof useFlowOutcome>
) {
  const [challenge, setChallenge] = useState<FlowChallenge | undefined>(undefined)
  const [code, setCode] = useState('')
  const secondsLeft = useSecondsLeft(challenge?.resendAfter)
  const send = async (): Promise<void> => {
    outcome.setBusy('code')
    const answer = await requestFlowCode(channel ?? 'email')
    outcome.setBusy(undefined)
    if (!answer.ok) return outcome.refused(answer.code)
    setChallenge(answer.body)
    outcome.setError(undefined)
  }
  const proof = challenge === undefined ? undefined : { challengeId: challenge.challengeId, code }
  const complete = channel === undefined || code.length === 6
  return { channel, challenge, code, setCode, secondsLeft, send, proof, complete }
}
