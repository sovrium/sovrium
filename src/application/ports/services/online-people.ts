/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context } from 'effect'

/**
 * Who has an app connection open on the running server: the presence the user
 * directory shows and filters on. Without a running hub, nobody is online.
 */
export class OnlinePeople extends Context.Service<
  OnlinePeople,
  {
    /** Whether one of the person's app connections is open. */
    readonly isOnline: (appId: string, userId: string) => boolean
    /** The ids of the app's people with an open app connection, in no particular order. */
    readonly onlineOf: (appId: string) => readonly string[]
  }
>()('OnlinePeople') {}
