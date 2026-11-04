/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { usableLocale } from '@/domain/kernel/format/usable-locale'
import type { ReaderZoneReading } from '@/presentation/render/props/record-value-format'
import type { ReactNode } from 'react'

/**
 * A moment the browser writes again in its reader's zone: the text the server
 * printed (at the operator's zone, what a reader without scripts keeps), inside
 * a `<time>` carrying the instant and how it reads. The body-end
 * `reader-zone-time-script.ts` rewrites it before the page is read; with no
 * reading, the text alone.
 */
export function readerZoneText(
  text: string,
  reading: ReaderZoneReading | undefined,
  locale: string
): ReactNode {
  if (reading === undefined) return text
  return (
    <time
      dateTime={reading.dateTime}
      data-reader-zone={JSON.stringify({ l: usableLocale(locale), r: reading.recipe })}
    >
      {text}
    </time>
  )
}
