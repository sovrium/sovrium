/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */



export interface LiveAppShape {
  readonly name: string
  readonly [key: string]: unknown
}

const liveAppStore = new Map<'current', LiveAppShape>()

export const setLiveApp = (app: LiveAppShape): void => {
  liveAppStore.set('current', app)
}

export const getLiveApp = (): LiveAppShape | undefined => liveAppStore.get('current')
