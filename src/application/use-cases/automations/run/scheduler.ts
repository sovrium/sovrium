/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */



import type { App } from '@/domain/models/app'

const DEFAULT_CONCURRENCY_LIMIT = 5

interface AutomationQueueState {
  active: number
  waiters: Array<() => void>
}

const queues: Map<string, AutomationQueueState> = new Map()

const cancellers: Map<string, AbortController> = new Map()

export const resolveConcurrencyLimit = (
  automation: NonNullable<App['automations']>[number],
  env: Readonly<Record<string, string | undefined>>
): number => {
  const fromSchema = (automation as { readonly concurrency?: { readonly limit?: number } })
    .concurrency?.limit
  if (typeof fromSchema === 'number' && Number.isFinite(fromSchema) && fromSchema > 0) {
    return Math.floor(fromSchema)
  }
  const fromEnv = env['AUTOMATION_CONCURRENCY_DEFAULT']
  if (fromEnv !== undefined) {
    const parsed = Number(fromEnv)
    if (Number.isFinite(parsed) && parsed > 0) return Math.floor(parsed)
  }
  return DEFAULT_CONCURRENCY_LIMIT
}

export const acquireSlot = (automationName: string, limit: number): Promise<void> => {
  const state = queues.get(automationName) ?? { active: 0, waiters: [] }
  if (!queues.has(automationName)) {
    queues.set(automationName, state)
  }
  if (state.active < limit) {
    state.active = state.active + 1
    return Promise.resolve()
  }
  return new Promise<void>((resolve) => {
    state.waiters.push(() => {
      state.active = state.active + 1
      resolve()
    })
  })
}

export const releaseSlot = (automationName: string): void => {
  const state = queues.get(automationName)
  if (state === undefined) return
  state.active = Math.max(0, state.active - 1)
  const next = state.waiters.shift()
  if (next !== undefined) {
    next()
  }
}

export const registerCancellation = (runId: string): AbortController => {
  const controller = new AbortController()
  cancellers.set(runId, controller)
  return controller
}

export const unregisterCancellation = (runId: string): void => {
  cancellers.delete(runId)
}

export const signalCancellation = (runId: string): boolean => {
  const controller = cancellers.get(runId)
  if (controller === undefined) return false
  controller.abort()
  return true
}

export const isCancelled = (runId: string): boolean => {
  const controller = cancellers.get(runId)
  return controller !== undefined && controller.signal.aborted
}
