/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The low-level pieces every browser session shares: one serialised CDP
 * queue per view, a deadline around any promise, and the error a step fails
 * with.
 *
 * ONE CDP COMMAND IN FLIGHT PER VIEW ([internal ref] D4). A second `view.cdp` while
 * one is pending throws synchronously, so every command of a view — the
 * guard's answers to paused requests included — goes through {@link cdpQueue},
 * and each has its own deadline so one unanswered command cannot wedge the
 * guard for good.
 */

import type { BrowserFailureCode } from '@/application/ports/services/browser-driver'

/** A step failure carrying its code, thrown inside the async session code. */
export class StepError extends Error {
  constructor(
    readonly code: BrowserFailureCode,
    message: string
  ) {
    super(message)
    this.name = 'StepError'
  }
}

/** How long one CDP command may take before the queue moves on. */
export const CDP_COMMAND_TIMEOUT_MS = 10_000

export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms))

/** `promise`, or a rejection naming `what` once `ms` have passed. */
export const withDeadline = <T>(promise: Promise<T>, ms: number, what: string): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new StepError('step_failed', `${what} did not answer within ${String(ms)} ms`)),
      Math.max(1, ms)
    )
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error: unknown) => {
        clearTimeout(timer)
        reject(error instanceof Error ? error : new Error(String(error)))
      }
    )
  })

/** Send one CDP command of a view, after every command queued before it. */
export type CdpSend = <T = unknown>(
  method: string,
  params?: Record<string, unknown>,
  timeoutMs?: number
) => Promise<T>

/** A serialised CDP queue for `view`. */
export const cdpQueue = (view: Bun.WebView): CdpSend => {
  // Mutable on purpose: the tail of the command chain.
  const chain = { tail: Promise.resolve() as Promise<unknown> }
  return <T>(
    method: string,
    params?: Record<string, unknown>,
    timeoutMs = CDP_COMMAND_TIMEOUT_MS
  ) => {
    const sent = chain.tail.then(() =>
      withDeadline(view.cdp<T>(method, params), timeoutMs, `the browser command ${method}`)
    )
    // Not a swallow: the caller awaits `sent` and sees its rejection. Only the
    // chain's tail forgets it, so one failed command does not fail every later one.
    chain.tail = sent.catch(() => undefined)
    return sent
  }
}

/** The `data` of a CDP event, as a plain record. */
export const eventData = (event: Event): Readonly<Record<string, unknown>> => {
  const data: unknown = 'data' in event ? (event as MessageEvent).data : undefined
  return typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : {}
}

/** A string field of a record, or `undefined`. */
export const stringField = (
  record: Readonly<Record<string, unknown>> | undefined,
  key: string
): string | undefined => {
  const value = record?.[key]
  return typeof value === 'string' ? value : undefined
}

/** The message of anything thrown. */
export const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)
