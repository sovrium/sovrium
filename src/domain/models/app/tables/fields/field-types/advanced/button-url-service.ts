/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { substituteRecordVars } from '@/domain/models/app/pages/substitute-record-vars'

/**
 * Whether `template` is exactly one `$record.<field>` token and nothing else.
 *
 * Read through the substitutor itself rather than through a second copy of the
 * grammar: against an empty record a template made only of tokens prints
 * nothing. One `$record.`, no `|` and no dotted path make it a single field.
 * This module ships in the browser, so it borrows nothing else from the
 * grammar module: every export a shared chunk carries costs each island
 * loading it.
 */
const isWholeToken = (template: string): boolean =>
  template.lastIndexOf('$record.') === 0 &&
  !template.includes('|') &&
  template.split('.').length === 2 &&
  substituteRecordVars(template, {}) === ''

/**
 * The address a `url` button opens on one record: each `$record.<field>` in
 * its `url` replaced by that field's value on `record`, through the one
 * `$record.*` substitutor every other template uses.
 *
 * A value placed INSIDE the address is URL-encoded, so a reference such as
 * `Dossier Martin & fils` cannot break out of its query parameter or path
 * segment. A token that is the WHOLE `url` is the address itself and is
 * inserted as stored, so a `url` field can hold the destination; encoding it
 * would turn `https://…` into a relative path nothing follows.
 *
 * `record` is the record as its reader may read it: a field she may not read
 * is absent from it, so its token resolves to the empty string. The result is
 * not yet safe to follow — the browser hands it to `followAddress`, which
 * opens only a same-origin path or an `http(s)` URL.
 *
 * The browser half only: taking a field out of a template for a reader is
 * `button-url-redaction-service.ts`, which runs on the server alone.
 */
export const resolveButtonUrl = (
  template: string,
  record: Readonly<Record<string, unknown>>
): string =>
  isWholeToken(template)
    ? substituteRecordVars(template, record)
    : substituteRecordVars(template, record, encodeURIComponent)
