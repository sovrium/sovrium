/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The text a SYSTEM record carries for its dates: what makes `$record.bootedAt`
 * read as "Oct 15, 2026 at 10:00 AM" on a console page while `.raw` keeps the
 * ISO stamp the endpoint published.
 */

import {
  isoDateTextFieldsOf,
  withRecordTextFields,
} from '@/domain/models/app/tables/record-text-service'
import { serverNow } from '@/domain/models/process-env/dev-clock'
import { parseSovriumTimezone } from '@/domain/models/process-env/timezone'
import type { RecordTextContext } from '@/presentation/render/props/record-value-format'
import type { SystemRowsFetcher } from '@/presentation/render/resolve/first-object-redirect-resolver'

/**
 * A record read from a SYSTEM endpoint, prepared for a text site: each value
 * spelled as an ISO date or instant carries its text in the page language and
 * the operator zone (`isoDateTextFieldsOf`), so `$record.bootedAt` prints a
 * date an operator reads and `$record.bootedAt.raw` keeps the stamp. Returned
 * unchanged without a page context.
 */
export const systemRecordWithText = (
  record: Readonly<Record<string, unknown>>,
  context: RecordTextContext | undefined
): Readonly<Record<string, unknown>> =>
  context === undefined
    ? record
    : withRecordTextFields(
        record,
        isoDateTextFieldsOf(record, parseSovriumTimezone().zoneId),
        context.locale,
        serverNow()
      )

/**
 * A rows reader whose every row carries its ISO dates as readable text
 * (`systemRecordWithText`). Absent stays absent: a render with no HTTP context
 * has no reader to wrap.
 */
export const rowsWithText = (
  fetchSystemRows: SystemRowsFetcher | undefined,
  context: RecordTextContext | undefined
): SystemRowsFetcher | undefined =>
  fetchSystemRows === undefined
    ? undefined
    : async (endpoint, rowsKey) =>
        (await fetchSystemRows(endpoint, rowsKey)).map(
          (row) => systemRecordWithText(row, context) as Record<string, unknown>
        )
