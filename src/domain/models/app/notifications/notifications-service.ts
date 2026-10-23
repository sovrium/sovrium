/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { Notifications } from './notifications'

/** How long a read notification is kept when the app sets no `retention`. */
export const DEFAULT_NOTIFICATION_RETENTION_DAYS = 90

/** The channels a notification of one kind reaches one person on. */
export interface NotificationChannels {
  readonly inApp: boolean
  readonly email: boolean
  readonly digest: boolean
}

/** A declared kind, as its channels and preferences need it. */
type DeclaredKind = Notifications['kinds'][number]

/** The kind named `name`, when the app declares it. */
export const declaredKind = (
  notifications: Notifications | undefined,
  name: string
): DeclaredKind | undefined => notifications?.kinds.find((kind) => kind.name === name)

/** A kind's default channels: in the app unless it says otherwise, never by email or digest. */
export const defaultChannelsOf = (kind: DeclaredKind): NotificationChannels => ({
  inApp: kind.channels?.inApp ?? true,
  email: kind.channels?.email ?? false,
  digest: kind.channels?.digest ?? false,
})

/** How a kind is named to a person: its label, else its name. */
export const kindLabelOf = (kind: DeclaredKind): string => kind.label ?? kind.name

/** The channels she receives a kind on: her choice where she made one, the default otherwise. */
export const channelsFor = (
  kind: DeclaredKind,
  chosen: NotificationChannels | undefined
): NotificationChannels => chosen ?? defaultChannelsOf(kind)

/** Her channels for a kind after a change that names some of them; the rest keep their value. */
export const changeChannels = (
  current: NotificationChannels,
  change: Partial<NotificationChannels>
): NotificationChannels => ({
  inApp: change.inApp ?? current.inApp,
  email: change.email ?? current.email,
  digest: change.digest ?? current.digest,
})

/** How many days read notifications are kept. */
export const retentionDaysOf = (notifications: Notifications | undefined): number =>
  notifications?.retention?.days ?? DEFAULT_NOTIFICATION_RETENTION_DAYS
