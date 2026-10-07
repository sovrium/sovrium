/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { resolveClasses } from '@/presentation/design/resolve-classes'
import { fillFormReferences } from './fill-form-references'

/** `onSuccess.type: 'successPage'` on an auth form: what replaces it once sent. */
export interface AuthSuccessPageConfig {
  readonly title?: string
  readonly message?: string
}

/**
 * The success page an auth form turns into once its request is sent — a magic
 * link mailed, a reset link requested. It takes the form's place, so the reader
 * sees the next step and no field to fill again.
 */
export function AuthSuccessPage(props: {
  readonly config: AuthSuccessPageConfig
  readonly values: Readonly<Record<string, string>>
  readonly className?: string
  readonly id?: string
  readonly 'data-testid'?: string
}) {
  const { config, values } = props
  return (
    <div
      data-success-page=""
      role="status"
      className={resolveClasses('flex flex-col gap-2', undefined, props.className)}
      id={props.id}
      data-testid={props['data-testid']}
    >
      {config.title !== undefined && (
        <h2
          data-success-title=""
          className="text-foreground text-lg font-semibold"
        >
          {fillFormReferences(config.title, values)}
        </h2>
      )}
      {config.message !== undefined && (
        <p
          data-success-message=""
          className="text-muted-foreground text-sm"
        >
          {fillFormReferences(config.message, values)}
        </p>
      )}
    </div>
  )
}
