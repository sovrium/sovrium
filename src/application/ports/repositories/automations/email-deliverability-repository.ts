/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data } from 'effect'
import type { Effect } from 'effect'

/** A suppression-list or message-ledger read or write that failed. */
export class EmailDeliverabilityDatabaseError extends Data.TaggedError(
  'EmailDeliverabilityDatabaseError'
)<{
  readonly cause: unknown
}> {}

/** Why an address is suppressed. */
export type EmailSuppressionReason = 'unsubscribe' | 'bounce' | 'complaint'

/** One suppression of an address: the category left (`null` = every one), why, since when. */
export interface EmailSuppressionEntry {
  readonly category: string | null
  readonly reason: EmailSuppressionReason
  readonly createdAt: Date
}

/** What `email/stats` counts. */
export interface EmailCampaignCounts {
  readonly sent: number
  readonly opened: number
  readonly bounced: number
  readonly complained: number
  readonly unsubscribed: number
}

type Io<A> = Effect.Effect<A, EmailDeliverabilityDatabaseError>

/**
 * The suppression list and the message ledger behind bulk `email/send`,
 * `email/suppress`, `email/stats`, the unsubscribe link and the open pixel.
 * Addresses are compared lower-cased; the ledger stores no address.
 */
export class EmailDeliverabilityRepository extends Context.Service<
  EmailDeliverabilityRepository,
  {
    /** Of `addresses`, the lower-cased ones suppressed for `category` (or for every category). */
    readonly suppressedAmong: (input: {
      readonly addresses: readonly string[]
      readonly category: string
    }) => Io<ReadonlySet<string>>
    /** Suppress an address for one category, or for every one when `category` is undefined. */
    readonly suppress: (input: {
      readonly address: string
      readonly reason: EmailSuppressionReason
      readonly category?: string
    }) => Io<void>
    /** Record a sent bulk or tracked message under its reference. */
    readonly recordMessage: (input: {
      readonly ref: string
      readonly messageId: string | undefined
      readonly category: string | undefined
      readonly campaign: string | undefined
    }) => Io<void>
    /** Count a message's first open; a second open, or an unknown reference, counts nothing. */
    readonly markOpened: (ref: string) => Io<void>
    /** Count an unsubscribe on the message whose link was used. */
    readonly markUnsubscribed: (ref: string) => Io<void>
    /** Count a bounce or complaint on the message a provider named by its Message-ID. */
    readonly markReported: (input: {
      readonly messageId: string
      readonly reason: 'bounce' | 'complaint'
    }) => Io<void>
    /** The counts of the messages matching a campaign and/or a category. */
    readonly countMessages: (input: {
      readonly campaign?: string
      readonly category?: string
    }) => Io<EmailCampaignCounts>
  }
>()('EmailDeliverabilityRepository') {}
