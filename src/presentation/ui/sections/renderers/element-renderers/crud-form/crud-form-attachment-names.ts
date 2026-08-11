/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Extract human-readable filename(s) from a stored attachment value.
 *
 * Accepts the same shapes the file-field island parses on hydration:
 *  - a JSON metadata object (`{ name, url, size, ... }`),
 *  - a JSON array of metadata objects / storage-key strings,
 *  - a plain storage key string (`<uuid>-<filename>` or a bare name).
 *
 * Returns the list of display names so edit-mode SSR can show the existing
 * attachment(s) immediately, before the island hydrates.
 */
/** Recover the original filename from a `<uuid>-<filename>` storage key. */
function attachmentNameFromKey(key: string): string {
  return (
    key.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-(.+)$/i)?.[1] ?? key
  )
}

/** Resolve the display name for one attachment entry (key string or metadata object). */
function attachmentNameFromEntry(entry: unknown): string | undefined {
  if (typeof entry === 'string') return attachmentNameFromKey(entry)
  if (typeof entry === 'object' && entry !== null) {
    const { name } = entry as Record<string, unknown>
    return typeof name === 'string' ? name : undefined
  }
  return undefined
}

export function attachmentFilenames(rawValue: unknown): readonly string[] {
  // JSONB attachment columns surface as JS objects/arrays; VARCHAR columns
  // surface as JSON strings or bare storage keys. Handle all shapes.
  if (typeof rawValue === 'object' && rawValue !== null) {
    const list = Array.isArray(rawValue) ? rawValue : [rawValue]
    return list.map(attachmentNameFromEntry).filter((n): n is string => n !== undefined)
  }
  if (typeof rawValue !== 'string') return []
  const trimmed = rawValue.trim()
  if (!trimmed) return []
  try {
    const parsed = JSON.parse(trimmed) as unknown
    const list = Array.isArray(parsed) ? parsed : [parsed]
    return list.map(attachmentNameFromEntry).filter((n): n is string => n !== undefined)
  } catch {
    // Not JSON — treat as a bare storage key string.
    return [attachmentNameFromKey(trimmed)]
  }
}
