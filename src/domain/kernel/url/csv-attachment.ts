/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Naming a CSV download.
 *
 * A `text/csv` response with no `Content-Disposition` is not saved — the
 * browser renders it in the tab, so an export triggered by navigation carries
 * the operator OUT of the console to look at raw data. The header is what turns
 * a response into a download, and the filename is what lets an operator who
 * exported three inboxes tell the three files apart afterwards.
 *
 * The shape mirrors the record-export route that already got this right:
 * `<subject>-<YYYY-MM-DD>.csv`.
 */

/** Characters that survive into a filename; everything else becomes `-`. */
const UNSAFE_FILENAME_CHARS = /[^a-zA-Z0-9._-]+/gu

/**
 * Build the download filename for a CSV export of `subject` taken on `date`.
 *
 * `subject` is sanitised rather than trusted: it comes from a config-authored
 * name, and a quote or a path separator inside a `filename="…"` parameter would
 * either truncate the header or suggest a directory. A subject that sanitises
 * away entirely falls back to `export`, so the file is always named something.
 */
export function buildCsvAttachmentFilename(subject: string, date: Readonly<Date>): string {
  const safe = subject.replaceAll(UNSAFE_FILENAME_CHARS, '-').replace(/^-+|-+$/gu, '')
  const day = date.toISOString().slice(0, 10)
  return `${safe.length > 0 ? safe : 'export'}-${day}.csv`
}

/**
 * The `Content-Disposition` value naming a CSV download of `subject`.
 */
export function buildCsvAttachmentDisposition(subject: string, date: Readonly<Date>): string {
  return `attachment; filename="${buildCsvAttachmentFilename(subject, date)}"`
}
