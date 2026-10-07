/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { App } from '@/domain/models/app'

/** An automation's trigger, as the app declares it. */
export type Trigger = NonNullable<App['automations']>[number]['trigger']

/** The HTTP methods a webhook trigger may declare. */
export type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

const METHODS: ReadonlyArray<Method> = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']

export const isMethod = (m: string): m is Method => (METHODS as ReadonlyArray<string>).includes(m)

export const allowedMethodsFor = (trigger: Trigger): ReadonlyArray<Method> => {
  if (trigger.type !== 'webhook') return []
  const m = trigger.method
  return Array.isArray(m) ? (m as ReadonlyArray<Method>) : [m as Method]
}
