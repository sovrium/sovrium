/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { recordLanguageOrder } from '@/domain/models/app/tables/translatable-field-service'
import { translatableFieldNamesOf } from '@/domain/models/app/tables/translatable-write-service'
import type { App } from '@/domain/models/app'

/**
 * The languages a record drawer edits a translatable field in: one tab per
 * declared language, the default first. Stamped by the page pass with the
 * drawer's field access (`resolve-record-drawer-access.ts`), because only it
 * holds the host app.
 */

/** A drawer's translatable fields, and the languages each is edited in, the default first. */
export interface DrawerLanguages {
  readonly fields: readonly string[]
  readonly supported: ReadonlyArray<{ readonly code: string; readonly label: string }>
}

/**
 * The translatable fields of `tableName` and the app's languages, default
 * first, labelled as the app labels them — the HOST app's, under a mounted
 * console, whose own languages are the console's.
 */
export const drawerLanguagesFor = (app: App, tableName: string): DrawerLanguages | undefined => {
  const fields = translatableFieldNamesOf(app, tableName)
  if (fields.length === 0 || app.languages === undefined) return undefined
  const { supported } = app.languages
  const labelOf = (code: string) => supported.find((l) => l.code === code)?.label ?? code
  const order = recordLanguageOrder(app.languages)
  return { fields, supported: order.map((code) => ({ code, label: labelOf(code) })) }
}

/** A drawer's field access, as far as its languages are concerned. */
interface AccessWithLanguages {
  readonly unreadable: readonly string[]
  readonly unwritable: readonly string[]
  readonly writeOnly?: readonly string[]
  readonly languages?: DrawerLanguages
}

/** A drawer's access with its translatable fields: an access of its own when it restricts nothing. */
export const withDrawerLanguages = (
  access: AccessWithLanguages | undefined,
  languages: DrawerLanguages | undefined
): AccessWithLanguages | undefined =>
  languages === undefined ? access : { unreadable: [], unwritable: [], ...access, languages }
