/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { z } from 'zod'

// ---------------------------------------------------------------------------
// Notification sender schema
// ---------------------------------------------------------------------------

/**
 * Schema for the user who triggered a notification.
 */
export const notificationSenderSchema = z.object({
  id: z.string().describe('User identifier of the notification sender'),
  name: z.string().describe('Display name of the sender'),
  avatarUrl: z.string().url().optional().describe('Avatar URL of the sender'),
})

// ---------------------------------------------------------------------------
// Notification schema
// ---------------------------------------------------------------------------

/**
 * Schema for a single notification item.
 */
export const notificationSchema = z.object({
  id: z.string().describe('Unique notification identifier'),
  title: z.string().describe('Notification title'),
  body: z.string().describe('Notification body text'),
  read: z.boolean().describe('Whether the notification has been read'),
  dismissed: z.boolean().describe('Whether the notification has been dismissed'),
  link: z.string().optional().describe('Deep link to the related resource'),
  createdAt: z.string().datetime().describe('ISO 8601 timestamp when the notification was created'),
  sender: notificationSenderSchema.describe('User who triggered the notification'),
})

// ---------------------------------------------------------------------------
// Notification list response schema
// ---------------------------------------------------------------------------

/**
 * Response schema for listing notifications.
 */
export const notificationListResponseSchema = z.object({
  notifications: z.array(notificationSchema).describe('List of notifications'),
  total: z.number().int().min(0).describe('Total number of notifications'),
  unreadCount: z.number().int().min(0).describe('Number of unread notifications'),
})

// ---------------------------------------------------------------------------
// Notification channel preference schema
// ---------------------------------------------------------------------------

/**
 * Per-event-type notification delivery preferences.
 */
export const notificationChannelPreferenceSchema = z.object({
  inApp: z.boolean().describe('Whether to deliver in-app notifications for this event type'),
  email: z.boolean().describe('Whether to deliver email notifications for this event type'),
})

// ---------------------------------------------------------------------------
// Notification preferences schema
// ---------------------------------------------------------------------------

/**
 * Schema for user notification preferences.
 */
export const notificationPreferencesSchema = z.object({
  preferences: z
    .record(z.string(), notificationChannelPreferenceSchema)
    .describe('Map of event type to channel delivery preferences'),
  emailDigestFrequency: z
    .enum(['instant', 'daily', 'weekly', 'never'])
    .optional()
    .describe('How often to batch email notifications into digest'),
})

// ---------------------------------------------------------------------------
// Type exports
// ---------------------------------------------------------------------------

export type NotificationSender = z.infer<typeof notificationSenderSchema>
export type Notification = z.infer<typeof notificationSchema>
export type NotificationListResponse = z.infer<typeof notificationListResponseSchema>
export type NotificationChannelPreference = z.infer<typeof notificationChannelPreferenceSchema>
export type NotificationPreferences = z.infer<typeof notificationPreferencesSchema>
