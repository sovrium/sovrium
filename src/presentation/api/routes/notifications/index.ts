/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { createNotificationSubscription } from '@/application/use-cases/notifications/create-subscription'
import { deleteNotificationSubscription } from '@/application/use-cases/notifications/delete-subscription'
import { dismissNotification } from '@/application/use-cases/notifications/dismiss'
import { getNotificationPreferences } from '@/application/use-cases/notifications/get-preferences'
import { listInbox } from '@/application/use-cases/notifications/list-inbox'
import { markAllNotificationsRead } from '@/application/use-cases/notifications/mark-all-read'
import { markNotificationRead } from '@/application/use-cases/notifications/mark-read'
import { updateNotificationPreferences } from '@/application/use-cases/notifications/update-preferences'
import { requireSession, unauthorized } from '@/presentation/api/utils/auth-helpers'
import { provideNotificationLive } from './effect-runner'
import type { App } from '@/domain/models/app'
import type { Context, Hono } from 'hono'


const shapeNotification = (row: Record<string, unknown>): Record<string, unknown> => {
  const data = row['data'] as Record<string, unknown> | null | undefined
  return {
    id: row['id'],
    type: row['type'],
    title: row['title'],
    body: row['body'],
    read: row['read'],
    dismissed: row['dismissed'],
    link: data?.['link'] ?? null,
    sender: data?.['sender'] ?? null,
    data: row['data'],
    createdAt: row['createdAt'],
  }
}

const parseNonNegativeInt = (raw: string | undefined): number | undefined => {
  if (raw === undefined || raw === '') return undefined
  const n = Number(raw)
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : undefined
}

async function handleListInbox(c: Context) {
  const session = requireSession(c)
  if (session === undefined) return unauthorized(c)

  const status = c.req.query('status')
  const limit = parseNonNegativeInt(c.req.query('limit'))
  const offset = parseNonNegativeInt(c.req.query('offset')) ?? 0

  const result = await Effect.runPromise(
    provideNotificationLive(
      listInbox({
        userId: session.userId,
        ...(status !== undefined ? { status } : {}),
        ...(limit !== undefined ? { limit } : {}),
        offset,
      })
    ).pipe(Effect.either)
  )
  if (result._tag === 'Left') {
    return c.json({ success: false, message: 'Failed to load notifications' }, 500)
  }

  return c.json(
    {
      notifications: result.right.notifications.map((row) => shapeNotification(row)),
      total: result.right.total,
      limit: result.right.limit ?? null,
      offset: result.right.offset,
    },
    200
  )
}

async function handleMarkRead(c: Context) {
  const session = requireSession(c)
  if (session === undefined) return unauthorized(c)
  const id = c.req.param('id')
  if (id === undefined || id === '') {
    return c.json({ success: false, message: 'Notification id required' }, 400)
  }

  const result = await Effect.runPromise(
    provideNotificationLive(
      markNotificationRead({ userId: session.userId, notificationId: id })
    ).pipe(Effect.either)
  )
  if (result._tag === 'Left') {
    return c.json({ success: false, message: 'Failed to mark as read' }, 500)
  }
  if (!result.right.ok) {
    return c.json({ success: false, message: 'Notification not found' }, 404)
  }
  return c.json({ success: true }, 200)
}

async function handleMarkAllRead(c: Context) {
  const session = requireSession(c)
  if (session === undefined) return unauthorized(c)

  const result = await Effect.runPromise(
    provideNotificationLive(markAllNotificationsRead({ userId: session.userId })).pipe(
      Effect.either
    )
  )
  if (result._tag === 'Left') {
    return c.json({ success: false, message: 'Failed to mark all as read' }, 500)
  }
  return c.json({ success: true }, 200)
}

async function handleDismiss(c: Context) {
  const session = requireSession(c)
  if (session === undefined) return unauthorized(c)
  const id = c.req.param('id')
  if (id === undefined || id === '') {
    return c.json({ success: false, message: 'Notification id required' }, 400)
  }

  const result = await Effect.runPromise(
    provideNotificationLive(
      dismissNotification({ userId: session.userId, notificationId: id })
    ).pipe(Effect.either)
  )
  if (result._tag === 'Left') {
    return c.json({ success: false, message: 'Failed to dismiss' }, 500)
  }
  if (!result.right.ok) {
    return c.json({ success: false, message: 'Notification not found' }, 404)
  }
  return c.json({ success: true }, 200)
}

async function handleGetPreferences(c: Context, app: App) {
  const session = requireSession(c)
  if (session === undefined) return unauthorized(c)

  const result = await Effect.runPromise(
    provideNotificationLive(getNotificationPreferences({ userId: session.userId, app })).pipe(
      Effect.either
    )
  )
  if (result._tag === 'Left') {
    return c.json({ success: false, message: 'Failed to load preferences' }, 500)
  }
  return c.json(result.right, 200)
}

async function handlePatchPreferences(c: Context) {
  const session = requireSession(c)
  if (session === undefined) return unauthorized(c)

  const body = (await c.req.json().catch(() => undefined)) as
    | Record<string, Record<string, boolean>>
    | undefined
  if (body === undefined || typeof body !== 'object') {
    return c.json({ success: false, message: 'Invalid preferences payload' }, 400)
  }

  const result = await Effect.runPromise(
    provideNotificationLive(updateNotificationPreferences({ userId: session.userId, body })).pipe(
      Effect.either
    )
  )
  if (result._tag === 'Left') {
    return c.json({ success: false, message: 'Failed to update preferences' }, 500)
  }
  return c.json({ success: true }, 200)
}

async function handleCreateSubscription(c: Context) {
  const session = requireSession(c)
  if (session === undefined) return unauthorized(c)

  const body = (await c.req.json().catch(() => undefined)) as
    | { tableName?: string; recordId?: string; fields?: readonly string[] }
    | undefined
  if (body === undefined || typeof body.tableName !== 'string' || body.tableName === '') {
    return c.json({ success: false, message: 'tableName required' }, 400)
  }

  const result = await Effect.runPromise(
    provideNotificationLive(
      createNotificationSubscription({
        userId: session.userId,
        tableName: body.tableName,
        ...(typeof body.recordId === 'string' && body.recordId !== ''
          ? { recordId: body.recordId }
          : {}),
        ...(Array.isArray(body.fields) ? { fields: body.fields } : {}),
      })
    ).pipe(Effect.either)
  )
  if (result._tag === 'Left') {
    return c.json({ success: false, message: 'Failed to create subscription' }, 500)
  }
  return c.json(
    {
      id: result.right['id'],
      tableName: result.right['tableName'],
      recordId: result.right['recordId'],
      fields: result.right['fields'],
      createdAt: result.right['createdAt'],
    },
    201
  )
}

async function handleDeleteSubscription(c: Context) {
  const session = requireSession(c)
  if (session === undefined) return unauthorized(c)
  const id = c.req.param('id')
  if (id === undefined || id === '') {
    return c.json({ success: false, message: 'Subscription id required' }, 400)
  }

  const result = await Effect.runPromise(
    provideNotificationLive(
      deleteNotificationSubscription({ userId: session.userId, subscriptionId: id })
    ).pipe(Effect.either)
  )
  if (result._tag === 'Left') {
    return c.json({ success: false, message: 'Failed to delete subscription' }, 500)
  }
  if (!result.right) {
    return c.json({ success: false, message: 'Subscription not found' }, 404)
  }
  return c.json({ success: true }, 200)
}

export function chainNotificationRoutes<T extends Hono>(honoApp: T, app: App): T {
  return honoApp
    .get('/api/notifications', handleListInbox)
    .patch('/api/notifications/:id/read', handleMarkRead)
    .post('/api/notifications/mark-all-read', handleMarkAllRead)
    .post('/api/notifications/:id/dismiss', handleDismiss)
    .get('/api/notifications/preferences', (c) => handleGetPreferences(c, app))
    .patch('/api/notifications/preferences', handlePatchPreferences)
    .post('/api/notifications/subscriptions', handleCreateSubscription)
    .delete('/api/notifications/subscriptions/:id', handleDeleteSubscription) as T
}
