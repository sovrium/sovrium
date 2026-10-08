/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { buildDeflatedZip, type ZipEntry } from '../action-handlers/file-zip'
import {
  readZipDirectory,
  readZipEntries,
  type ZipReadEntry,
} from '../action-handlers/file-zip-read'

/**
 * Opening an Office package a USER supplied — a template uploaded to a bucket —
 * without letting it decide how much memory the read costs ([internal ref] D8.9).
 *
 * The directory is read first, without inflating anything, and held to three
 * limits: how many entries, how many bytes they declare in total, and how far
 * any one entry claims to expand. Only then are the entries read, each bounded
 * by the size it declared — an entry that inflates past its own declaration is
 * refused mid-stream, so a lying directory buys nothing.
 */

export interface OoxmlPackageLimits {
  /** Most entries a package may hold. Word writes ~15; a template with images, a few hundred. */
  readonly maxEntries: number
  /** Most bytes the entries may declare, all together, once inflated. */
  readonly maxTotalUncompressedBytes: number
  /**
   * Highest inflated/compressed ratio one entry may claim. Text XML compresses
   * about tenfold; a bomb is built from runs of one byte, which compress a
   * thousandfold. Entries under `ratioFloorBytes` are exempt — a tiny part can
   * compress well without costing anything.
   */
  readonly maxCompressionRatio: number
  readonly ratioFloorBytes: number
}

export const DEFAULT_OOXML_PACKAGE_LIMITS: OoxmlPackageLimits = {
  maxEntries: 2000,
  maxTotalUncompressedBytes: 100 * 1024 * 1024,
  maxCompressionRatio: 200,
  ratioFloorBytes: 1024 * 1024,
}

export type OoxmlPackageRead =
  | { readonly ok: true; readonly entries: ReadonlyArray<ZipReadEntry> }
  | {
      readonly ok: false
      readonly reason: 'not_a_package' | 'package_too_large'
      readonly message: string
    }

const tooLarge = (message: string): OoxmlPackageRead => ({
  ok: false,
  reason: 'package_too_large',
  message,
})

/** Read every entry of an Office package within `limits`. Never throws. */
export const readOoxmlPackage = (
  bytes: Uint8Array,
  limits: OoxmlPackageLimits = DEFAULT_OOXML_PACKAGE_LIMITS
): OoxmlPackageRead => {
  const directory = readZipDirectory(bytes)
  if (directory === undefined) {
    return { ok: false, reason: 'not_a_package', message: 'is not a ZIP container' }
  }
  if (directory.length > limits.maxEntries) {
    return tooLarge(`holds ${directory.length} entries, more than the ${limits.maxEntries} allowed`)
  }
  const total = directory.reduce((sum, entry) => sum + entry.uncompressedSize, 0)
  if (total > limits.maxTotalUncompressedBytes) {
    return tooLarge(
      `expands to ${total} bytes, more than the ${limits.maxTotalUncompressedBytes} allowed`
    )
  }
  const bomb = directory.find(
    (entry) =>
      entry.uncompressedSize > limits.ratioFloorBytes &&
      entry.uncompressedSize > Math.max(1, entry.compressedSize) * limits.maxCompressionRatio
  )
  if (bomb !== undefined) {
    return tooLarge(
      `entry ${bomb.name} claims to expand more than ${limits.maxCompressionRatio} times`
    )
  }
  const entries = readZipEntries(bytes, { boundByDeclaredSize: true })
  return entries === undefined
    ? { ok: false, reason: 'not_a_package', message: 'is not a readable ZIP container' }
    : { ok: true, entries }
}

/** Write a package back, entries in the order given, DEFLATEd where that pays. */
export const writeOoxmlPackage = (entries: ReadonlyArray<ZipEntry>): Uint8Array =>
  buildDeflatedZip(entries)

const decoder = new TextDecoder()
const encoder = new TextEncoder()

export const entryText = (entry: ZipReadEntry): string => decoder.decode(entry.bytes)

export const textEntry = (name: string, text: string): ZipEntry => ({
  name,
  bytes: encoder.encode(text),
})
