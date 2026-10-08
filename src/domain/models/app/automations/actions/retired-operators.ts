/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The automation action operators the union no longer declares, keyed `type/operator`,
 * and what replaces each one.
 *
 * Removed with no alias: the old literal is gone from the action union, and a
 * config still using it is refused before the decode with this message rather
 * than with the unknown-value report, which would blame an unrelated union arm
 * and say nothing about where the action went. Each message names the
 * replacement and the prop the file is written with now (`output`).
 *
 * A key here MUST no longer be declarable — the test beside this file holds
 * it — and a named replacement MUST be.
 */
export const RETIRED_ACTION_OPERATORS: Readonly<
  Record<string, { readonly replacement: string; readonly message: string }>
> = {
  'file/generatePdf': {
    replacement: 'document/generatePdf',
    message:
      '`file/generatePdf` was removed: use `document/generatePdf` (type: document, operator: generatePdf), which renders an HTML template to a real paginated PDF. Its `template` is { inline }, { asset } or { key, bucket }, its values come from `data`, and the file is written with `output` (filename, bucket, key, attachTo) instead of filename and destination.',
  },
  'file/generateXlsx': {
    replacement: 'document/generateXlsx',
    message:
      '`file/generateXlsx` moved to `document/generateXlsx` (type: document, operator: generateXlsx), with the same `data`, `sheets` and `columns`. The workbook is written with `output` (filename, key, bucket, attachTo) instead of filename and destination.',
  },
}
