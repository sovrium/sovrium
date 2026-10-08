/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { createHash } from 'node:crypto'
import { BUNDLE_CONFIG_ENTRY, BUNDLE_MANIFEST_ENTRY, type BundleManifest } from './bundle-manifest'

/** Lowercase hex SHA-256 of some bytes. */
const sha256Hex = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex')

/**
 * Check an unpacked bundle against its manifest, before a single byte of it is
 * trusted. Returns every problem found, or an empty list when the archive is
 * exactly what the manifest lists:
 *
 * - every listed entry is present, with the listed size and sha256;
 * - no entry is present that the manifest does not list (`manifest.json` aside);
 * - `project/app.json` is listed, and `configHash` is its sha256.
 *
 * A `signature`, when the manifest carries one, is not judged here: verifying
 * it needs the publisher's public keys, which the caller holds. Its absence is
 * not a problem — bundles are unsigned until a signing key exists.
 */
export const verifyBundle = (
  manifest: BundleManifest,
  entries: ReadonlyMap<string, Uint8Array>
): readonly string[] => {
  const listed = new Set(manifest.entries.map((entry) => entry.path))
  const entryProblems = manifest.entries.flatMap((entry) => {
    const bytes = entries.get(entry.path)
    if (bytes === undefined) return [`${entry.path} is listed but missing`]
    if (bytes.byteLength !== entry.size) {
      return [
        `${entry.path} is ${String(bytes.byteLength)} bytes, the manifest says ${String(entry.size)}`,
      ]
    }
    return sha256Hex(bytes) === entry.sha256 ? [] : [`${entry.path} does not match its sha256`]
  })
  const unlisted = [...entries.keys()]
    .filter((path) => path !== BUNDLE_MANIFEST_ENTRY && !listed.has(path))
    .map((path) => `${path} is in the archive but not in the manifest`)
  const config = manifest.entries.find((entry) => entry.path === BUNDLE_CONFIG_ENTRY)
  const configProblems =
    config === undefined
      ? [`${BUNDLE_CONFIG_ENTRY} is not listed`]
      : config.sha256 === manifest.configHash
        ? []
        : [`configHash is not the sha256 of ${BUNDLE_CONFIG_ENTRY}`]
  return [...entryProblems, ...unlisted, ...configProblems]
}
