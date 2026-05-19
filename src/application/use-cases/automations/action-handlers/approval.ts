/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Effect } from 'effect'
import { parseDuration } from '@/domain/utils/parse-duration'
import { db } from '@/infrastructure/database'
import { automationApprovalRequests } from '@/infrastructure/database/drizzle/schema/automation'
import { stringProp } from './shared'
import type { ActionHandler, ActionOutcome } from './shared'

const insertApprovalRequest = (input: {
  readonly message: string
  readonly timeoutSeconds: number | undefined
  readonly expiresAt: Date | undefined
}): Effect.Effect<void> =>
  Effect.promise(() =>
    db
      .insert(automationApprovalRequests)
      .values({
        stepIndex: 0,
        status: 'pending',
        message: input.message,
        ...(input.timeoutSeconds !== undefined ? { timeoutSeconds: input.timeoutSeconds } : {}),
        ...(input.expiresAt !== undefined ? { expiresAt: input.expiresAt } : {}),
      })
      .then(() => undefined)
      .catch(() => undefined)
  )

export const handleApprovalRequest: ActionHandler = (action, _app, _automation) =>
  Effect.gen(function* () {
    const props = (action['props'] as Record<string, unknown> | undefined) ?? {}
    const message = stringProp(props, 'message')
    const { timeout, onTimeout } = props

    const timeoutMs =
      typeof timeout === 'string' && timeout.trim() !== '' ? parseDuration(timeout) : NaN
    const hasTimeout = Number.isFinite(timeoutMs) && timeoutMs > 0
    const timeoutSeconds = hasTimeout ? Math.floor(timeoutMs / 1000) : undefined
    const expiresAt = hasTimeout ? new Date(Date.now() + timeoutMs) : undefined

    yield* insertApprovalRequest({ message, timeoutSeconds, expiresAt })

    return {
      status: 'success',
      output: {
        status: 'pending',
        ...(typeof timeout === 'string' ? { timeout } : {}),
        ...(typeof onTimeout === 'string' ? { onTimeout } : {}),
      },
    } as const satisfies ActionOutcome
  })
