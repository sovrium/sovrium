/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { dateTimeGlueOf } from '@/domain/models/app/tables/cell-value-format'
import { parseSovriumTimezone } from '@/domain/models/process-env/timezone'

/**
 * What `<html>` tells the islands about the clock they print dates with: the
 * operator timezone (`resolvePageTimezone`), and the words this server's `Intl`
 * puts between a date and its time in the page language
 * (`resolvePageDateTimeGlue`), so a grid cell drawn in the browser spells a
 * datetime exactly as the record field and the description list the server
 * drew beside it. Neither is read from the environment in the browser.
 */
export function pageClockAttributes(lang: string): Readonly<Record<string, string>> {
  const glue = dateTimeGlueOf(lang)
  return {
    'data-timezone': parseSovriumTimezone(process.env).zoneId,
    ...(glue === undefined ? {} : { 'data-datetime-glue': glue }),
  }
}
