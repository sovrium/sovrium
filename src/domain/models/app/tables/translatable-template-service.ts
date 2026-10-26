/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  collapseLanguageMap,
  isLanguageMapShape,
  recordLanguageOrder,
} from './translatable-field-service'
import { translatableFieldNamesOf } from './translatable-query-service'
import type { App } from '@/domain/models/app'

/**
 * A translatable field as an automation's templates read it ([internal ref] D4).
 *
 * The run's trigger data carries each translatable field as its whole map.
 * In a template, `{{trigger.data.record.title}}` prints the default
 * language's value and `{{trigger.data.record.title.fr}}` addresses one
 * language. So the map keeps its language keys as its own properties, and
 * prints as the default language's text: that text is what a value read
 * whole turns into when a template inserts it in a string. Serialised, the
 * value is still the plain map — the text rides on its prototype, never on an
 * own key.
 */

/** `map` printing as `text` when a template inserts it whole. */
const printingAs = (
  map: Readonly<Record<string, unknown>>,
  text: string
): Readonly<Record<string, unknown>> =>
  Object.create({ toString: () => text }, Object.getOwnPropertyDescriptors(map)) as Readonly<
    Record<string, unknown>
  >

/**
 * `record` with each translatable field of `tableName` printing as its
 * default-language value (else the first declared language holding one).
 * Every other value is returned as it came.
 */
export const withTemplateLanguageText = (
  app: App,
  tableName: string,
  record: Readonly<Record<string, unknown>>
): Readonly<Record<string, unknown>> => {
  const names = translatableFieldNamesOf(app, tableName)
  if (names.size === 0) return record
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) =>
      names.has(key) && isLanguageMapShape(value)
        ? [
            key,
            printingAs(value, collapseLanguageMap(value, recordLanguageOrder(app.languages)) ?? ''),
          ]
        : [key, value]
    )
  )
}

/**
 * `triggerData` with the record (and previous record) of a record trigger on
 * `tableName` read by templates as {@link withTemplateLanguageText} reads it.
 * Any other trigger data is returned as it came.
 */
export const withTriggerLanguageText = (
  app: App,
  tableName: string | undefined,
  triggerData: Readonly<Record<string, unknown>>
): Readonly<Record<string, unknown>> => {
  if (tableName === undefined) return triggerData
  const rows = (['record', 'previousRecord'] as const).flatMap((key) => {
    const row = triggerData[key]
    return isLanguageMapShape(row) ? [[key, withTemplateLanguageText(app, tableName, row)]] : []
  })
  return rows.length === 0 ? triggerData : { ...triggerData, ...Object.fromEntries(rows) }
}
