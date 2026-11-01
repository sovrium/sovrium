/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Which server's realtime hub the context-free entry points reach.
 *
 * The hub — channel listeners, presence entries, the connection registry, the
 * people online — is built by `RealtimeHubLive` (`./realtime-hub-live`), once
 * per server runtime, and released with it. Most of its callers hold no Effect
 * context to read it from: a Better Auth hook closing a changed account's
 * sockets, a repository built with `Layer.succeed` publishing a notification,
 * the erasure path, the dev-reload push. They call the module functions of
 * `./channel-manager`, `./presence-manager`, `./connection-counter` and
 * `./app-connections`, which act on the hub installed here.
 *
 * What is held at module level is only this pointer, and its lifetime is the
 * server's: the layer installs its hub as it is built and uninstalls it as its
 * scope closes, so a second server booted in the same process (the in-process
 * E2E harness, a `sovrium dev` restart) starts from an empty hub, as after a
 * real restart.
 *
 * Several hubs can be installed at once — a server's runtime and a static
 * render's, built while the server serves. The OLDEST still installed is the
 * current one, so a short-lived runtime built beside a live server never
 * diverts that server's events; once the oldest is released, the next in line
 * takes over. With none installed (a unit harness, a CLI command with no
 * server) there are no connections, and the entry points answer accordingly.
 */

import { MutableRef } from 'effect'
import type { AppConnectionCounts } from './app-connections'
import type { ChannelRegistry } from './channel-manager'
import type { ConnectionRegistry } from './connection-counter'
import type { PresenceRegistry } from './presence-manager'

/** Everything one server's realtime transport holds in memory. */
export interface RealtimeHubState {
  /** The open listeners of every channel: the fan-out every live event travels. */
  readonly channels: ChannelRegistry
  /** Who is on which presence-enabled page. */
  readonly presence: PresenceRegistry
  /** The live realtime connections, their per-user caps and their closing doors. */
  readonly connections: ConnectionRegistry
  /** The open app connections, counted per person. */
  readonly people: AppConnectionCounts
}

/** The installed hubs, oldest first. */
const installed = MutableRef.make<readonly RealtimeHubState[]>([])

/** The hub of the oldest server still running in this process, if any. */
export const currentRealtimeHub = (): RealtimeHubState | undefined => MutableRef.get(installed)[0]

/**
 * Install `hub` as one of the process's live hubs, and answer the function that
 * uninstalls it. Uninstalling twice does nothing.
 */
export const installRealtimeHub = (hub: RealtimeHubState): (() => void) => {
  MutableRef.update(installed, (hubs) => [...hubs, hub])
  return () => {
    MutableRef.update(installed, (hubs) => hubs.filter((candidate) => candidate !== hub))
  }
}
