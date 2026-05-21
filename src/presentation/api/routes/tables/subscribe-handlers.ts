/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { hasReadPermissionForRoles } from '@/application/use-cases/tables/permissions/permissions'
import { buildEffectiveRoles } from '@/application/use-cases/tables/user-groups'
import { getTableContext } from '@/presentation/api/utils/context-helpers'
import type { App } from '@/domain/models/app'
import type { Context } from 'hono'

const parseFieldSelection = (raw: string | undefined): readonly string[] | undefined => {
  if (raw === undefined || raw.trim() === '') return undefined
  return raw
    .split(',')
    .map((field) => field.trim())
    .filter((field) => field.length > 0)
}

const encodeSseMessage = (message: Record<string, unknown>): string =>
  `data: ${JSON.stringify(message)}\n\n`

export function handleSubscribe(c: Context, app: App): Response {
  const { tableName, userRole, userGroups } = getTableContext(c)

  const table = app.tables?.find((t) => t.name === tableName)
  if (!table) {
    return c.json({ success: false, message: 'Table not found', code: 'NOT_FOUND' }, 404)
  }

  const effectiveRoles = buildEffectiveRoles(userRole, userGroups)
  if (!hasReadPermissionForRoles(table, effectiveRoles, app.tables)) {
    return c.json({ success: false, message: 'Table not found', code: 'NOT_FOUND' }, 404)
  }

  const fields = parseFieldSelection(c.req.query('fields'))
  const filter = c.req.query('filter')

  const now = new Date().toISOString()
  const subscribed = encodeSseMessage({ type: 'subscribed', table: tableName })
  const heartbeat = encodeSseMessage({ type: 'heartbeat', timestamp: now })

  const encoder = new TextEncoder()
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(subscribed))
      controller.enqueue(encoder.encode(heartbeat))
      controller.close()
    },
  })

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
      ...(filter !== undefined ? { 'X-Subscription-Filter': filter } : {}),
      ...(fields !== undefined ? { 'X-Subscription-Fields': fields.join(',') } : {}),
    },
  })
}
