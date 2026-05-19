/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { z } from '@hono/zod-openapi'
import { successResponseSchema } from '@/domain/models/api/_shared/common'
import { errorResponseSchema } from '@/domain/models/api/_shared/error'
import {
  notificationListResponseSchema,
  notificationPreferencesSchema,
} from '@/domain/models/api/notifications'
import { type StaticGroupSpec, jsonResponse } from './_shared/route-spec'

const errorResponse = (description: string) => jsonResponse(errorResponseSchema, description)
const successResponse = (description: string) => jsonResponse(successResponseSchema, description)
const idParam = z.object({ id: z.string().describe('Notification or subscription identifier') })

export const notificationGroup: StaticGroupSpec = {
  tag: 'notifications',
  tagDescription: 'In-app notification inbox, preferences, and record subscriptions',
  routes: [
    {
      method: 'get',
      pathTemplate: '/api/notifications',
      summary: 'List the notification inbox',
      description: 'Returns the authenticated user notifications, optionally filtered by status.',
      operationIdBase: 'listNotificationInbox',
      request: {
        query: z.object({
          status: z.string().optional().describe('Filter by status (e.g. "unread")'),
          limit: z.string().optional().describe('Maximum number of notifications'),
          offset: z.string().optional().describe('Pagination offset'),
        }),
      },
      responses: {
        200: jsonResponse(notificationListResponseSchema, 'Notification inbox'),
        401: errorResponse('Not authenticated'),
        500: errorResponse('Failed to load notifications'),
      },
    },
    {
      method: 'patch',
      pathTemplate: '/api/notifications/{id}/read',
      summary: 'Mark a notification as read',
      description: 'Marks a single notification as read.',
      operationIdBase: 'markNotificationRead',
      request: { params: idParam },
      responses: {
        200: successResponse('Notification marked as read'),
        400: errorResponse('Invalid request'),
        401: errorResponse('Not authenticated'),
        404: errorResponse('Notification not found'),
        500: errorResponse('Failed to mark notification as read'),
      },
    },
    {
      method: 'post',
      pathTemplate: '/api/notifications/mark-all-read',
      summary: 'Mark all notifications as read',
      description: 'Marks every notification for the authenticated user as read.',
      operationIdBase: 'markAllNotificationsRead',
      responses: {
        200: successResponse('All notifications marked as read'),
        401: errorResponse('Not authenticated'),
        500: errorResponse('Failed to mark notifications as read'),
      },
    },
    {
      method: 'post',
      pathTemplate: '/api/notifications/{id}/dismiss',
      summary: 'Dismiss a notification',
      description: 'Dismisses a single notification from the inbox.',
      operationIdBase: 'dismissNotification',
      request: { params: idParam },
      responses: {
        200: successResponse('Notification dismissed'),
        400: errorResponse('Invalid request'),
        401: errorResponse('Not authenticated'),
        404: errorResponse('Notification not found'),
        500: errorResponse('Failed to dismiss notification'),
      },
    },
    {
      method: 'get',
      pathTemplate: '/api/notifications/preferences',
      summary: 'Get notification preferences',
      description: 'Returns the per-channel notification preferences for the authenticated user.',
      operationIdBase: 'getNotificationPreferences',
      responses: {
        200: jsonResponse(notificationPreferencesSchema, 'Notification preferences'),
        401: errorResponse('Not authenticated'),
        500: errorResponse('Failed to load preferences'),
      },
    },
    {
      method: 'patch',
      pathTemplate: '/api/notifications/preferences',
      summary: 'Update notification preferences',
      description:
        'Updates per-channel notification preferences. The body maps each event type to a channel-enabled map.',
      operationIdBase: 'updateNotificationPreferences',
      request: {
        body: {
          content: {
            'application/json': {
              schema: z.record(z.string(), z.record(z.string(), z.boolean())),
            },
          },
        },
      },
      responses: {
        200: successResponse('Preferences updated'),
        400: errorResponse('Invalid request'),
        401: errorResponse('Not authenticated'),
        500: errorResponse('Failed to update preferences'),
      },
    },
    {
      method: 'post',
      pathTemplate: '/api/notifications/subscriptions',
      summary: 'Create a record subscription',
      description: 'Subscribes the authenticated user to notifications for a table or record.',
      operationIdBase: 'createNotificationSubscription',
      request: {
        body: {
          content: {
            'application/json': {
              schema: z.object({
                tableName: z.string().describe('Table to subscribe to'),
                recordId: z.string().optional().describe('Specific record to subscribe to'),
                fields: z.array(z.string()).optional().describe('Fields to watch'),
              }),
            },
          },
        },
      },
      responses: {
        201: jsonResponse(
          z.object({
            id: z.string(),
            tableName: z.string(),
            recordId: z.string().nullable(),
            fields: z.array(z.string()),
            createdAt: z.string(),
          }),
          'Subscription created'
        ),
        400: errorResponse('Table name required'),
        401: errorResponse('Not authenticated'),
        500: errorResponse('Failed to create subscription'),
      },
    },
    {
      method: 'delete',
      pathTemplate: '/api/notifications/subscriptions/{id}',
      summary: 'Delete a record subscription',
      description: 'Removes a record subscription belonging to the authenticated user.',
      operationIdBase: 'deleteNotificationSubscription',
      request: { params: idParam },
      responses: {
        200: successResponse('Subscription deleted'),
        400: errorResponse('Invalid request'),
        401: errorResponse('Not authenticated'),
        404: errorResponse('Subscription not found'),
        500: errorResponse('Failed to delete subscription'),
      },
    },
  ],
}
