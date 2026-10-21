/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What a record drawer draws when its record read failed — after the read and
 * its one automatic retry: a line saying the record could not be read and,
 * where the read can be asked again, a Retry. It draws no field and no Save:
 * fields seeded from nothing would be empty, and a Save would write those
 * blanks over the stored record.
 */

import { computePartButtonClasses } from '@/presentation/design/button-variant-classes'
import type { ReactElement } from 'react'

/** The English words the state draws when the host named none. */
const DEFAULT_READ_FAILED_LABEL = 'This record couldn’t be read.'
const DEFAULT_RETRY_LABEL = 'Retry'

/** The read-failed state — see the module note. */
export function ReadFailed(props: {
  readonly label: string | undefined
  readonly retryLabel: string | undefined
  readonly onRetry: (() => void) | undefined
}): ReactElement {
  return (
    <div className="flex flex-col items-start gap-3">
      <p className="text-muted-foreground text-md">{props.label ?? DEFAULT_READ_FAILED_LABEL}</p>
      {props.onRetry !== undefined && (
        <button
          type="button"
          onClick={props.onRetry}
          className={computePartButtonClasses({ variant: 'outline', size: 'sm' })}
        >
          {props.retryLabel ?? DEFAULT_RETRY_LABEL}
        </button>
      )}
    </div>
  )
}
