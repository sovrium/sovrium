/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { computeSubmitButtonClasses } from '@/presentation/design/button-default-classes'
import { pendingControlProps } from '@/presentation/design/pending-state'
import { renderPendingContent } from '@/presentation/design/spinner-mark'

/**
 * A credential auth form's submit. While the request is in flight it is
 * disabled and busy and draws the house spinner before the pending word
 * ("Signing in…"), so a second press or Enter sends nothing.
 */
export function AuthSubmitButton({
  pending,
  label,
  pendingLabel,
  variant,
}: {
  readonly pending: boolean
  readonly label: string
  readonly pendingLabel: string
  readonly variant: Parameters<typeof computeSubmitButtonClasses>[0]
}) {
  return (
    <button
      type="submit"
      data-component-type="button"
      {...pendingControlProps(pending)}
      className={`${computeSubmitButtonClasses(variant)} w-full`}
    >
      {pending ? renderPendingContent(pendingLabel) : label}
    </button>
  )
}
