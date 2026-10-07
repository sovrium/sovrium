/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useEffect, useRef } from 'react'
import { computeButtonDefaultClasses } from '@/presentation/design/button-default-classes'
import { computeFormSaveBarClasses } from '@/presentation/design/form-layout-classes'
import type { ReactElement } from 'react'

/**
 * Ask before the page is left with changes unsaved — except by the form's own
 * submit, which is how a reader saves them.
 */
function useLeaveGuard(bar: HTMLElement | null, changes: number): void {
  useEffect(() => {
    if (bar === null || changes === 0) return undefined
    const form = bar.closest('form')
    const state = { submitting: false }
    const onSubmit = (): void => {
      state.submitting = true
    }
    const onLeave = (event: BeforeUnloadEvent): void => {
      if (!state.submitting) event.preventDefault()
    }
    form?.addEventListener('submit', onSubmit)
    window.addEventListener('beforeunload', onLeave)
    return () => {
      form?.removeEventListener('submit', onSubmit)
      window.removeEventListener('beforeunload', onLeave)
    }
  }, [bar, changes])
}

/** What a sticky save bar needs: how many fields changed, and how to undo them. */
export interface SaveBarState {
  readonly changes: number
  readonly onDiscard: () => void
}

const BAR_CLASS = computeFormSaveBarClasses()

/** "1 unsaved change", "2 unsaved changes", or that there is nothing to save. */
const changesText = (changes: number): string =>
  changes === 0
    ? 'No unsaved changes'
    : `${String(changes)} unsaved change${changes === 1 ? '' : 's'}`

/**
 * The bar `stickyActions` pins to the bottom of the view while the form is on
 * screen: the count of fields changed since the form was filled, Discard to put
 * them back, and the form's own submit button — disabled until something
 * changed, since saving an untouched form only writes the same values again.
 * The count is a live region, so the reader hears it move as they type, and
 * leaving the page with changes unsaved asks first.
 */
export function SaveBar({
  bar,
  submit,
}: {
  readonly bar: SaveBarState
  readonly submit: ReactElement
}): ReactElement {
  const ref = useRef<HTMLDivElement | null>(null)
  useLeaveGuard(ref.current, bar.changes)
  return (
    <div
      ref={ref}
      data-form-save-bar=""
      className={BAR_CLASS}
    >
      <span
        role="status"
        className="text-foreground-muted mr-auto font-mono text-sm"
      >
        {changesText(bar.changes)}
      </span>
      <button
        type="button"
        onClick={bar.onDiscard}
        disabled={bar.changes === 0}
        className={computeButtonDefaultClasses({ variant: 'secondary' })}
      >
        Discard
      </button>
      {submit}
    </div>
  )
}
