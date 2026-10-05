/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { canonicalMimeType } from '@/domain/kernel/identity/mime-types'

/**
 * The file extension a speech engine expects for each audio type.
 *
 * OpenAI-compatible engines pick the decoder from the multipart FILENAME, not
 * from the part's content type, and refuse names they do not know — Chromium
 * stores an audio-only WebM recording as `.weba`, which they answer with a 400.
 * Only the name sent to the engine changes; the stored object keeps its own.
 *
 * Keyed on the CANONICAL type (`canonicalMimeType` folds parameters and vendor
 * aliases such as `audio/x-m4a`), so only registered types appear here. It is
 * not the reverse of the domain's extension → type map: that map resolves
 * `.webm` to video and `.weba` to audio, whereas an engine wants `.webm`.
 */
const EXTENSION_BY_AUDIO_TYPE: Readonly<Record<string, string>> = {
  'audio/webm': 'webm',
  'audio/mp4': 'm4a',
  'audio/mpeg': 'mp3',
  'audio/ogg': 'ogg',
  'audio/wav': 'wav',
  'audio/flac': 'flac',
}

/** A file name without its last extension (`a.b.weba` → `a.b`); a dot-less name is returned whole. */
const baseName = (fileName: string): string => {
  const dot = fileName.lastIndexOf('.')
  return dot > 0 ? fileName.slice(0, dot) : fileName
}

/**
 * The name a recording is sent to a speech engine under: its own base name,
 * with the extension its audio type calls for. An unknown type leaves the
 * name unchanged.
 */
export const speechFileName = (fileName: string, mimeType: string): string => {
  const extension = EXTENSION_BY_AUDIO_TYPE[canonicalMimeType(mimeType)]
  if (extension === undefined) return fileName
  return `${baseName(fileName)}.${extension}`
}
