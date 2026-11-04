/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { isChatAttachmentKey, storageKeyCollisionForm } from '@/domain/kernel/identity/storage-key'
import { TEMP_STORAGE_PREFIX } from './shared'

/** A stored file as a gate judges it: its key, its bucket, and whether the catalog records it. */
interface StoredEntry {
  readonly key: string
  readonly bucket: string | undefined
  readonly recorded: boolean
}

/**
 * Which stored files a gate admits beyond the ones the hand-started run's file gate
 * does. `engine-files`, what every file operator takes: none. A file the
 * store holds with no catalog row is not only one the operator or the control
 * plane put there: a removal deletes the row before the bytes, an erasure
 * removes the bytes after its commit, and a write whose bytes landed but whose
 * row was not kept leaves them too, so a row-less key is as often what is left
 * of a file someone else owned. `control-plane-objects` is for the steps whose
 * input IS such an object (a backup archive to restore, a release bundle to
 * apply or check): they also read a key {@link isControlPlaneObject} admits.
 */
export type StarterGateScope = 'engine-files' | 'control-plane-objects'

/**
 * Whether `entry` may be an object the operator or the control plane placed
 * in the store: no catalog row in any spelling, and a key under neither the
 * engine's temporary prefix (only runs write there) nor the chat attachments'
 * (each its uploader's alone), whatever its letter case or composition.
 */
export const isControlPlaneObject = (entry: StoredEntry): boolean => {
  if (entry.recorded || entry.bucket !== undefined) return false
  const folded = storageKeyCollisionForm(entry.key, { caseInsensitive: true })
  return !folded.startsWith(TEMP_STORAGE_PREFIX) && !isChatAttachmentKey(entry.key)
}
