/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The file name a `Content-Disposition` header proposes, made safe to use as
 * ONE file name: `filename*=` (RFC 6266 / RFC 8187, `UTF-8''pct-encoded`)
 * wins over `filename=`, any path component is stripped (`/` and `\`), control
 * characters are dropped, and `.`, `..` or an empty result answer `undefined`.
 *
 * A signed storage address often ends in a path that names nothing
 * (`/api/buckets/system/signed?path=…`); the server says the real name here.
 */

const EXTENDED = /(?:^|;)\s*filename\*\s*=\s*([^;]*)/i
const PLAIN = /(?:^|;)\s*filename\s*=\s*("(?:[^"\\]|\\.)*"|[^;]*)/i

const decodeExtended = (value: string): string | undefined => {
  const parts = value.trim().replace(/^"|"$/g, '').split("'")
  const encoded = parts.length >= 3 ? parts.slice(2).join("'") : parts[0]
  if (encoded === undefined) return undefined
  try {
    return decodeURIComponent(encoded)
  } catch {
    return undefined
  }
}

const decodePlain = (value: string): string => {
  const trimmed = value.trim()
  return trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2
    ? trimmed.slice(1, -1).replace(/\\(.)/g, '$1')
    : trimmed
}

/** One path component, no control character, at most 255 characters; `undefined` when nothing usable is left. */
const sanitise = (name: string): string | undefined => {
  const last = name.split(/[/\\]/).at(-1) ?? ''
  const printable = [...last].filter((char) => {
    const code = char.codePointAt(0) ?? 0
    return code > 0x1f && code !== 0x7f
  })
  const clean = printable.join('').trim().slice(0, 255)
  return clean === '' || clean === '.' || clean === '..' ? undefined : clean
}

export const contentDispositionFileName = (
  header: string | null | undefined
): string | undefined => {
  if (header === null || header === undefined) return undefined
  const extended = EXTENDED.exec(header)?.[1]
  const fromExtended = extended === undefined ? undefined : decodeExtended(extended)
  const fromExtendedSafe = fromExtended === undefined ? undefined : sanitise(fromExtended)
  if (fromExtendedSafe !== undefined) return fromExtendedSafe
  const plain = PLAIN.exec(header)?.[1]
  return plain === undefined ? undefined : sanitise(decodePlain(plain))
}
