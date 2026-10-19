/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The files a record sheet is still uploading. A file chosen in a drop zone
 * is sent to its bucket first, and only its stored key is the field's value:
 * a Save pressed while the upload is in flight would send the field without
 * it. So Save waits — it is held while any upload is in flight
 * ({@link useUploadsInFlight}), and the zone reports each one
 * ({@link trackUpload}).
 */

import { useSyncExternalStore } from 'react'

let inFlight = 0
const listeners = new Set<() => void>()

const notify = (): void => listeners.forEach((listener) => listener())

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Count `work` as an upload in flight until it settles. */
export async function trackUpload<T>(work: Promise<T>): Promise<T> {
  inFlight += 1
  notify()
  try {
    return await work
  } finally {
    inFlight -= 1
    notify()
  }
}

/** Whether a sheet's drop zone is still uploading a file. */
export const useUploadsInFlight = (): boolean =>
  useSyncExternalStore(
    subscribe,
    () => inFlight > 0,
    () => false
  )
